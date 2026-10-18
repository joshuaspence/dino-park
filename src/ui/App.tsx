import { useEffect, useRef } from 'react';

import { startGame } from '../render/game';
import { supportsWebGL2 } from '../render/webgl';
import { strings } from './strings';

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const webgl2 = supportsWebGL2();

  useEffect(() => {
    if (!webgl2 || !canvasRef.current) {
      return;
    }
    const game = startGame(canvasRef.current);
    return () => game.dispose();
  }, [webgl2]);

  if (!webgl2) {
    return (
      <div className="notice" role="alert">
        <span className="notice-picture" aria-hidden="true">
          🦕
        </span>
        <p>{strings.noWebGL}</p>
      </div>
    );
  }

  return (
    <>
      <canvas ref={canvasRef} className="world" aria-label={strings.title} />
      <div className="notice rotate-prompt" aria-live="polite">
        <span className="notice-picture" aria-hidden="true">
          📱↻
        </span>
        <p>{strings.rotate}</p>
      </div>
      <small className="build" data-testid="build">
        v{__APP_VERSION__} · {__GIT_SHA__}
      </small>
    </>
  );
}
