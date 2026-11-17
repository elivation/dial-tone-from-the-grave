import { StrictMode, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { LINE_DEAD_MESSAGE, useOperatorChat, type OperatorChatOptions } from './useOperatorChat';

const frame = (event: unknown) => `data: ${JSON.stringify(event)}\n\n`;

function sseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
}

const fetchMock = vi.fn<typeof fetch>();

function setup(
  number: string | null = '1023',
  wrapper?: (props: { children: ReactNode }) => ReactNode,
) {
  const callbacks = { onTurnSent: vi.fn(), onRateLimited: vi.fn() };
  const initialProps: OperatorChatOptions = {
    operatorNumber: number,
    turnIndex: 0,
    maxTurns: 6,
    ...callbacks,
  };
  const hook = renderHook((props: OperatorChatOptions) => useOperatorChat(props), {
    initialProps,
    wrapper,
  });
  return { ...hook, callbacks, initialProps };
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useOperatorChat', () => {
  it('[Req 3.3] delta events build the operator reply and streaming ends on done', async () => {
    fetchMock.mockResolvedValue(
      sseResponse([
        frame({ type: 'delta', text: 'Dead ' }),
        frame({ type: 'delta', text: 'Pages.' }),
        frame({ type: 'done' }),
      ]),
    );
    const { result } = setup();
    act(() => result.current.send('plumber in Edenvale'));
    expect(result.current.streaming).toBe(true);
    await waitFor(() => expect(result.current.streaming).toBe(false));
    expect(result.current.transcript.slice(-2)).toEqual([
      { speaker: 'caller', text: 'plumber in Edenvale' },
      { speaker: 'operator', text: 'Dead Pages.' },
    ]);
  });

  it('[Req 4.5] a tool_result event stores the results and opens the phone book', async () => {
    const results = [{ id: 'a', name: 'Pipe Dreams Plumbing' }];
    fetchMock.mockResolvedValue(
      sseResponse([frame({ type: 'tool_result', results }), frame({ type: 'done' })]),
    );
    const { result } = setup();
    expect(result.current.bookOpen).toBe(false);
    act(() => result.current.send('plumber'));
    await waitFor(() => expect(result.current.bookOpen).toBe(true));
    expect(result.current.results).toEqual(results);
  });

  it('[Req 10.4] a 429 response sends RATE_LIMITED', async () => {
    fetchMock.mockResolvedValue(Response.json({ error: 'rate_limited' }, { status: 429 }));
    const { result, callbacks } = setup();
    act(() => result.current.send('hello'));
    await waitFor(() => expect(callbacks.onRateLimited).toHaveBeenCalledTimes(1));
    expect(result.current.streaming).toBe(false);
  });

  it('[Req 3.4] hanging up aborts the stream in flight', async () => {
    let signal: AbortSignal | null | undefined;
    fetchMock.mockImplementation((_url, init) => {
      signal = init?.signal;
      return new Promise<Response>(() => undefined);
    });
    const { result, rerender, initialProps } = setup();
    act(() => result.current.send('hello'));
    expect(signal?.aborted).toBe(false);
    rerender({ ...initialProps, operatorNumber: null });
    expect(signal?.aborted).toBe(true);
    expect(result.current.transcript).toEqual([]);
  });

  it('[Req 3.3] the request carries the number, turn index and earlier turns', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        sseResponse([frame({ type: 'delta', text: 'Yes?' }), frame({ type: 'done' })]),
      ),
    );
    const { result, rerender, initialProps } = setup();
    act(() => result.current.send('first'));
    await waitFor(() => expect(result.current.streaming).toBe(false));
    rerender({ ...initialProps, turnIndex: 1 });
    act(() => result.current.send('second'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const body: unknown = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
    expect(body).toEqual({
      number: '1023',
      message: 'second',
      turnIndex: 1,
      history: [
        { role: 'user', content: 'first' },
        { role: 'assistant', content: 'Yes?' },
      ],
    });
  });

  it('[Req 3.3] a failed stream gives an in-character line, not an error', async () => {
    fetchMock.mockResolvedValue(sseResponse([frame({ type: 'error', code: 'operator_down' })]));
    const { result } = setup();
    act(() => result.current.send('hello'));
    await waitFor(() => expect(result.current.streaming).toBe(false));
    expect(result.current.transcript.at(-1)).toEqual({
      speaker: 'operator',
      text: LINE_DEAD_MESSAGE,
    });
  });

  it('[Req 3.3] the spirit line opens its own request once, even in strict mode', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        sseResponse([
          frame({ type: 'delta', text: 'Who calls?' }),
          frame({ type: 'tool_result', results: [] }),
          frame({ type: 'done' }),
        ]),
      ),
    );
    const { result, callbacks } = setup('1313', ({ children }) => (
      <StrictMode>{children}</StrictMode>
    ));
    await waitFor(() => expect(result.current.bookOpen).toBe(true));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.transcript).toEqual([{ speaker: 'operator', text: 'Who calls?' }]);
    expect(callbacks.onTurnSent).not.toHaveBeenCalled();
  });

  it('[Req 4.5] results and the open book survive hang-up, and the next call clears them', async () => {
    const results = [{ id: 'a', name: 'Pipe Dreams Plumbing' }];
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        sseResponse([frame({ type: 'tool_result', results }), frame({ type: 'done' })]),
      ),
    );
    const { result, rerender, initialProps } = setup();
    act(() => result.current.send('plumber'));
    await waitFor(() => expect(result.current.bookOpen).toBe(true));
    rerender({ ...initialProps, operatorNumber: null });
    expect(result.current.transcript).toEqual([]);
    expect(result.current.bookOpen).toBe(true);
    expect(result.current.results).toEqual(results);
    rerender({ ...initialProps, operatorNumber: '1023' });
    expect(result.current.bookOpen).toBe(false);
    expect(result.current.results).toEqual([]);
  });

  it('[Req 4.5] closeBook shuts the book but keeps the results', async () => {
    fetchMock.mockResolvedValue(
      sseResponse([
        frame({ type: 'tool_result', results: [{ id: 'a' }] }),
        frame({ type: 'done' }),
      ]),
    );
    const { result } = setup();
    act(() => result.current.send('plumber'));
    await waitFor(() => expect(result.current.bookOpen).toBe(true));
    act(() => result.current.closeBook());
    expect(result.current.bookOpen).toBe(false);
    expect(result.current.results).toHaveLength(1);
  });

  it('[Req 3.8] a reply before the last turn does not set closing', async () => {
    fetchMock.mockResolvedValue(
      sseResponse([frame({ type: 'delta', text: 'Goodnight.' }), frame({ type: 'done' })]),
    );
    const { result } = setup('1023');
    expect(result.current.closing).toBe(false);
    act(() => result.current.send('first question'));
    await waitFor(() => expect(result.current.streaming).toBe(false));
    expect(result.current.closing).toBe(false);
  });

  it('[Req 3.8] a done on the last allowed turn sets closing', async () => {
    fetchMock.mockResolvedValue(
      sseResponse([frame({ type: 'delta', text: 'Goodnight.' }), frame({ type: 'done' })]),
    );
    const { result, rerender, initialProps } = setup('1023');
    rerender({ ...initialProps, turnIndex: 5 });
    act(() => result.current.send('last question'));
    await waitFor(() => expect(result.current.closing).toBe(true));
    expect(result.current.streaming).toBe(false);
    expect(result.current.transcript.at(-1)).toEqual({ speaker: 'operator', text: 'Goodnight.' });
  });

  it('[Req 3.8] a turn_cap error keeps the goodbye on screen and sets closing', async () => {
    fetchMock.mockResolvedValue(
      sseResponse([
        frame({ type: 'delta', text: 'The line is fading.' }),
        frame({ type: 'error', code: 'turn_cap' }),
      ]),
    );
    const { result } = setup('1023');
    act(() => result.current.send('one more'));
    await waitFor(() => expect(result.current.closing).toBe(true));
    expect(result.current.transcript.at(-1)?.text).toBe('The line is fading.');
  });

  it('[Req 3.8] the spirit line closes after its page opens', async () => {
    fetchMock.mockResolvedValue(
      sseResponse([
        frame({ type: 'delta', text: 'Who calls?' }),
        frame({ type: 'tool_result', results: [] }),
        frame({ type: 'done' }),
      ]),
    );
    const { result } = setup('1313');
    await waitFor(() => expect(result.current.closing).toBe(true));
    expect(result.current.bookOpen).toBe(true);
  });
});
