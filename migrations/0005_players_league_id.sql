ALTER TABLE players ADD COLUMN league_id TEXT REFERENCES leagues(id);
CREATE INDEX IF NOT EXISTS idx_players_league ON players(league_id);
