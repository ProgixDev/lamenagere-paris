/** Row shape of `website_briefs` (see migration 0028). */
export interface BriefRow {
  id: string;
  slug: string;
  token: string;
  client_name: string | null;
  client_email: string | null;
  client_phone: string | null;
  company: string | null;
  status: string;
  answers: Record<string, unknown>;
  selected_tier: string | null;
  estimated_total_cents: number | null;
  progress_pct: number;
  domain_wish: string | null;
  timeline: string | null;
  budget_range: string | null;
  validated: boolean;
  first_seen_at: string | null;
  last_seen_at: string | null;
  submitted_at: string | null;
  user_agent: string | null;
  ip_address: string | null;
  internal_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface BriefEventRow {
  id: string;
  kind: string;
  question_key: string | null;
  value: unknown;
  occurred_at: string;
}

/** What the questionnaire page itself is allowed to see. */
export interface PublicBriefDto {
  slug: string;
  clientName: string | null;
  company: string | null;
  status: string;
  answers: Record<string, unknown>;
  selectedTier: string | null;
  progressPct: number;
  domainWish: string | null;
  timeline: string | null;
  budgetRange: string | null;
  validated: boolean;
  submittedAt: string | null;
}

/** What the owner console sees — everything, plus the shareable link parts. */
export interface OwnerBriefDto extends PublicBriefDto {
  id: string;
  token: string;
  clientEmail: string | null;
  clientPhone: string | null;
  estimatedTotalCents: number | null;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  userAgent: string | null;
  internalNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BriefEventDto {
  id: string;
  kind: string;
  questionKey: string | null;
  value: unknown;
  occurredAt: string;
}

export function toPublicBrief(row: BriefRow): PublicBriefDto {
  return {
    slug: row.slug,
    clientName: row.client_name,
    company: row.company,
    status: row.status,
    answers: row.answers ?? {},
    selectedTier: row.selected_tier,
    progressPct: row.progress_pct,
    domainWish: row.domain_wish,
    timeline: row.timeline,
    budgetRange: row.budget_range,
    validated: row.validated,
    submittedAt: row.submitted_at,
  };
}

export function toOwnerBrief(row: BriefRow): OwnerBriefDto {
  return {
    ...toPublicBrief(row),
    id: row.id,
    token: row.token,
    clientEmail: row.client_email,
    clientPhone: row.client_phone,
    estimatedTotalCents: row.estimated_total_cents,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    userAgent: row.user_agent,
    internalNote: row.internal_note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toBriefEvent(row: BriefEventRow): BriefEventDto {
  return {
    id: row.id,
    kind: row.kind,
    questionKey: row.question_key,
    value: row.value,
    occurredAt: row.occurred_at,
  };
}
