import { test, expect } from './quietPhone';
import {
  PLUMBER,
  SPIRIT,
  dial,
  finishSpeech,
  mockNumberLookup,
  mockOperator,
  openPhone,
  say,
  spokenLines,
  stubSpeech,
} from './helpers';

// A call rings for several seconds and the scene takes a while to load, so the default 30 s is short.
test.describe.configure({ timeout: 90_000 });

// The operator and the number lookup are mocked, so these runs spend no Claude credit and do not
// depend on the database. Real streaming is covered by the one @live test.
const CONVERSATION = (page: import('@playwright/test').Page) =>
  page.getByRole('log', { name: 'Conversation' });

test('[Req 4.1] a 1023 call finds a plumber in Edenvale and the phone book opens', async ({
  page,
}) => {
  const requests = await mockOperator(page, [
    [
      { type: 'tool_start', tool: 'search_businesses', query: 'plumber Edenvale' },
      { type: 'tool_result', results: [PLUMBER] },
      { type: 'delta', text: 'Hollow Pipe Plumbing, ' },
      { type: 'delta', text: 'in Edenvale. They answer after dark.' },
      { type: 'done' },
    ],
  ]);
  await openPhone(page);
  await dial(page, '1023');
  await expect(page.getByRole('heading', { name: 'Directory Enquiries' })).toBeVisible({
    timeout: 20_000,
  });
  await expect(CONVERSATION(page)).toContainText('Dead Pages, directory enquiries.');

  await say(page, 'someone to fix my geyser tonight in Edenvale');
  await expect(CONVERSATION(page)).toContainText('Hollow Pipe Plumbing, in Edenvale.');
  expect(requests).toHaveLength(1);
  expect(requests[0]).toMatchObject({
    number: '1023',
    message: 'someone to fix my geyser tonight in Edenvale',
    turnIndex: 0,
  });

  await expect(page.getByRole('button', { name: 'Close the book' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Business listings' })).toContainText(PLUMBER.name);
});

test('[Req 3.8] a 1026 call gets the time, and the line hangs up after the last goodbye', async ({
  page,
}) => {
  const turns = 6;
  const replies = Array.from({ length: turns }, (_, i) => [
    {
      type: 'delta' as const,
      text: i === turns - 1 ? 'Back to the dark with you.' : `It is 22:14, reply ${i + 1}.`,
    },
    { type: 'done' as const },
  ]);
  const requests = await mockOperator(page, replies);
  await stubSpeech(page);
  await openPhone(page);
  await page.getByRole('button', { name: 'Unmute' }).click();
  await dial(page, '1026');
  await expect(page.getByRole('heading', { name: 'Speaking Clock' })).toBeVisible({
    timeout: 20_000,
  });

  for (let turn = 1; turn < turns; turn++) {
    await say(page, `what is the time, turn ${turn}`);
    await expect(CONVERSATION(page)).toContainText(`It is 22:14, reply ${turn}.`);
    await expect(page.getByLabel('Your message')).toBeEnabled();
  }
  await say(page, 'and now?');
  await expect(CONVERSATION(page)).toContainText('Back to the dark with you.');
  expect(requests.map((request) => request.turnIndex)).toEqual([0, 1, 2, 3, 4, 5]);
  await expect.poll(() => spokenLines(page)).toContain('Back to the dark with you.');

  // The goodbye has been said but not heard to the end, so the line is still up.
  await expect(page.getByRole('region', { name: 'Telephone call' })).toBeVisible();
  await finishSpeech(page);
  await expect(page.getByRole('button', { name: 'Pick up the handset' })).toBeVisible({
    timeout: 6000,
  });
});

test('[Req 10.4] a 429 from the operator puts the line in the busy state, in character', async ({
  page,
}) => {
  await mockOperator(page, [429]);
  await openPhone(page);
  await dial(page, '1023');
  await expect(page.getByRole('heading', { name: 'Directory Enquiries' })).toBeVisible({
    timeout: 20_000,
  });
  await say(page, 'a locksmith please');
  await expect(
    page.getByRole('status').filter({ hasText: 'All lines are busy. Please try again later.' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pick up the handset' })).toBeVisible({
    timeout: 8000,
  });
});

test('[Req 7.3] dialling 1313 opens the spirit listings', async ({ page }) => {
  const requests = await mockOperator(page, [
    [
      { type: 'delta', text: 'You have reached the spirit line.' },
      { type: 'tool_result', results: [SPIRIT] },
      { type: 'done' },
    ],
  ]);
  await openPhone(page);
  await dial(page, '1313');
  await expect(
    page.getByRole('heading', { name: 'The Dead Pages: Spirit Listings', includeHidden: true }),
  ).toBeAttached({ timeout: 20_000 });
  await expect(page.getByRole('list', { name: 'Business listings' })).toContainText(SPIRIT.name);
  await expect(page.getByRole('button', { name: 'Close the book' })).toBeVisible();
  expect(requests[0]).toMatchObject({ number: '1313', message: '' });
});

test('[Req 11.2] the Dial button on a listing dials its number and that ghost answers', async ({
  page,
}) => {
  await mockNumberLookup(page);
  const requests = await mockOperator(page, [
    [
      { type: 'tool_start', tool: 'search_businesses', query: 'plumber' },
      { type: 'tool_result', results: [PLUMBER] },
      { type: 'delta', text: 'Found one.' },
      { type: 'done' },
    ],
    [{ type: 'delta', text: 'Who is it? The pipes are listening.' }, { type: 'done' }],
  ]);
  await openPhone(page);
  await dial(page, '1023');
  await expect(page.getByRole('heading', { name: 'Directory Enquiries' })).toBeVisible({
    timeout: 20_000,
  });
  await say(page, 'a plumber');
  await expect(page.getByRole('button', { name: 'Close the book' })).toBeVisible();

  // The book's list sits off-screen until it has focus, so a keyboard user opens the row.
  const row = page.getByRole('list', { name: 'Business listings' }).getByRole('button').first();
  await row.focus();
  await page.keyboard.press('Enter');
  const detail = page.getByRole('dialog', { name: PLUMBER.name });
  await detail.getByRole('button', { name: /^Dial Hollow Pipe Plumbing/ }).click();

  await expect(page.getByRole('heading', { name: 'A ghost on the line' })).toBeVisible({
    timeout: 60_000,
  });
  await expect(CONVERSATION(page)).toContainText('Hello? The line is faint. Who is calling?');
  await say(page, 'is anyone there?');
  await expect(CONVERSATION(page)).toContainText('The pipes are listening.');
  expect(requests[1]).toMatchObject({ number: PLUMBER.dial_number, turnIndex: 0 });
});
