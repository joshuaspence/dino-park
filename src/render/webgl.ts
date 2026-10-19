/** True when this browser can create a WebGL2 context, which Dino Park requires. */
export function supportsWebGL2(): boolean {
  try {
    return document.createElement('canvas').getContext('webgl2') !== null;
  } catch {
    return false;
  }
}
