-- ============================================================================
-- Support tickets — customers signal problems, admins triage & resolve.
-- ============================================================================

CREATE TYPE ticket_status   AS ENUM ('ouvert', 'en_cours', 'resolu', 'ferme');
CREATE TYPE ticket_priority AS ENUM ('basse', 'normale', 'haute', 'urgente');
CREATE TYPE ticket_category AS ENUM (
  'commande', 'livraison', 'produit', 'paiement', 'autre'
);

CREATE TABLE tickets (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number text NOT NULL UNIQUE,
  profile_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  subject       text NOT NULL,
  category      ticket_category NOT NULL DEFAULT 'autre',
  description   text NOT NULL,
  status        ticket_status NOT NULL DEFAULT 'ouvert',
  priority      ticket_priority NOT NULL DEFAULT 'normale',
  order_id      uuid REFERENCES orders(id) ON DELETE SET NULL,
  last_reply_at timestamptz,
  unread_admin  int NOT NULL DEFAULT 0,
  unread_customer int NOT NULL DEFAULT 0,
  resolved_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tickets_profile ON tickets(profile_id);
CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_created ON tickets(created_at DESC);
CREATE TRIGGER trg_tickets_updated BEFORE UPDATE ON tickets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE ticket_messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id  uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  sender     msg_sender NOT NULL,          -- 'customer' | 'admin'
  sender_id  uuid REFERENCES profiles(id),
  content    text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ticket_messages_ticket ON ticket_messages(ticket_id, created_at);

-- ── RLS: owner-scoped reads; writes via service role ────────────────────────
ALTER TABLE tickets         ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY tickets_owner_read ON tickets
  FOR SELECT USING (auth.uid() = profile_id);
CREATE POLICY ticket_messages_owner_read ON ticket_messages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM tickets t WHERE t.id = ticket_id AND t.profile_id = auth.uid())
  );
