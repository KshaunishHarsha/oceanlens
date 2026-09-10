/* Data-honesty guard.
 *
 * The artboard we are porting asserts "Processing status: verified" and a
 * "✓ Verified source" chip over data that is not externally verified. Those
 * strings are easy to reintroduce by copying markup from the reference.
 *
 * This test walks the source tree and fails the build if any forbidden claim
 * reappears outside the policy module that defines it. It is deliberately a
 * test rather than a code review item, because a code review can be skipped. */

import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { FORBIDDEN_CLAIMS } from '@/domain/provenance';

const SRC = new URL('.', import.meta.url).pathname;

/** Files allowed to contain the forbidden strings, because they define them. */
const ALLOWLIST = ['domain/provenance.ts', 'honesty.test.ts'];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|css|html|md|json)$/.test(name)) out.push(p);
  }
  return out;
}

describe('data honesty', () => {
  const files = walk(SRC).filter(
    (f) => !ALLOWLIST.some((a) => relative(SRC, f).replace(/\\/g, '/') === a),
  );

  it('finds source files to scan', () => {
    expect(files.length).toBeGreaterThan(3);
  });

  for (const claim of FORBIDDEN_CLAIMS) {
    it(`never asserts "${claim}"`, () => {
      const offenders = files.filter((f) =>
        readFileSync(f, 'utf8').toLowerCase().includes(claim.toLowerCase()),
      );
      expect(
        offenders.map((f) => relative(SRC, f)),
        `"${claim}" must not appear over data that is not externally verified`,
      ).toEqual([]);
    });
  }

  it('uses only obviously-demo identifiers', async () => {
    const { DEMO_IDS } = await import('@/domain/provenance');
    for (const id of Object.values(DEMO_IDS)) {
      expect(id.startsWith('DEMO-')).toBe(true);
    }
  });
});
