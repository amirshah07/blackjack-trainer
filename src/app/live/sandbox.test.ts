import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Live Play is specified as a pure sandbox: no correctness feedback, no count
 * check-ins, no stats. That is easy to reintroduce by accident when copying
 * from the Basic Strategy page, so assert it at the import level.
 */
const source = readFileSync(
  resolve(__dirname, 'LivePlayGame.tsx'),
  'utf8',
);

describe('Live Play stays a sandbox', () => {
  it('does not import the Toast component', () => {
    expect(source).not.toMatch(/from\s+['"]@\/components\/Toast['"]/);
  });

  it('does not import the stats panel', () => {
    expect(source).not.toMatch(/from\s+['"]@\/components\/StatsPanel['"]/);
  });

  it('does not import the count check modal', () => {
    expect(source).not.toMatch(/from\s+['"]@\/components\/CountCheckModal['"]/);
  });

  it('does not touch session storage', () => {
    expect(source).not.toMatch(/@\/storage\/session/);
    expect(source).not.toMatch(/logResult|getStats/);
  });

  it('does not read the decision or count-check verdicts', () => {
    expect(source).not.toMatch(/lastDecision/);
    expect(source).not.toMatch(/lastCountCheck/);
  });
});
