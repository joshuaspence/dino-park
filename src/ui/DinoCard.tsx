import { useEffect, useState } from 'react';

import { SPECIES_FACTS } from '../core/facts';
import { type Mood, NEED_KINDS, type NeedKind, type Resident, moodOf } from '../core/needs';
import { SPECIES, type SpeciesId } from '../core/species';
import type { GameHandle } from '../render/game';
import { type Icon, iconImage, needIcon } from '../render/icons';
import { strings } from './strings';

/** How often the card catches up with the dinosaur's meters, which drain slowly. */
const REFRESH_MS = 500;

/** What each meter shows: the picture of what fills it, so food matches the dinosaur's own diet. */
function meterIcon(kind: NeedKind, species: SpeciesId): Icon {
  // The dirty bubble shows mud, but the cleanliness meter is better shown by what fills it.
  return kind === 'dirty' ? 'soap' : needIcon(kind, species);
}

/**
 * A dinosaur's info card (docs/design.md §6), opened by a double tap. Everything a child needs is a picture, and
 * Rosie reads it aloud: who it is, how it feels and a fact about the real species. The few words are captions for
 * grown-ups and early readers. Give it a `key` of the species, so another dinosaur's card starts afresh.
 */
export function DinoCard({ game, species, onClose }: { game: GameHandle; species: SpeciesId; onClose(): void }) {
  const [resident, setResident] = useState<Resident | undefined>(() => game.resident(species));
  const [fact, setFact] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setResident(game.resident(species)), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [game, species]);
  if (!resident) {
    return null;
  }
  const about = SPECIES_FACTS[species];
  const name = SPECIES[species].residentName;
  const mood = moodOf(resident);
  const facts = about.facts;

  return (
    <section className="card" aria-label={strings.cardTitle(name)} data-species={species} data-mood={mood}>
      <button type="button" className="card-close" aria-label={strings.close} onClick={onClose}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 6 L18 18 M18 6 L6 18" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      </button>
      <header className="card-header">
        <MoodFace mood={mood} />
        <div>
          <h2 className="card-name">{name.charAt(0).toUpperCase() + name.slice(1)}</h2>
          <p className="card-species">{about.name}</p>
          <p className="card-mood">{strings.moods[mood]}</p>
        </div>
      </header>
      <ul className="card-meters">
        {NEED_KINDS.map((kind) => {
          const level = resident.levels[kind];
          const wanted = resident.need?.kind === kind;
          return (
            <li key={kind} className={wanted ? 'meter wanted' : 'meter'} data-kind={kind}>
              <img src={iconImage(meterIcon(kind, species))} alt="" />
              <span className="meter-label">{strings.meters[kind]}</span>
              <span
                className="meter-bar"
                role="meter"
                aria-label={strings.meters[kind]}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(level * 100)}
              >
                <span
                  className={level < 0.25 ? 'meter-fill low' : level < 0.5 ? 'meter-fill middling' : 'meter-fill'}
                  style={{ width: `${Math.round(level * 100)}%` }}
                />
              </span>
            </li>
          );
        })}
      </ul>
      <div className="card-fact">
        <button
          type="button"
          className="card-fact-button"
          aria-label={strings.anotherFact}
          onClick={() => setFact(game.nextFact(species))}
        >
          <svg viewBox="0 0 64 64" aria-hidden="true">
            <path d="M8 14 Q8 8 14 8 H50 Q56 8 56 14 V38 Q56 44 50 44 H28 L16 56 V44 H14 Q8 44 8 38 Z" fill="#fff" />
            <circle cx="22" cy="26" r="4" fill="#3bb3a0" />
            <circle cx="32" cy="26" r="4" fill="#3bb3a0" />
            <circle cx="42" cy="26" r="4" fill="#3bb3a0" />
          </svg>
        </button>
        <p className="card-fact-text">{facts[fact % facts.length]}</p>
      </div>
    </section>
  );
}

/** A face that shows the mood without words. */
function MoodFace({ mood }: { mood: Mood }) {
  const mouth = {
    happy: 'M20 38 Q32 50 44 38',
    fine: 'M22 40 Q32 44 42 40',
    wants: 'M24 42 Q32 40 40 42',
    sad: 'M22 44 Q32 34 42 44',
  }[mood];
  return (
    <svg className="mood-face" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="28" fill="#ffd84a" />
      <circle cx="23" cy="26" r="3.5" fill="#222" />
      <circle cx="41" cy="26" r="3.5" fill="#222" />
      <path d={mouth} fill="none" stroke="#222" strokeWidth="3.5" strokeLinecap="round" />
      {mood === 'sad' && <path d="M44 32 Q46 38 44 40 Q42 38 44 32" fill="#4aa8e8" />}
    </svg>
  );
}
