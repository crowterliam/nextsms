CREATE TABLE IF NOT EXISTS seasons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  league_id TEXT NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  season_number INTEGER NOT NULL DEFAULT 1,
  name TEXT NOT NULL DEFAULT 'Season 1',
  status TEXT NOT NULL DEFAULT 'setup' CHECK(status IN ('setup','active','completed','archived')),
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_seasons_league_number ON seasons(league_id, season_number);
CREATE INDEX IF NOT EXISTS idx_seasons_league ON seasons(league_id);

CREATE TABLE IF NOT EXISTS divisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  league_id TEXT NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  season_id INTEGER NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 1,
  promotion_spots INTEGER NOT NULL DEFAULT 0,
  relegation_spots INTEGER NOT NULL DEFAULT 0,
  playoff_spots INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_divisions_league_season_level ON divisions(league_id, season_id, level);
CREATE INDEX IF NOT EXISTS idx_divisions_season ON divisions(season_id);

CREATE TABLE IF NOT EXISTS division_teams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  division_id INTEGER NOT NULL REFERENCES divisions(id) ON DELETE CASCADE,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  season_id INTEGER NOT NULL REFERENCES seasons(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_division_teams_unique ON division_teams(division_id, team_id);
CREATE INDEX IF NOT EXISTS idx_division_teams_team ON division_teams(team_id);

CREATE TABLE IF NOT EXISTS competitions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  league_id TEXT NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  season_id INTEGER NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  division_id INTEGER REFERENCES divisions(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'league' CHECK(type IN ('league','cup','supercup','shield','playoff','friendly')),
  format TEXT NOT NULL DEFAULT 'round_robin' CHECK(format IN ('round_robin','knockout','group_knockout','two_legged_knockout')),
  status TEXT NOT NULL DEFAULT 'setup' CHECK(status IN ('setup','active','completed','archived')),
  settings TEXT DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_competitions_league_season ON competitions(league_id, season_id);
CREATE INDEX IF NOT EXISTS idx_competitions_season ON competitions(season_id);

CREATE TABLE IF NOT EXISTS competition_stages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  competition_id INTEGER NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  stage_order INTEGER NOT NULL DEFAULT 1,
  format TEXT NOT NULL DEFAULT 'round_robin' CHECK(format IN ('round_robin','knockout','group_knockout','two_legged_knockout')),
  num_groups INTEGER NOT NULL DEFAULT 0,
  teams_advancing INTEGER NOT NULL DEFAULT 0,
  num_legs INTEGER NOT NULL DEFAULT 1,
  config TEXT DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'setup' CHECK(status IN ('setup','active','completed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_comp_stages_comp ON competition_stages(competition_id);

CREATE TABLE IF NOT EXISTS competition_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stage_id INTEGER NOT NULL REFERENCES competition_stages(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'A'
);
CREATE INDEX IF NOT EXISTS idx_comp_groups_stage ON competition_groups(stage_id);

CREATE TABLE IF NOT EXISTS competition_group_teams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER NOT NULL REFERENCES competition_groups(id) ON DELETE CASCADE,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  seed_position INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cgt_unique ON competition_group_teams(group_id, team_id);

CREATE TABLE IF NOT EXISTS competition_fixtures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  competition_id INTEGER NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  stage_id INTEGER NOT NULL REFERENCES competition_stages(id) ON DELETE CASCADE,
  group_id INTEGER REFERENCES competition_groups(id) ON DELETE SET NULL,
  home_team_id INTEGER NOT NULL REFERENCES teams(id),
  away_team_id INTEGER NOT NULL REFERENCES teams(id),
  match_id INTEGER REFERENCES matches(id),
  round_name TEXT,
  leg INTEGER NOT NULL DEFAULT 1,
  bracket_position INTEGER,
  scheduled_week INTEGER,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','played','postponed','cancelled'))
);
CREATE INDEX IF NOT EXISTS idx_comp_fixtures_comp ON competition_fixtures(competition_id);
CREATE INDEX IF NOT EXISTS idx_comp_fixtures_stage ON competition_fixtures(stage_id);
CREATE INDEX IF NOT EXISTS idx_comp_fixtures_group ON competition_fixtures(group_id);

CREATE TABLE IF NOT EXISTS competition_standings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  competition_id INTEGER NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  stage_id INTEGER NOT NULL REFERENCES competition_stages(id) ON DELETE CASCADE,
  group_id INTEGER REFERENCES competition_groups(id) ON DELETE SET NULL,
  team_id INTEGER NOT NULL REFERENCES teams(id),
  played INTEGER NOT NULL DEFAULT 0,
  won INTEGER NOT NULL DEFAULT 0,
  drawn INTEGER NOT NULL DEFAULT 0,
  lost INTEGER NOT NULL DEFAULT 0,
  goals_for INTEGER NOT NULL DEFAULT 0,
  goals_against INTEGER NOT NULL DEFAULT 0,
  goal_difference INTEGER NOT NULL DEFAULT 0,
  points INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_comp_standings_unique ON competition_standings(competition_id, stage_id, group_id, team_id);

CREATE TABLE IF NOT EXISTS season_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  league_id TEXT NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  season_id INTEGER NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  division_id INTEGER REFERENCES divisions(id),
  data TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_season_history_league ON season_history(league_id);
CREATE INDEX IF NOT EXISTS idx_season_history_season ON season_history(season_id);

INSERT INTO seasons (league_id, season_number, name, status, started_at)
SELECT id, season, 'Season ' || season,
  CASE WHEN status = 'setup' THEN 'setup'
       WHEN status = 'active' THEN 'active'
       ELSE 'completed' END,
  created_at
FROM leagues;
