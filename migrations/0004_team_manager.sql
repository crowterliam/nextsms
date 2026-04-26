ALTER TABLE teams ADD COLUMN manager_user_id TEXT REFERENCES "user"(id);
CREATE INDEX IF NOT EXISTS idx_teams_manager ON teams(manager_user_id);
