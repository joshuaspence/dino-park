import type { SpeciesId } from './species';

/**
 * What each real species was, for the dinosaur info card (docs/design.md §6). Rosie reads it all aloud, so the facts
 * are short, spoken sentences a 3–6 year old can follow, and true to what palaeontologists think today.
 */
export interface SpeciesFacts {
  /** The species' name, as the card's caption shows it. */
  readonly name: string;
  /** What one of the park's residents is, for "Rex is a Tyrannosaurus rex": with "a", or plural for a pack. */
  readonly spoken: string;
  readonly facts: readonly string[];
}

export const SPECIES_FACTS: Readonly<Record<SpeciesId, SpeciesFacts>> = {
  triceratops: {
    name: 'Triceratops',
    spoken: 'a Triceratops',
    facts: [
      'Triceratops means three-horned face.',
      'Triceratops ate plants, and had a big bony frill around its neck.',
      'Triceratops lived at the same time as Tyrannosaurus rex.',
    ],
  },
  brontosaurus: {
    name: 'Brontosaurus',
    spoken: 'a Brontosaurus',
    facts: [
      'Brontosaurus means thunder lizard.',
      'Brontosaurus had a very long neck, to reach the leaves on tall trees.',
      'Brontosaurus was nearly as long as two buses!',
    ],
  },
  stegosaurus: {
    name: 'Stegosaurus',
    spoken: 'a Stegosaurus',
    facts: [
      'Stegosaurus had big plates along its back, and sharp spikes on its tail.',
      'Stegosaurus had a very small brain for such a big animal.',
      'Stegosaurus lived even longer ago than Tyrannosaurus rex.',
    ],
  },
  trex: {
    name: 'Tyrannosaurus rex',
    spoken: 'a Tyrannosaurus rex',
    facts: [
      'Tyrannosaurus rex means tyrant lizard king.',
      'Tyrannosaurus rex had about sixty teeth, and some were as big as bananas!',
      'Tyrannosaurus rex had tiny arms, but very strong legs.',
    ],
  },
  velociraptor: {
    name: 'Velociraptor',
    spoken: 'Velociraptors',
    facts: [
      'Velociraptor means swift thief.',
      'Real Velociraptors were about as big as a turkey, and had feathers!',
      'Velociraptor had a big curved claw on each foot.',
    ],
  },
  pterodactyl: {
    name: 'Pterodactylus',
    spoken: 'a Pterodactyl',
    facts: [
      "Pterodactyls weren't really dinosaurs. They were flying reptiles!",
      'Pterodactyls flew on wings made of skin.',
      'Pterodactyls probably ate fish and other small animals.',
    ],
  },
  ankylosaurus: {
    name: 'Ankylosaurus',
    spoken: 'an Ankylosaurus',
    facts: [
      'Ankylosaurus was covered in bony armour, like a tank.',
      'Ankylosaurus had a big club on the end of its tail.',
      'Ankylosaurus ate plants, and lived at the same time as Tyrannosaurus rex.',
    ],
  },
};

/** Ranger Rosie herself, a Parasaurolophus, for her own card. */
export const ROSIE_FACTS: SpeciesFacts = {
  name: 'Parasaurolophus',
  spoken: 'a Parasaurolophus',
  facts: [
    'Parasaurolophus had a long hollow crest, and could honk through it like a trumpet!',
    'Parasaurolophus was a duck-billed dinosaur that ate plants.',
    'Parasaurolophus could walk on two legs, or on all four.',
  ],
};
