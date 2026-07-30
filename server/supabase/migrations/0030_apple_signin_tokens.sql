-- ============================================================================
-- Iteration 30: Apple token revocation on account deletion.
--
-- Apple requires apps that offer Sign in with Apple AND account deletion to
-- revoke the user's token when they delete their account (checked in review).
-- Revocation needs the refresh token Apple issues once, in exchange for the
-- authorization code handed to the client at sign-in — so we capture it then
-- and keep it until deletion.
--
-- Deliberately NOT a column on `profiles`: the `profiles_self_select` policy
-- lets any authenticated client read its own profile row in full, which would
-- hand the refresh token to the device. This table enables RLS and defines no
-- policies at all, so only the service role (which bypasses RLS, and is the
-- only client the NestJS API uses for queries) can read or write it.
-- ============================================================================

CREATE TABLE apple_auth_tokens (
  profile_id    uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  refresh_token text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE apple_auth_tokens ENABLE ROW LEVEL SECURITY;
-- No policies on purpose — see the header. Service role only.

CREATE TRIGGER trg_apple_auth_tokens_updated
  BEFORE UPDATE ON apple_auth_tokens
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
