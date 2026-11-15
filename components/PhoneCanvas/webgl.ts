let cached: boolean | undefined;

/** True when the browser can make a WebGL context. The answer is remembered. */
export function hasWebGL(): boolean {
  if (cached !== undefined) return cached;
  try {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    cached = context !== null;
    context?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    cached = false;
  }
  return cached;
}
