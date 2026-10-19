import { useEffect, useRef, useState } from 'react';

import { type Mixer, createMixer } from '../audio/mixer';
import { startCare } from '../core/needs';
import { PARK } from '../core/park';
import { savePark } from '../core/save';
import { type Bus, DEFAULT_SETTINGS, type Settings } from '../core/settings';
import { type GameHandle, startGame } from '../render/game';
import { loadSettings, storePark, storeSettings } from '../storage/parkStore';
import { ParentArea } from './ParentArea';
import { supportsWebGL2 } from '../render/webgl';
import { strings } from './strings';

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<GameHandle | null>(null);
  const mixerRef = useRef<Mixer | null>(null);
  /** Whether the current press on the honk button has already honked. */
  const honked = useRef(false);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const webgl2 = supportsWebGL2();

  useEffect(() => {
    void loadSettings().then(setSettings);
  }, []);

  // Keep the mixer's buses at the parent area's volumes, including once the mixer is made.
  useEffect(() => {
    const mixer = mixerRef.current;
    if (mixer) {
      for (const [bus, volume] of Object.entries(settings.volumes) as [Bus, number][]) {
        mixer.buses[bus].gain.value = volume;
      }
    }
  });

  const setVolume = (bus: Bus, volume: number) => {
    const next = { ...settings, volumes: { ...settings.volumes, [bus]: volume } };
    setSettings(next);
    void storeSettings(next);
  };

  // Settings are stored apart from the park, so they survive this.
  const resetPark = () => {
    void storePark(savePark(startCare(PARK))).then(() => window.location.reload());
  };

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
        // Enter, Space, switch access and a screen reader's "activate" send only a click, with `detail` 0; a pointer's
        // click has already honked above. A keyboard click is itself a gesture, so it can unlock sound.
        onClick={(event) => {
          if (event.detail === 0) {
            mixerRef.current?.unlock();
            gameRef.current?.honk();
          }
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
      <ParentArea settings={settings} onVolume={setVolume} onReset={resetPark} />
      <small className="build" data-testid="build">
        v{__APP_VERSION__} · {__GIT_SHA__}
      </small>
    </>
  );
}
