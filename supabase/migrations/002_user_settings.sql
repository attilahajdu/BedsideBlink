-- User-scoped settings backup (cloud). One row per authenticated user.
-- Normal user flow uses local device state; this table is for explicit "Save to cloud" / "Load from cloud" only.
-- Run in Supabase SQL Editor after enabling Email auth (and OTP if used).

CREATE TABLE IF NOT EXISTS user_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  settings jsonb NOT NULL DEFAULT '{}',
  schema_version integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Users may only read/write their own row. Identity from auth.uid() only; never client-supplied user_id.
CREATE POLICY "Users can select own row" ON user_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own row" ON user_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own row" ON user_settings
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_settings_updated_at ON user_settings(updated_at);

COMMENT ON TABLE user_settings IS 'Per-user cloud backup of local device settings; accessed only via explicit Save to cloud / Load from cloud.';
