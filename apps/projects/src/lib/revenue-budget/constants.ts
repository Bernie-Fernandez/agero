export const MONTH_KEYS_FY27 = [
  'jul26', 'aug26', 'sep26', 'oct26', 'nov26', 'dec26',
  'jan27', 'feb27', 'mar27', 'apr27', 'may27', 'jun27',
] as const;

export const MONTH_KEYS_FY28 = [
  'jul27b', 'aug27b', 'sep27b', 'oct27b', 'nov27b', 'dec27b',
  'jan28', 'feb28', 'mar28', 'apr28', 'may28', 'jun28',
] as const;

export const ALL_MONTH_KEYS = [...MONTH_KEYS_FY27, ...MONTH_KEYS_FY28] as const;

export type MonthKey = typeof ALL_MONTH_KEYS[number];
export type MonthlyData = Partial<Record<MonthKey, number>>;

export const MONTH_LABELS: Record<MonthKey, string> = {
  jul26: 'Jul 26', aug26: 'Aug 26', sep26: 'Sep 26', oct26: 'Oct 26',
  nov26: 'Nov 26', dec26: 'Dec 26', jan27: 'Jan 27', feb27: 'Feb 27',
  mar27: 'Mar 27', apr27: 'Apr 27', may27: 'May 27', jun27: 'Jun 27',
  jul27b: 'Jul 27', aug27b: 'Aug 27', sep27b: 'Sep 27', oct27b: 'Oct 27',
  nov27b: 'Nov 27', dec27b: 'Dec 27', jan28: 'Jan 28', feb28: 'Feb 28',
  mar28: 'Mar 28', apr28: 'Apr 28', may28: 'May 28', jun28: 'Jun 28',
};
