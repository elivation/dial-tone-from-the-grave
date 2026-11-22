import { Suspense, lazy, useMemo, type ComponentType } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PhoneCanvasLoader } from './PhoneCanvasLoader';
import { hasWebGL } from './webgl';
import { POSTER_ALT } from '@/components/ScenePoster/ScenePoster';
import type { DialController } from '@/components/RotaryDial/useDialController';

// Counts the times the scene's import() runs, which is when the chunk would be fetched.
const sceneImported = vi.hoisted(() => vi.fn());
// next/dynamic is React.lazy underneath: the loader runs on first render, not before. Each mount
// gets its own lazy so that every test sees its own import.
vi.mock('next/dynamic', () => ({
  default: (load: () => Promise<{ default: ComponentType<{ onReady: () => void }> }>) => {
    return function Dynamic(props: { onReady: () => void }) {
      const Scene = useMemo(
        () =>
          lazy(() => {
            sceneImported();
            return load();
          }),
        [],
      );
      return (
        <Suspense fallback={null}>
          <Scene {...props} />
        </Suspense>
      );
    };
  },
}));
// The real scene needs WebGL. Stand in a canvas that reports ready when asked.
vi.mock('./PhoneCanvas', () => ({
  default: function FakeCanvas({ onReady }: { onReady: () => void }) {
    return <button onClick={onReady}>scene</button>;
  },
}));
vi.mock('./webgl', () => ({ hasWebGL: vi.fn() }));
const controller: DialController = {
  rotation: 0,
  phase: 'idle',
  activeDigit: null,
  disabled: false,
  reducedMotion: false,
  grab: () => false,
  drag: () => {},
  release: () => false,
  press: () => false,
};
const CONNECTING = 'Connecting you to the exchange...';
describe('PhoneCanvasLoader', () => {
  beforeEach(() => {
    vi.mocked(hasWebGL).mockReset();
    vi.mocked(hasWebGL).mockReturnValue(true);
    sceneImported.mockClear();
  });

  it('[Req 5.3] shows the poster, and no scene, before the first interaction', () => {
    render(<PhoneCanvasLoader controller={controller} active={false} />);
    expect(screen.getByRole('img', { name: POSTER_ALT })).toBeInTheDocument();
    expect(screen.queryByRole('button', { hidden: true, name: 'scene' })).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('[Req 5.3] does not import the scene, or ask for WebGL, until the scene is woken', () => {
    const { rerender } = render(<PhoneCanvasLoader controller={controller} active={false} />);
    expect(sceneImported).not.toHaveBeenCalled();
    expect(hasWebGL).not.toHaveBeenCalled();
    rerender(<PhoneCanvasLoader controller={controller} active />);
    expect(hasWebGL).toHaveBeenCalled();
  });

  it('[Req 5.3] imports the scene once it is woken', async () => {
    const { rerender } = render(<PhoneCanvasLoader controller={controller} active={false} />);
    rerender(<PhoneCanvasLoader controller={controller} active />);
    expect(await screen.findByRole('button', { hidden: true, name: 'scene' })).toBeInTheDocument();
    expect(sceneImported).toHaveBeenCalledTimes(1);
  });

  it('[Req 5.3] says it is connecting, politely, while the scene loads', () => {
    render(<PhoneCanvasLoader controller={controller} active />);
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent(CONNECTING);
    expect(status).toBeVisible();
  });

  it('[Req 5.3] hands the poster over to the scene once it is ready, and tells its parent', async () => {
    const onSettled = vi.fn();
    const { container } = render(
      <PhoneCanvasLoader controller={controller} active onSettled={onSettled} />,
    );
    expect(onSettled).not.toHaveBeenCalled();
    expect(screen.getByRole('img', { name: POSTER_ALT })).toBeInTheDocument();
    // The scene is aria-hidden on purpose, so look for it among hidden elements.
    await userEvent.click(await screen.findByRole('button', { hidden: true, name: 'scene' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(onSettled).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('img', { name: POSTER_ALT })).not.toBeInTheDocument();
    expect(container.querySelector('picture')?.parentElement).toHaveClass('opacity-0');
  });

  it('[Req 9.4] drops the crossfade and the pulse for people who ask for less motion', () => {
    const { container } = render(<PhoneCanvasLoader controller={controller} active />);
    expect(container.querySelector('picture')?.parentElement).toHaveClass(
      'motion-reduce:transition-none',
    );
    expect(screen.getByText(CONNECTING)).toHaveClass('motion-safe:animate-pulse');
  });

  it('keeps the 3D scene out of the accessibility tree', async () => {
    render(<PhoneCanvasLoader controller={controller} active />);
    expect(
      (await screen.findByRole('button', { hidden: true, name: 'scene' })).closest(
        '[aria-hidden="true"]',
      ),
    ).not.toBeNull();
  });

  it('[Req 9.5] keeps the poster and shows the fallback when WebGL is not available', () => {
    vi.mocked(hasWebGL).mockReturnValue(false);
    const onSettled = vi.fn();
    render(
      <PhoneCanvasLoader
        controller={controller}
        active
        onSettled={onSettled}
        fallback={<p>The switchboard is out of order.</p>}
      />,
    );
    expect(screen.getByText('The switchboard is out of order.')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: POSTER_ALT })).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(sceneImported).not.toHaveBeenCalled();
    // There is nothing to wait for, so a pick up that was waiting is let through.
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it('[Req 9.5] says nothing about WebGL while the scene is still asleep', () => {
    vi.mocked(hasWebGL).mockReturnValue(false);
    render(
      <PhoneCanvasLoader
        controller={controller}
        active={false}
        fallback={<p>The switchboard is out of order.</p>}
      />,
    );
    expect(screen.queryByText('The switchboard is out of order.')).not.toBeInTheDocument();
  });

  it('[Req 5.4] puts the candle flicker class on the vignette, over the poster too', () => {
    const { container } = render(<PhoneCanvasLoader controller={controller} active={false} />);
    expect(container.querySelector('.scene-vignette')).toHaveClass('scene-vignette-flicker');
  });
});
