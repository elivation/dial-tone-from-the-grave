import { expect, type Page, type Route } from '@playwright/test';
import type { OperatorEvent } from '../../lib/sse';

/** Where the audio spy and the speech stub keep what they saw. Both exist only in the test browser. */
type SpyWindow = Window & {
  __audio: { clicks: number; statics: number };
  __speech: { spoken: string[]; pending: Array<() => void> };
};

/**
 * Wakes the phone: one press of Pick up the handset loads the 3D scene and then picks up. Waiting
 * for the dial tone line covers the load.
 */
export async function openPhone(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Pick up the handset' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Dial a number.' })).toBeVisible({
    timeout: 60_000,
  });
  // The first frames compile the scene and block the main thread for up to 650 ms at a time. A key
  // pressed then makes the dial run back late, so the next key arrives while it is still moving and
  // is ignored, as a real dial would. Let the scene settle first.
  await page.waitForTimeout(1500);
}

/**
 * Presses the number keys one at a time. The dial ignores a key while it is still moving, so each
 * digit is waited for on the display, then given time to run back, with a margin for a slow machine.
 */
export async function dial(page: Page, number: string) {
  let soFar = '';
  for (const digit of number) {
    await page.keyboard.press(digit);
    soFar += digit;
    await expect(page.getByRole('status', { name: 'Dialled number' })).toHaveText(soFar);
    await page.waitForTimeout((digit === '0' ? 10 : Number(digit)) * 100 + 400);
  }
}

/**
 * Counts what the Web Audio engine starts, without touching the app. A buffer source that loops
 * is the static. One that plays once is a dial click.
 */
export async function spyOnAudio(page: Page) {
  await page.addInitScript(() => {
    const spy = { clicks: 0, statics: 0 };
    (window as unknown as SpyWindow).__audio = spy;
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args: Parameters<typeof start>) {
      if (this.loop) spy.statics += 1;
      else spy.clicks += 1;
      return start.apply(this, args);
    };
  });
}

export function audioCounts(page: Page) {
  return page.evaluate(() => (window as unknown as SpyWindow).__audio);
}

/**
 * Replaces speech synthesis with a stub that records what was said and never finishes by itself.
 * `finishSpeech` ends the line being spoken, so a test controls when the operator stops talking.
 */
export async function stubSpeech(page: Page) {
  await page.addInitScript(() => {
    const speech: SpyWindow['__speech'] = { spoken: [], pending: [] };
    (window as unknown as SpyWindow).__speech = speech;
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        getVoices: () => [],
        cancel: () => {
          speech.pending = [];
        },
        speak: (utterance: SpeechSynthesisUtterance) => {
          speech.spoken.push(utterance.text);
          speech.pending.push(() => utterance.onend?.(new Event('end') as SpeechSynthesisEvent));
        },
      },
    });
  });
}

export function spokenLines(page: Page) {
  return page.evaluate(() => (window as unknown as SpyWindow).__speech.spoken);
}

export function finishSpeech(page: Page) {
  return page.evaluate(() => {
    const speech = (window as unknown as SpyWindow).__speech;
    const done = speech.pending;
    speech.pending = [];
    done.forEach((end) => end());
  });
}

const sseBody = (events: readonly OperatorEvent[]) =>
  events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join('');

/** What a mocked `/api/operator` request carried. */
export type OperatorRequest = {
  number: string;
  message: string;
  turnIndex: number;
  history: Array<{ role: string; content: string }>;
};

/**
 * Answers `/api/operator` with canned replies, one per request, repeating the last. A reply is a
 * list of stream events, or the status of a plain failure. Returns the requests seen so far.
 */
export async function mockOperator(page: Page, replies: ReadonlyArray<OperatorEvent[] | 429>) {
  const requests: OperatorRequest[] = [];
  await page.route('**/api/operator', async (route: Route) => {
    requests.push(route.request().postDataJSON() as OperatorRequest);
    const reply = replies[Math.min(requests.length, replies.length) - 1];
    if (reply === 429) {
      await route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'rate_limited', message: 'All lines are busy.' }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream; charset=utf-8',
      body: sseBody(reply ?? []),
    });
  });
  return requests;
}

/** Makes every dialled five or ten digit number reach a listing, so no database is needed. */
export async function mockNumberLookup(page: Page) {
  await page.route('**/api/number', (route) =>
    route.fulfill({ json: { kind: 'listing', ringCount: 2 } }),
  );
}

/** An invented business, with every field the book reads. */
export const PLUMBER = {
  id: 'e2e-plumber',
  name: 'Hollow Pipe Plumbing',
  category: 'Plumber',
  suburb: 'Edenvale',
  address: '14 Lamp Street',
  phone: '011 000 2201',
  dial_number: '61001',
  hours: 'Mon to Sat, 7am to 6pm',
  description: 'Burst pipes, cold geysers and things in the drains.',
  is_24hr: false,
  is_advert: false,
  is_spirit: false,
  score: 0.9,
};

export const SPIRIT = {
  ...PLUMBER,
  id: 'e2e-spirit',
  name: 'Last Orders Undertakers',
  category: 'Spirit listing',
  suburb: 'Duskvale',
  phone: '011 000 1313',
  dial_number: '31313',
  description: 'Open all hours, for those who no longer keep them.',
  is_24hr: true,
  is_spirit: true,
};

/** Types a message to the operator and sends it. */
export async function say(page: Page, text: string) {
  await page.getByLabel('Your message').fill(text);
  await page.getByRole('button', { name: 'Send' }).click();
}
