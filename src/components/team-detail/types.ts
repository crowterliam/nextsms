export interface TeamData {
  id: number;
  name: string;
  abbreviation: string;
  budget: number;
  default_formation: string;
  default_tactic: string;
  default_aggression: number;
  manager_user_id?: string;
}

export interface Player {
  id: number;
  name: string;
  age: number;
  nationality: string;
  pref_side: string;
  st: number;
  tk: number;
  ps: number;
  sh: number;
  sm: number;
  ag: number;
  games: number;
  goals: number;
  assists: number;
  saves: number;
  tackles: number;
  keypasses: number;
  shots: number;
  dp: number;
  injury: number;
  suspension: number;
  fitness: number;
}

export interface Tactic {
  id: number;
  tactic_code: string;
  formation: string;
  aggression: number;
  is_default: number;
}

export interface SavedLineup {
  id: number;
  name: string;
  formation: string;
  tactic_code: string;
  aggression: number;
  lineup: string;
  conditionals: string;
  is_active: number;
}

export interface CondForm {
  actionType: 'TACTIC' | 'CHANGEPOS' | 'SUB';
  tacticCode: string;
  positionOut: string;
  newPosition: string;
  playerIn: string;
  conditions: Array<{ type: 'MIN' | 'SCORE' | 'YELLOW' | 'RED' | 'INJ'; sign: string; value: string; ref: string }>;
}
