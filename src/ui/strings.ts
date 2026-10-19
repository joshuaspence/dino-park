// Player-facing text, in Australian English. Gameplay itself uses pictures and voice, not text.
export const strings = {
  title: 'Dino Park',
  noWebGL: "This device can't run Dino Park.",
  rotate: 'Turn me sideways!',
  /** Read aloud by screen readers only: the honk button itself is a picture. */
  honk: 'Honk',

  // The parent area (docs/design.md §7). Reading is the gate: a small child can't tap a number named in words.
  gate: 'For grown-ups: press and hold',
  gateAsk: (number: string) => `To continue, tap the number ${number}.`,
  numberWords: ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'],
  parentTitle: 'For grown-ups',
  volumes: { music: 'Music', effects: 'Sound effects', voice: 'Voice' },
  bedtime: 'Bedtime',
  bedtimeHelp: 'After this much play the park goes to sleep, until a grown-up wakes it here.',
  bedtimeChoice: (minutes: number) => (minutes === 0 ? 'Off' : `${minutes} min`),
  asleep: 'The park is asleep.',
  wake: 'Wake the park',
  reset: 'Reset the park',
  resetConfirm: 'This clears every egg and dinosaur hatched so far, and starts the park again.',
  resetAsk: (number: string) => `To reset it, tap the number ${number}.`,
  resetNo: 'No, keep it',
  version: 'Version',
  close: 'Close',
} as const;
