import { describe, it, expect } from 'vitest';
import { hardRows, softRows, pairRows, collapseRows } from './chart-rows';
import { UPCARDS, chartAction } from './strategy';
import type { Card, Rank } from './cards';

let uid = 0;
const c = (rank: Rank): Card => ({ rank, suit: 'spades', id: `cr${uid++}` });

describe('collapseRows', () => {
  it('merges consecutive identical rows into a range', () => {
    const rows = collapseRows([
      { label: '13', actions: ['stand', 'hit'] },
      { label: '14', actions: ['stand', 'hit'] },
      { label: '15', actions: ['stand', 'hit'] },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].label).toBe('13-15');
  });

  it('keeps differing rows apart', () => {
    const rows = collapseRows([
      { label: '9',  actions: ['hit', 'double'] },
      { label: '10', actions: ['double', 'double'] },
    ]);
    expect(rows.map((r) => r.label)).toEqual(['9', '10']);
  });
});

describe('hard rows match the source chart layout', () => {
  it('produces the bands the chart shows', () => {
    const labels = hardRows().map((r) => r.label);
    // 5-8 hit alike, 12 is its own row, 13-16 share, 17+ is the top band.
    expect(labels).toContain('5-8');
    expect(labels).toContain('9');
    expect(labels).toContain('10');
    expect(labels).toContain('11');
    expect(labels).toContain('12');
    expect(labels).toContain('13-16');
    expect(labels).toContain('17+');
  });

  it('never loses a total from the table', () => {
    // Every total 5-21 must be represented by exactly one band.
    const covered = new Set<number>();
    for (const row of hardRows()) {
      const label = row.label.replace('+', '-21');
      const [a, b] = label.split('-').map(Number);
      for (let t = a; t <= (b ?? a); t++) covered.add(t);
    }
    for (let t = 5; t <= 21; t++) {
      expect(covered.has(t), `hard ${t} missing from the chart`).toBe(true);
    }
  });
});

describe('rendered chart agrees with the evaluator', () => {
  it('every soft row cell matches what the evaluator would play', () => {
    for (const row of softRows()) {
      const pip = row.label.split(',')[1] as Rank;
      UPCARDS.forEach((up, i) => {
        const expected = chartAction([c('A'), c(pip)], up);
        expect(row.actions[i], `${row.label} vs ${up}`).toBe(expected);
      });
    }
  });

  it('every pair row cell matches what the evaluator would play', () => {
    for (const row of pairRows()) {
      const rank = (row.label.split(',')[0] === 'A' ? 'A' : row.label.split(',')[0]) as Rank;
      UPCARDS.forEach((up, i) => {
        const expected = chartAction([c(rank), c(rank)], up);
        expect(row.actions[i], `${row.label} vs ${up}`).toBe(expected);
      });
    }
  });

  it('every hard band cell matches the evaluator for a hand of that total', () => {
    for (const row of hardRows()) {
      const label = row.label.replace('+', '-21');
      const total = Number(label.split('-')[0]);
      // Build a hard hand of this total that is not a pair.
      const hand = total <= 11
        ? [c('2'), c(String(total - 2) as Rank)]
        : [c('10'), c(String(total - 10) as Rank)];
      UPCARDS.forEach((up, i) => {
        const expected = chartAction(hand, up);
        expect(row.actions[i], `hard ${row.label} vs ${up}`).toBe(expected);
      });
    }
  });
});
