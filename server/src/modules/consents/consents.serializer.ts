/** Row shape of `website_consents` (see migration 0044). */
export interface ConsentRow {
  id: string;
  consent_id: string;
  version: string;
  action: string;
  choices: { mesure?: boolean; marketing?: boolean };
  page: string | null;
  ip_hash: string | null;
  user_agent: string | null;
  created_at: string;
}

/** What the admin lookup returns. `ip_hash` is deliberately absent, as in leads. */
export interface AdminConsentDto {
  id: string;
  consentId: string;
  version: string;
  action: string;
  choix: { mesure: boolean; marketing: boolean };
  page: string | null;
  userAgent: string | null;
  creeLe: string;
}

export function toAdminConsent(row: ConsentRow): AdminConsentDto {
  return {
    id: row.id,
    consentId: row.consent_id,
    version: row.version,
    action: row.action,
    choix: {
      mesure: row.choices?.mesure === true,
      marketing: row.choices?.marketing === true,
    },
    page: row.page,
    userAgent: row.user_agent,
    creeLe: row.created_at,
  };
}
