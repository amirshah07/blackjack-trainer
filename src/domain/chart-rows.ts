import { HARD_TOTALS, SOFT_TOTALS, PAIRS, type Action } from './strategy';

/**
 * Row models for the chart overlay.
 *
 * Kept beside the tables (rather than in the component) so the collapsing
 * logic is unit-testable - a mis-collapsed row would silently misrepresent
 * the strategy on screen while the evaluator stayed correct.
 */
export type ChartRow = { label: string; actions: readonly Action[] };

/** Collapses consecutive identical rows into ranges, as the source chart does. */
export function collapseRows(rows: ChartRow[]): ChartRow[] {
  const out: ChartRow[] = [];
  for (const row of rows) {
    const prev = out[out.length - 1];
    const same = prev && prev.actions.every((a, i) => a === row.actions[i]);
    if (same) {
      const [start] = prev.label.split('-');
      prev.label = `${start}-${row.label}`;
    } else {
      out.push({ ...row });
    }
  }
  return out;
}

export function hardRows(): ChartRow[] {
  const rows: ChartRow[] = [];
  for (let total = 5; total <= 21; total++) {
    const actions = HARD_TOTALS[total];
    if (actions) rows.push({ label: String(total), actions });
  }
  const collapsed = collapseRows(rows);
  // The source chart labels the top band "17+" rather than "17-21".
  const last = collapsed[collapsed.length - 1];
  if (last && last.label.endsWith('-21')) last.label = `${last.label.split('-')[0]}+`;
  return collapsed;
}

export function softRows(): ChartRow[] {
  return Object.entries(SOFT_TOTALS).map(([pip, actions]) => ({
    label: `A,${pip}`,
    actions,
  }));
}

export function pairRows(): ChartRow[] {
  return Object.entries(PAIRS).map(([rank, actions]) => ({
    label: rank === '11' ? 'A,A' : `${rank},${rank}`,
    actions,
  }));
}
