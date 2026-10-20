import { useEffect, useRef, useState } from 'react';

import { type Mixer, createMixer } from '../audio/mixer';
import { startCare } from '../core/needs';
import { PARK } from '../core/park';
import { savePark } from '../core/save';
import type { BedtimeMinutes } from '../core/bedtime';
import { type Bus, DEFAULT_SETTINGS, type Settings } from '../core/settings';
import { type GameHandle, startGame } from '../render/game';
import { loadSettings, storePark, storeSettings } from '../storage/parkStore';
import { type Subject, subjectKey } from '../core/inspect';
import { InfoCard } from './InfoCard';
import { RosieFace } from './RosieFace';
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
  /** True when the child seems stuck, so the help button wiggles to show it's there. */
  const [stuck, setStuck] = useState(false);
  /** What the open info card is about, if one is open. */
  const [card, setCard] = useState<{ subject: Subject; game: GameHandle } | null>(null);
  /** The latest settings, which the game's callback and the parent area's changes build on. */
  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);
  const webgl2 = supportsWebGL2();

  const changeSettings = (next: Settings) => {
    settingsRef.current = next;
    setSettings(next);
    void storeSettings(next);
  };

  // Keep the game's bedtime timer in step with the settings, including a park that was asleep when it was closed.
  useEffect(() => {
    gameRef.current?.setBedtime(settings.bedtime, settings.asleep);
  }, [settings.bedtime, settings.asleep]);

  // Keep the mixer's buses at the parent area's volumes, including once the mixer is made.
  useEffect(() => {
    const mixer = mixerRef.current;
    if (mixer) {
      for (const [bus, volume] of Object.entries(settings.volumes) as [Bus, number][]) {
        mixer.buses[bus].gain.value = volume;
      }
    }
  });

  // Each change builds on the latest settings, not this render's: the park can fall asleep between a render and a
  // grown-up's next change, and building on `settings` would undo that.
  const setVolume = (bus: Bus, volume: number) => {
    const current = settingsRef.current;
    changeSettings({ ...current, volumes: { ...current.volumes, [bus]: volume } });
  };
  const setBedtime = (minutes: BedtimeMinutes) => changeSettings({ ...settingsRef.current, bedtime: minutes });
  const wake = () => {
    changeSettings({ ...settingsRef.current, asleep: false });
    // A grown-up's tap is a gesture, so good morning can be heard even if nobody has tapped the park yet.
    mixerRef.current?.unlock();
    gameRef.current?.wake();
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
    const game = startGame(canvasRef.current, mixer, {
      onAsleep: () => changeSettings({ ...settingsRef.current, asleep: true }),
      onStuck: setStuck,
      onInspect: (subject) => setCard(subject && { subject, game }),
    });
    gameRef.current = game;
    mixerRef.current = mixer;
    // The park holds still until it knows its settings, so one that went to sleep never opens awake for a moment.
    let cancelled = false;
    void loadSettings().then((loaded) => {
      if (!cancelled) {
        settingsRef.current = loaded;
        setSettings(loaded);
        game.setBedtime(loaded.bedtime, loaded.asleep);
      }
    });
    return () => {
      cancelled = true;
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
        // A sleeping park ignores the horn, so the button dims with it.
        className={settings.asleep ? 'honk sleeping' : 'honk'}
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
      {/* Rosie's picture: tap her and she says what to do next, and shows where. */}
      <button
        type="button"
        className={['help', settings.asleep && 'sleeping', stuck && !settings.asleep && 'stuck']
          .filter(Boolean)
          .join(' ')}
        aria-label={strings.help}
        onClick={() => {
          // Its release is a gesture, so sound can start in time for her answer.
          mixerRef.current?.unlock();
          gameRef.current?.help();
        }}
      >
        <RosieFace />
      </button>
      {card && (
        <InfoCard
          key={subjectKey(card.subject)}
          game={card.game}
          subject={card.subject}
          onClose={() => {
            card.game.closeCard();
            setCard(null);
          }}
        />
      )}
      <div className="notice rotate-prompt" aria-live="polite">
        <span className="notice-picture" aria-hidden="true">
          📱↻
        </span>
        <p>{strings.rotate}</p>
      </div>
      <ParentArea settings={settings} onVolume={setVolume} onBedtime={setBedtime} onWake={wake} onReset={resetPark} />
      <small className="build" data-testid="build">
        v{__APP_VERSION__} · {__GIT_SHA__}
      </small>
    </>
  );
}
