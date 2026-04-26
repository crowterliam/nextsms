CREATE TABLE IF NOT EXISTS team_tactics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  tactic_code TEXT NOT NULL DEFAULT 'N',
  formation TEXT NOT NULL DEFAULT '442',
  aggression INTEGER NOT NULL DEFAULT 50,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(team_id, tactic_code)
);

CREATE TABLE IF NOT EXISTS team_saved_lineups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Default',
  formation TEXT NOT NULL DEFAULT '442',
  tactic_code TEXT NOT NULL DEFAULT 'N',
  lineup TEXT NOT NULL DEFAULT '[]',
  conditionals TEXT NOT NULL DEFAULT '[]',
  penalty_taker_id INTEGER,
  is_active INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS transfer_listings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  from_team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  league_id TEXT REFERENCES leagues(id),
  asking_price INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(player_id, status)
);

CREATE TABLE IF NOT EXISTS transfer_offers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  listing_id INTEGER NOT NULL REFERENCES transfer_listings(id) ON DELETE CASCADE,
  from_team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  to_team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS transfer_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  player_name TEXT NOT NULL,
  from_team_id INTEGER NOT NULL,
  from_team_name TEXT NOT NULL,
  to_team_id INTEGER NOT NULL,
  to_team_name TEXT NOT NULL,
  league_id TEXT REFERENCES leagues(id),
  amount INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

ALTER TABLE teams ADD COLUMN budget INTEGER DEFAULT 10000000;
ALTER TABLE teams ADD COLUMN default_formation TEXT DEFAULT '442';
ALTER TABLE teams ADD COLUMN default_tactic TEXT DEFAULT 'N';
ALTER TABLE teams ADD COLUMN default_aggression INTEGER DEFAULT 50;

CREATE INDEX IF NOT EXISTS idx_team_tactics_team ON team_tactics(team_id);
CREATE INDEX IF NOT EXISTS idx_team_saved_lineups_team ON team_saved_lineups(team_id);
CREATE INDEX IF NOT EXISTS idx_transfer_listings_status ON transfer_listings(status);
CREATE INDEX IF NOT EXISTS idx_transfer_listings_league ON transfer_listings(league_id);
CREATE INDEX IF NOT EXISTS idx_transfer_offers_listing ON transfer_offers(listing_id);
CREATE INDEX IF NOT EXISTS idx_transfer_log_league ON transfer_log(league_id);
