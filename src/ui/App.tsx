import { useEffect, useRef } from 'react';

import { type Mixer, createMixer } from '../audio/mixer';
import { type GameHandle, startGame } from '../render/game';
import { supportsWebGL2 } from '../render/webgl';
import { strings } from './strings';

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<GameHandle | null>(null);
  const mixerRef = useRef<Mixer | null>(null);
  /** Whether the current press on the honk button has already honked. */
  const honked = useRef(false);
  const webgl2 = supportsWebGL2();

  useEffect(() => {
    if (!webgl2 || !canvasRef.current) {
      return;
    }
    const mixer = createMixer();
    const game = startGame(canvasRef.current, mixer);
    gameRef.current = game;
    mixerRef.current = mixer;
    return () => {
      gameRef.current = null;
      mixerRef.current = null;
      game.dispose();
      mixer.dispose();
    };
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
      {/*
        Honk on press, so a child who holds or slides their finger hears it straight away. Until sound is running,
        though, a finger's press can't unlock it, only its release can, so the very first honk waits for the release.
      */}
      <button
        type="button"
        className="honk"
        aria-label={strings.honk}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          mixerRef.current?.unlock();
          honked.current = mixerRef.current?.running ?? false;
          if (honked.current) {
            gameRef.current?.honk();
          }
        }}
        onPointerUp={() => {
          if (!honked.current) {
            gameRef.current?.honk();
          }
          honked.current = true;
        }}
      >
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <circle cx="16" cy="32" r="11" fill="#e0483e" />
          <path d="M24 26 L52 12 Q58 32 52 52 L24 38 Z" fill="#ffd84a" stroke="#c9a227" strokeWidth="3" />
        </svg>
      </button>
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
