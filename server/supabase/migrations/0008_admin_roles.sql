-- ============================================================================
-- Iteration 8: granular admin roles + enhanced activity log
-- ============================================================================

-- New admin roles (postgres enum ADD VALUE is irreversible but safe)
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'manager';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'editor';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'support';

-- Add richer context columns to activity_log
ALTER TABLE activity_log
  ADD COLUMN IF NOT EXISTS actor_email text,
  ADD COLUMN IF NOT EXISTS ip_address  text,
  ADD COLUMN IF NOT EXISTS action      text;  -- CREATE | UPDATE | DELETE | LOGIN | LOGOUT | OTHER

-- Faster per-user activity feeds
CREATE INDEX IF NOT EXISTS idx_activity_actor ON activity_log(actor_id, created_at DESC);
