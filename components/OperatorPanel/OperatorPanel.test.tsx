import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  GOODBYE_DELAY_MS,
  OperatorPanel,
  type OperatorPanelProps,
  type TranscriptEntry,
} from './OperatorPanel';

const reply: TranscriptEntry[] = [
  { speaker: 'operator', text: 'Dead Pages, who are you looking for?' },
];

function setup(overrides: Partial<OperatorPanelProps> = {}) {
  const props: OperatorPanelProps = {
    operatorNumber: '1023',
    onMessage: vi.fn(),
    onHangUp: vi.fn(),
    turnIndex: 0,
    maxTurns: 6,
    transcript: [],
    streaming: false,
    audio: { isMuted: () => false, setMuted: vi.fn() },
    ...overrides,
  };
  const view = render(<OperatorPanel {...props} />);
  return { props, ...view };
}

function stubSpeech() {
  const speak = vi.fn();
  const cancel = vi.fn();
  const voices = [{ name: 'Thandi', lang: 'en-ZA' }];
  vi.stubGlobal('speechSynthesis', { speak, cancel, getVoices: () => voices });
  vi.stubGlobal(
    'SpeechSynthesisUtterance',
    class {
      constructor(public text: string) {}
      lang = '';
      pitch = 1;
      rate = 1;
      voice: unknown = null;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
    },
  );
  return { speak, voices };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('OperatorPanel', () => {
  it('[Req 3.4] shows the operator name and streamed text in a live log', () => {
    setup({ transcript: reply, streaming: true });
    expect(screen.getByRole('heading', { name: 'Directory Enquiries' })).toBeInTheDocument();
    const log = screen.getByRole('log', { name: 'Conversation' });
    expect(log).toHaveTextContent('Dead Pages, who are you looking for?');
    expect(log).toHaveAttribute('aria-live', 'polite');
  });

  it('[Req 9.5] always has a labelled text input, and no voice button when speech input is unavailable', () => {
    setup();
    expect(screen.getByLabelText('Your message')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Speak' })).not.toBeInTheDocument();
  });

  it('[Req 3.10] shows the voice button when the browser has SpeechRecognition, and keeps the text input', () => {
    vi.stubGlobal('webkitSpeechRecognition', class {});
    setup();
    expect(screen.getByRole('button', { name: 'Speak' })).toBeInTheDocument();
    expect(screen.getByLabelText('Your message')).toBeInTheDocument();
  });

  it('[Req 3.10] fills the input with what was heard, and falls back to typing when recognition errors', async () => {
    const instances: Array<{
      onresult: (e: unknown) => void;
      onerror: () => void;
      start: () => void;
    }> = [];
    vi.stubGlobal(
      'SpeechRecognition',
      class {
        start = vi.fn();
        stop = vi.fn();
        onresult: (e: unknown) => void = () => {};
        onerror: () => void = () => {};
        constructor() {
          instances.push(this);
        }
      },
    );
    setup();
    await userEvent.click(screen.getByRole('button', { name: 'Speak' }));
    act(() => instances[0]!.onresult({ results: [[{ transcript: 'geyser in Edenvale' }]] }));
    expect(screen.getByLabelText('Your message')).toHaveValue('geyser in Edenvale');
    act(() => instances[0]!.onerror());
    expect(screen.getByRole('status')).toHaveTextContent('Type your message instead.');
  });

  it('[Req 3.3] submitting calls onMessage with the typed text and clears the field', async () => {
    const { props } = setup();
    await userEvent.type(screen.getByLabelText('Your message'), 'geyser in Edenvale{Enter}');
    expect(props.onMessage).toHaveBeenCalledWith('geyser in Edenvale');
    expect(screen.getByLabelText('Your message')).toHaveValue('');
  });

  it('[Req 3.8] shows turns left and blocks sending when none remain', () => {
    setup({ turnIndex: 6 });
    expect(screen.getByText('Turns left: 0')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
  });

  it('[Req 2.7] hang up calls back', async () => {
    const { props } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Hang up' }));
    expect(props.onHangUp).toHaveBeenCalledTimes(1);
  });

  it('[Req 3.5] reads the reply aloud once it has finished streaming, in an en-ZA voice', () => {
    const { speak, voices } = stubSpeech();
    const { props, rerender } = setup({ transcript: reply, streaming: true });
    expect(speak).not.toHaveBeenCalled();
    rerender(<OperatorPanel {...props} transcript={reply} streaming={false} />);
    expect(speak).toHaveBeenCalledTimes(1);
    const utterance = speak.mock.calls[0]![0] as {
      text: string;
      voice: unknown;
      pitch: number;
      rate: number;
    };
    expect(utterance.text).toBe(reply[0]!.text);
    expect(utterance.voice).toBe(voices[0]);
    expect(utterance.pitch).toBe(1.1);
    expect(utterance.rate).toBe(0.85);
  });

  it('[Req 11.2] a listing call is headed as a ghost on the line and speaks in the listing voice', () => {
    const { speak } = stubSpeech();
    const { props, rerender } = setup({
      operatorNumber: '61019',
      callee: 'listing',
      transcript: reply,
      streaming: true,
    });
    expect(screen.getByRole('heading', { name: 'A ghost on the line' })).toBeInTheDocument();
    rerender(<OperatorPanel {...props} transcript={reply} streaming={false} />);
    const utterance = speak.mock.calls[0]![0] as { pitch: number; rate: number };
    expect(utterance.pitch).toBe(0.9);
    expect(utterance.rate).toBe(0.85);
  });
  it('[Req 3.5] stays silent while muted, but still shows the text', () => {
    const { speak } = stubSpeech();
    const { props, rerender } = setup({
      transcript: reply,
      streaming: true,
      audio: { isMuted: () => true, setMuted: vi.fn() },
    });
    rerender(<OperatorPanel {...props} transcript={reply} streaming={false} />);
    expect(speak).not.toHaveBeenCalled();
    expect(screen.getByRole('log')).toHaveTextContent('Dead Pages');
  });

  it('[Req 9.7] shows the reply as text when speech synthesis is unavailable', () => {
    const { props, rerender } = setup({ transcript: reply, streaming: true });
    rerender(<OperatorPanel {...props} transcript={reply} streaming={false} />);
    expect(screen.getByRole('log')).toHaveTextContent('Dead Pages');
  });

  it('[Req 9.7] a speech engine that throws is skipped silently, and the text and goodbye still happen', () => {
    vi.useFakeTimers();
    stubSpeech().speak.mockImplementation(() => {
      throw new Error('synthesis-failed');
    });
    const onClosed = vi.fn();
    const closing = { transcript: reply, streaming: true, closing: true, onClosed };
    const { props, rerender } = setup(closing);
    expect(() =>
      rerender(<OperatorPanel {...props} transcript={reply} streaming={false} />),
    ).not.toThrow();
    expect(screen.getByRole('log')).toHaveTextContent('Dead Pages');
    act(() => void vi.advanceTimersByTime(GOODBYE_DELAY_MS));
    expect(onClosed).toHaveBeenCalledTimes(1);
  });

  describe('closing the call after the goodbye', () => {
    const closing = { transcript: reply, streaming: true, closing: true };

    it('[Req 3.8] hangs up GOODBYE_DELAY_MS after speech ends, not before', () => {
      vi.useFakeTimers();
      const { speak } = stubSpeech();
      const onClosed = vi.fn();
      const { props, rerender } = setup({ ...closing, onClosed });
      rerender(<OperatorPanel {...props} {...closing} streaming={false} onClosed={onClosed} />);
      act(() => vi.advanceTimersByTime(GOODBYE_DELAY_MS * 5));
      expect(onClosed).not.toHaveBeenCalled();
      const utterance = speak.mock.calls[0]![0] as { onend: () => void };
      act(() => utterance.onend());
      act(() => vi.advanceTimersByTime(GOODBYE_DELAY_MS - 1));
      expect(onClosed).not.toHaveBeenCalled();
      act(() => vi.advanceTimersByTime(1));
      expect(onClosed).toHaveBeenCalledTimes(1);
    });

    it('[Req 3.8] starts the delay when the text finishes if the line is muted', () => {
      vi.useFakeTimers();
      stubSpeech();
      const onClosed = vi.fn();
      const audio = { isMuted: () => true, setMuted: vi.fn() };
      const { props, rerender } = setup({ ...closing, onClosed, audio });
      rerender(
        <OperatorPanel
          {...props}
          {...closing}
          streaming={false}
          onClosed={onClosed}
          audio={audio}
        />,
      );
      act(() => vi.advanceTimersByTime(GOODBYE_DELAY_MS));
      expect(onClosed).toHaveBeenCalledTimes(1);
    });

    it('[Req 3.8] does not hang up while the call is not closing', () => {
      vi.useFakeTimers();
      const onClosed = vi.fn();
      const { props, rerender } = setup({ transcript: reply, streaming: true, onClosed });
      rerender(
        <OperatorPanel {...props} transcript={reply} streaming={false} onClosed={onClosed} />,
      );
      act(() => vi.advanceTimersByTime(GOODBYE_DELAY_MS * 5));
      expect(onClosed).not.toHaveBeenCalled();
    });

    it('[Req 3.8] a speech end that arrives after the caller hung up does not hang up again', () => {
      vi.useFakeTimers();
      const { speak } = stubSpeech();
      const onClosed = vi.fn();
      const { props, rerender, unmount } = setup({ ...closing, onClosed });
      rerender(<OperatorPanel {...props} {...closing} streaming={false} onClosed={onClosed} />);
      const utterance = speak.mock.calls[0]![0] as { onend: () => void };
      unmount();
      act(() => utterance.onend());
      act(() => vi.advanceTimersByTime(GOODBYE_DELAY_MS * 2));
      expect(onClosed).not.toHaveBeenCalled();
    });

    it('[Req 3.8] cancels the pending hang-up when the caller hangs up first', () => {
      vi.useFakeTimers();
      const onClosed = vi.fn();
      const audio = { isMuted: () => true, setMuted: vi.fn() };
      const { props, rerender, unmount } = setup({ ...closing, onClosed, audio });
      rerender(
        <OperatorPanel
          {...props}
          {...closing}
          streaming={false}
          onClosed={onClosed}
          audio={audio}
        />,
      );
      unmount();
      act(() => vi.advanceTimersByTime(GOODBYE_DELAY_MS * 2));
      expect(onClosed).not.toHaveBeenCalled();
    });
  });
});
