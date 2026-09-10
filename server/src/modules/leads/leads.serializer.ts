/** Row shape of `website_leads` (see migration 0043). */
export interface LeadRow {
  id: string;
  source: string;
  name: string;
  email: string;
  phone: string | null;
  postal_code: string | null;
  message: string;
  answers: Record<string, unknown>;
  consent: boolean;
  status: string;
  internal_note: string | null;
  ip_hash: string | null;
  user_agent: string | null;
  referer: string | null;
  notified_at: string | null;
  notify_error: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * What the public POST returns.
 *
 * An id and nothing else. The sender already knows what they typed, and echoing
 * the stored row back to an unauthenticated caller would turn the endpoint into
 * a way to confirm what it accepted — useful only to someone probing it.
 */
export interface LeadAccepteDto {
  id: string;
  ok: true;
}

/** What the admin console reads. Everything, including why a mail failed. */
export interface AdminLeadDto {
  id: string;
  source: string;
  nom: string;
  email: string;
  telephone: string | null;
  codePostal: string | null;
  message: string;
  reponses: Record<string, unknown>;
  consentement: boolean;
  statut: string;
  noteInterne: string | null;
  userAgent: string | null;
  referer: string | null;
  notifieLe: string | null;
  erreurNotification: string | null;
  creeLe: string;
}

/**
 * `ip_hash` is deliberately absent from every DTO. It exists to answer one
 * question — how many submissions came from this connection in the last hour —
 * and nothing downstream has a reason to read it.
 */
export function toAdminLead(row: LeadRow): AdminLeadDto {
  return {
    id: row.id,
    source: row.source,
    nom: row.name,
    email: row.email,
    telephone: row.phone,
    codePostal: row.postal_code,
    message: row.message,
    reponses: row.answers ?? {},
    consentement: row.consent,
    statut: row.status,
    noteInterne: row.internal_note,
    userAgent: row.user_agent,
    referer: row.referer,
    notifieLe: row.notified_at,
    erreurNotification: row.notify_error,
    creeLe: row.created_at,
  };
}
