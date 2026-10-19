import { useEffect, useRef, useState } from 'react';

import { BUSES, type Bus, type Settings } from '../core/settings';
import { strings } from './strings';

/** How long a grown-up holds the lock before the gate asks its question (docs/design.md §7). */
const HOLD_MS = 3000;

interface Props {
  settings: Settings;
  onVolume(bus: Bus, volume: number): void;
  onReset(): void;
}

type Stage =
  { name: 'closed' } | { name: 'asking'; answer: number; order: number[] } | { name: 'open'; confirming: boolean };

/** A new question each time, with the numbers shuffled, so a lucky guess doesn't teach the answer. */
function ask(): Stage {
  const order = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j] as number, order[i] as number];
  }
  return { name: 'asking', answer: 1 + Math.floor(Math.random() * 9), order };
}

/**
 * The grown-up gate and the parent area behind it: a quiet lock in the corner that opens only after a 3-second hold
 * and a number named in words, then volumes, a park reset and the version.
 */
export function ParentArea({ settings, onVolume, onReset }: Props) {
  const [stage, setStage] = useState<Stage>({ name: 'closed' });
  const [holding, setHolding] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  const startHold = () => {
    window.clearTimeout(timer.current);
    setHolding(true);
    timer.current = window.setTimeout(() => {
      setHolding(false);
      setStage(ask());
    }, HOLD_MS);
  };
  const stopHold = () => {
    window.clearTimeout(timer.current);
    setHolding(false);
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <>
      <button
        type="button"
        className={`parent-gate${holding ? ' holding' : ''}`}
        aria-label={strings.gate}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          startHold();
        }}
        onPointerUp={stopHold}
        onPointerCancel={stopHold}
        onKeyDown={(event) => {
          if ((event.key === 'Enter' || event.key === ' ') && !event.repeat) {
            event.preventDefault();
            startHold();
          }
        }}
        onKeyUp={stopHold}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="5" y="11" width="14" height="10" rx="2" fill="currentColor" />
          <path d="M8 11 V8 a4 4 0 0 1 8 0 V11" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      </button>

      {stage.name === 'asking' && (
        <div className="parent-panel" role="dialog" aria-modal="true" aria-labelledby="parent-ask">
          <p id="parent-ask">{strings.gateAsk(strings.numberWords[stage.answer - 1] ?? '')}</p>
          <div className="parent-numbers">
            {stage.order.map((number) => (
              <button
                key={number}
                type="button"
                onClick={() =>
                  setStage(number === stage.answer ? { name: 'open', confirming: false } : { name: 'closed' })
                }
              >
                {number}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setStage({ name: 'closed' })}>
            {strings.close}
          </button>
        </div>
      )}

      {stage.name === 'open' && (
        <div className="parent-panel" role="dialog" aria-modal="true" aria-labelledby="parent-title">
          <h2 id="parent-title">{strings.parentTitle}</h2>
          {BUSES.map((bus) => (
            <label key={bus} className="parent-volume">
              {strings.volumes[bus]}
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings.volumes[bus]}
                onChange={(event) => onVolume(bus, Number(event.currentTarget.value))}
              />
            </label>
          ))}
          {stage.confirming ? (
            <div className="parent-confirm">
              <p>{strings.resetConfirm}</p>
              <button type="button" onClick={onReset}>
                {strings.resetYes}
              </button>
              <button type="button" onClick={() => setStage({ name: 'open', confirming: false })}>
                {strings.resetNo}
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setStage({ name: 'open', confirming: true })}>
              {strings.reset}
            </button>
          )}
          <p className="parent-version">
            {strings.version} {__APP_VERSION__} · {__GIT_SHA__}
          </p>
          <button type="button" onClick={() => setStage({ name: 'closed' })}>
            {strings.close}
          </button>
        </div>
      )}
    </>
  );
}
