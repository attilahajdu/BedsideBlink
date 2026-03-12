-- BedsideBlink config table
-- Run this in Supabase SQL Editor: Dashboard → SQL Editor → New query

CREATE TABLE IF NOT EXISTS bedsideblink_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS (Row Level Security)
ALTER TABLE bedsideblink_config ENABLE ROW LEVEL SECURITY;

-- Policy: allow all for anon (simple single-tenant; restrict in production if needed)
CREATE POLICY "Allow public read write" ON bedsideblink_config
  FOR ALL USING (true) WITH CHECK (true);

-- Index for single-row lookup
CREATE INDEX IF NOT EXISTS idx_bedsideblink_config_id ON bedsideblink_config(id);

-- Seed one row for single-tenant usage (upsert will target this id)
INSERT INTO bedsideblink_config (id, config)
VALUES ('11111111-1111-1111-1111-111111111111'::uuid, '{}')
ON CONFLICT (id) DO NOTHING;
