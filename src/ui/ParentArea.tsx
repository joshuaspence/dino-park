import { useEffect, useRef, useState } from 'react';

import { BUSES, type Bus, type Settings } from '../core/settings';
import { strings } from './strings';

/** How long a grown-up holds the lock before the gate asks its question (docs/design.md §7). */
const HOLD_MS = 3000;
/** After a wrong number the lock ignores holds this long, so guessing all nine takes minutes, not seconds. */
const COOLDOWN_MS = 30_000;

interface Props {
  settings: Settings;
  onVolume(bus: Bus, volume: number): void;
  onReset(): void;
}

/** A number to tap, named in words, among the digits 1–9 in a shuffled order. */
interface Question {
  readonly answer: number;
  readonly order: readonly number[];
}

/**
 * Where the parent area is: shut, asking the gate's question, or open. Resetting the park, the one thing here that
 * can't be undone, asks a question of its own.
 */
type Stage = { name: 'closed' } | { name: 'asking'; question: Question } | { name: 'open'; resetting: Question | null };

/** A new question each time, with the numbers shuffled, so a lucky guess doesn't teach the answer. */
function ask(): Question {
  const order = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j] as number, order[i] as number];
  }
  return { answer: 1 + Math.floor(Math.random() * 9), order };
}

function Numbers({ question, onAnswer }: { question: Question; onAnswer(right: boolean): void }) {
  return (
    <div className="parent-numbers">
      {question.order.map((number) => (
        <button key={number} type="button" onClick={() => onAnswer(number === question.answer)}>
          {number}
        </button>
      ))}
    </div>
  );
}

const numberWord = (question: Question) => strings.numberWords[question.answer - 1] ?? '';

/**
 * The grown-up gate and the parent area behind it: a quiet lock in the corner that opens only after a 3-second hold
 * and a number named in words, then volumes, a park reset and the version.
 */
export function ParentArea({ settings, onVolume, onReset }: Props) {
  const [stage, setStage] = useState<Stage>({ name: 'closed' });
  const [holding, setHolding] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const lockedUntil = useRef(0);

  /** A wrong number shuts the parent area and makes the lock ignore holds for a while. */
  const wrong = () => {
    lockedUntil.current = performance.now() + COOLDOWN_MS;
    setStage({ name: 'closed' });
  };

  const startHold = () => {
    window.clearTimeout(timer.current);
    if (performance.now() < lockedUntil.current) {
      return;
    }
    setHolding(true);
    timer.current = window.setTimeout(() => {
      setHolding(false);
      setStage({ name: 'asking', question: ask() });
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
          <p id="parent-ask">{strings.gateAsk(numberWord(stage.question))}</p>
          <Numbers
            question={stage.question}
            onAnswer={(right) => (right ? setStage({ name: 'open', resetting: null }) : wrong())}
          />
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
          {stage.resetting ? (
            <div className="parent-confirm">
              <p id="parent-reset-ask">
                {strings.resetConfirm} {strings.resetAsk(numberWord(stage.resetting))}
              </p>
              <Numbers question={stage.resetting} onAnswer={(right) => (right ? onReset() : wrong())} />
              <button type="button" onClick={() => setStage({ name: 'open', resetting: null })}>
                {strings.resetNo}
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setStage({ name: 'open', resetting: ask() })}>
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
