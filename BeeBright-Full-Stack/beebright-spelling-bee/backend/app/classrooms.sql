CREATE TABLE IF NOT EXISTS classrooms (
 id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, name TEXT NOT NULL,
 code TEXT NOT NULL UNIQUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS classroom_members (
 class_id TEXT NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL, display_name TEXT NOT NULL,
 joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY(class_id,user_id)
);
CREATE TABLE IF NOT EXISTS account_studio (
 user_id TEXT PRIMARY KEY, data JSONB NOT NULL DEFAULT '{}',
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS classroom_activity (
 user_id TEXT PRIMARY KEY, activity JSONB NOT NULL,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS desktop_sessions (
 token_hash TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, user_id TEXT,
 expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS classroom_members_user_idx ON classroom_members(user_id);
CREATE INDEX IF NOT EXISTS classrooms_owner_idx ON classrooms(owner_id);
