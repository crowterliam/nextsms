export const SKILL_COLS = [
  { key: 'st', label: 'ST' },
  { key: 'tk', label: 'TK' },
  { key: 'ps', label: 'PS' },
  { key: 'sh', label: 'SH' },
  { key: 'sm', label: 'SM' },
  { key: 'ag', label: 'AG' },
] as const;

export const TACTIC_NAMES: Record<string, string> = {
  N: 'Normal', D: 'Defensive', A: 'Attacking', C: 'Counter-Attack', L: 'Long Ball', P: 'Passing',
};

export const FORMATIONS = ['433', '442', '451', '352', '343', '532', '541', '4231', '4141', '4222', '3511', '3412'];

export const POSITIONS = ['GK', 'DFL', 'DFC', 'DFR', 'DML', 'DMC', 'DMR', 'MFL', 'MFC', 'MFR', 'AML', 'AMC', 'AMR', 'FWL', 'FWC', 'FWR'];

export const SIGN_OPTIONS = [
  { value: '=', label: '=' },
  { value: '>=', label: '>=' },
  { value: '>', label: '>' },
  { value: '<=', label: '<=' },
  { value: '<', label: '<' },
];

export type Tab = 'squad' | 'tactics' | 'lineups' | 'conditionals' | 'transfers';
