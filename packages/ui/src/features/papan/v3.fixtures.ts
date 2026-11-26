// Sample data from the Hari-ini-v3 board. Stories and tests only, never production code.
import type { HistogramBin, TrendPoint } from './v3';

const DAYS = [6, 7, 8, 11, 12, 13, 14, 15, 18, 19, 20, 21, 22, 25];
const RATES = [0.951, 0.955, 0.938, 0.953, 0.961, 0.958, 0.952, 0.954, 0.961, 0.954, 0.951, 0.959, 0.954, 0.958];

export const TREND: TrendPoint[] = DAYS.map((d, i) => ({ label: String(d), title: `${d} Jan`, value: RATES[i] ?? null }));

export const ARRIVALS: HistogramBin[] = [
  { label: '06.00', count: 41 },
  { label: '06.15', count: 118 },
  { label: '06.30', count: 247 },
  { label: '06.45', count: 456 },
  { label: '07.00', count: 9, late: true },
  { label: '07.15', count: 5, late: true },
];
