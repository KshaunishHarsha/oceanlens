/* Quality control.
 *
 * The vocabulary is not invented: it is the Argo real-time QC scheme, which we
 * verified against real GDAC files during the Phase 0 audit. Keeping the enum
 * aligned to the source means we never have to translate a scientist's
 * expectation into a product-specific word. */

export type QualityFlag = 'GOOD' | 'PROBABLY_GOOD' | 'SUSPECT' | 'BAD';

/** Argo per-level QC characters we understand. Anything else is dropped. */
export type ArgoQcChar = '1' | '2' | '3' | '4' | '5' | '8' | '9' | ' ';

export interface QualityDescriptor {
  readonly flag: QualityFlag;
  /** Short badge text, e.g. "GOOD". */
  readonly label: string;
  /** Sentence shown in the badge tooltip. Explains what the flag *means*. */
  readonly explanation: string;
  /** CSS custom property holding this flag's colour. */
  readonly colorVar: string;
  /** Whether a "good quality only" filter should retain this level. */
  readonly passesGoodOnlyFilter: boolean;
}

export const QUALITY: Readonly<Record<QualityFlag, QualityDescriptor>> = {
  GOOD: {
    flag: 'GOOD',
    label: 'GOOD',
    explanation:
      'Passed all real-time quality control tests. Argo QC flag 1.',
    colorVar: '--good',
    passesGoodOnlyFilter: true,
  },
  PROBABLY_GOOD: {
    flag: 'PROBABLY_GOOD',
    label: 'PROBABLY GOOD',
    explanation:
      'Passed quality control with minor reservations; usable for most analysis. Argo QC flag 2.',
    colorVar: '--good',
    passesGoodOnlyFilter: true,
  },
  SUSPECT: {
    flag: 'SUSPECT',
    label: 'SUSPECT',
    explanation:
      'Failed one or more tests and may be correctable. Not recommended without adjustment. Argo QC flag 3.',
    colorVar: '--warn',
    passesGoodOnlyFilter: false,
  },
  BAD: {
    flag: 'BAD',
    label: 'BAD',
    explanation: 'Failed quality control. Should not be used. Argo QC flag 4.',
    colorVar: '--bad',
    passesGoodOnlyFilter: false,
  },
};

/**
 * Map an Argo per-level QC character to our flag.
 *
 * Returns `null` for values that carry no quality judgement we can display:
 *   '5' value changed, '8' interpolated, '9' missing, ' ' no QC performed.
 * Those are surfaced in provenance rather than shown as a quality state.
 */
export function fromArgoQc(ch: string): QualityFlag | null {
  switch (ch) {
    case '1':
      return 'GOOD';
    case '2':
      return 'PROBABLY_GOOD';
    case '3':
      return 'SUSPECT';
    case '4':
      return 'BAD';
    default:
      return null;
  }
}

/**
 * Argo `PROFILE_<PARAM>_QC` summarises a whole profile as a letter:
 * 'A' = 100% of levels good, through 'F' = <25%, and 'E'/'F' meaning almost
 * nothing is usable. Real INCOIS floats do return E and F — we saw it in the
 * audit — so this must be handled, not assumed away.
 *
 * Returns the percentage band's lower bound, or null if the letter is absent.
 */
export function argoProfileQcToPercent(letter: string): number | null {
  const bands: Record<string, number> = {
    A: 100,
    B: 75,
    C: 50,
    D: 25,
    E: 0,
    F: 0,
  };
  return bands[letter.trim().toUpperCase()] ?? null;
}

/** Worst (most severe) flag in a set. Used to summarise a profile. */
export function worstFlag(flags: readonly QualityFlag[]): QualityFlag | null {
  const order: readonly QualityFlag[] = ['GOOD', 'PROBABLY_GOOD', 'SUSPECT', 'BAD'];
  let worst = -1;
  for (const f of flags) worst = Math.max(worst, order.indexOf(f));
  return worst < 0 ? null : (order[worst] as QualityFlag);
}

export function getQualityLabel(flag: QualityFlag): string {
  return QUALITY[flag].label;
}
