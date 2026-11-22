import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useSceneGate } from './useSceneGate';

const press = (type: 'pointerdown' | 'keydown') =>
  act(() => void window.dispatchEvent(new Event(type)));

describe('useSceneGate', () => {
  it('[Req 5.3] keeps the scene asleep until the first interaction', () => {
    const { result } = renderHook(() => useSceneGate(vi.fn()));
    expect(result.current.active).toBe(false);
  });

  it('[Req 5.3] wakes the scene on the first pointerdown', () => {
    const { result } = renderHook(() => useSceneGate(vi.fn()));
    press('pointerdown');
    expect(result.current.active).toBe(true);
  });

  it('[Req 9.2] wakes the scene on the first key press', () => {
    const { result } = renderHook(() => useSceneGate(vi.fn()));
    press('keydown');
    expect(result.current.active).toBe(true);
  });

  it('[Req 5.3] a pick up before the scene is ready wakes it and waits, then picks up once', () => {
    const pickUp = vi.fn();
    const { result } = renderHook(() => useSceneGate(pickUp));
    act(() => result.current.requestPickUp());
    expect(result.current.active).toBe(true);
    expect(pickUp).not.toHaveBeenCalled();
    act(() => result.current.onSettled());
    expect(pickUp).toHaveBeenCalledTimes(1);
  });

  it('[Req 5.3] pressing the button twice while the scene loads still picks up once', () => {
    const pickUp = vi.fn();
    const { result } = renderHook(() => useSceneGate(pickUp));
    act(() => result.current.requestPickUp());
    act(() => result.current.requestPickUp());
    act(() => result.current.onSettled());
    expect(pickUp).toHaveBeenCalledTimes(1);
  });

  it('[Req 5.3] picks up straight away once the scene is ready', () => {
    const pickUp = vi.fn();
    const { result } = renderHook(() => useSceneGate(pickUp));
    act(() => result.current.onSettled());
    act(() => result.current.requestPickUp());
    expect(pickUp).toHaveBeenCalledTimes(1);
  });

  it('[Req 5.3] a scene that settles with nobody waiting picks up nothing', () => {
    const pickUp = vi.fn();
    const { result } = renderHook(() => useSceneGate(pickUp));
    press('pointerdown');
    act(() => result.current.onSettled());
    expect(pickUp).not.toHaveBeenCalled();
  });

  it('stops listening once awake', () => {
    const remove = vi.spyOn(window, 'removeEventListener');
    const { result } = renderHook(() => useSceneGate(vi.fn()));
    press('keydown');
    expect(result.current.active).toBe(true);
    expect(remove).toHaveBeenCalledWith('pointerdown', expect.any(Function));
    remove.mockRestore();
  });
});
