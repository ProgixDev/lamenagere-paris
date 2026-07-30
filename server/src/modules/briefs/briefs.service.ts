import { randomBytes, timingSafeEqual } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../../common/supabase/supabase.service';
import {
  BriefEventRow,
  BriefRow,
  OwnerBriefDto,
  PublicBriefDto,
  toBriefEvent,
  toOwnerBrief,
  toPublicBrief,
} from './briefs.serializer';
import {
  CreateBriefDto,
  SaveBriefDto,
  SubmitBriefDto,
  UpdateBriefDto,
} from './dto/brief.dto';

/** Constant-time string comparison — secrets travel in the query string. */
function secretEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

@Injectable()
export class BriefsService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService,
  ) {}

  // ── Prospect side (slug + token) ──────────────────────────────────────────

  /**
   * Opening the questionnaire. Stamps the first/last visit so the owner console
   * can show "en train de répondre" without the prospect doing anything.
   */
  async open(
    slug: string,
    token: string,
    ip: string,
    userAgent: string,
  ): Promise<PublicBriefDto> {
    const row = await this.loadByToken(slug, token);
    const now = new Date().toISOString();
    const { data } = await this.supabase.client
      .from('website_briefs')
      .update({
        first_seen_at: row.first_seen_at ?? now,
        last_seen_at: now,
        ip_address: ip ?? null,
        user_agent: userAgent?.slice(0, 500) ?? null,
      })
      .eq('id', row.id)
      .select('*')
      .single<BriefRow>();
    await this.recordEvents(row.id, [{ kind: 'view' }]);
    return toPublicBrief(data ?? row);
  }

  /** Debounced autosave. Answers are merged key by key, never replaced. */
  async save(
    slug: string,
    token: string,
    dto: SaveBriefDto,
  ): Promise<PublicBriefDto> {
    const row = await this.loadByToken(slug, token);
    if (row.status !== 'draft') {
      throw new BadRequestException('Ce questionnaire a déjà été validé');
    }
    const { data } = await this.supabase.client
      .from('website_briefs')
      .update(this.patch(row, dto))
      .eq('id', row.id)
      .select('*')
      .single<BriefRow>();
    await this.recordEvents(row.id, dto.events);
    return toPublicBrief(data ?? row);
  }

  /** Final step: contact details + status flip. */
  async submit(
    slug: string,
    token: string,
    dto: SubmitBriefDto,
  ): Promise<PublicBriefDto> {
    const row = await this.loadByToken(slug, token);
    const now = new Date().toISOString();
    const { data, error } = await this.supabase.client
      .from('website_briefs')
      .update({
        ...this.patch(row, dto),
        client_name: dto.clientName ?? row.client_name,
        client_email: dto.clientEmail ?? row.client_email,
        client_phone: dto.clientPhone ?? row.client_phone,
        company: dto.company ?? row.company,
        domain_wish: dto.domainWish ?? row.domain_wish,
        timeline: dto.timeline ?? row.timeline,
        budget_range: dto.budgetRange ?? row.budget_range,
        validated: dto.validated ?? true,
        status: 'submitted',
        submitted_at: row.submitted_at ?? now,
      })
      .eq('id', row.id)
      .select('*')
      .single<BriefRow>();
    if (error || !data) {
      throw new BadRequestException(error?.message ?? 'Validation impossible');
    }
    await this.recordEvents(row.id, [
      ...(dto.events ?? []),
      { kind: 'submit' as const },
    ]);
    return toPublicBrief(data);
  }

  // ── Owner side (BRIEF_OWNER_KEY) ──────────────────────────────────────────

  async list(key: string): Promise<OwnerBriefDto[]> {
    this.assertOwner(key);
    const { data } = await this.supabase.client
      .from('website_briefs')
      .select('*')
      .order('updated_at', { ascending: false })
      .returns<BriefRow[]>();
    return (data ?? []).map(toOwnerBrief);
  }

  /** Full brief plus its answer timeline — the detail view of reponses.html. */
  async full(key: string, slug: string) {
    this.assertOwner(key);
    const row = await this.loadBySlug(slug);
    const { data: events } = await this.supabase.client
      .from('website_brief_events')
      .select('id, kind, question_key, value, occurred_at')
      .eq('brief_id', row.id)
      .order('occurred_at', { ascending: false })
      .limit(500)
      .returns<BriefEventRow[]>();
    return {
      brief: toOwnerBrief(row),
      events: (events ?? []).map(toBriefEvent),
    };
  }

  async create(key: string, dto: CreateBriefDto): Promise<OwnerBriefDto> {
    this.assertOwner(key);
    const slug = dto.slug ?? randomBytes(5).toString('hex');
    const { data, error } = await this.supabase.client
      .from('website_briefs')
      .insert({
        slug,
        token: randomBytes(24).toString('base64url'),
        client_name: dto.clientName ?? null,
        client_email: dto.clientEmail ?? null,
        client_phone: dto.clientPhone ?? null,
        company: dto.company ?? null,
      })
      .select('*')
      .single<BriefRow>();
    if (error || !data) {
      // 23505 = unique_violation on slug.
      throw new BadRequestException(
        error?.code === '23505'
          ? `Le lien « ${slug} » existe déjà`
          : (error?.message ?? 'Création du questionnaire impossible'),
      );
    }
    return toOwnerBrief(data);
  }

  async update(
    key: string,
    slug: string,
    dto: UpdateBriefDto,
  ): Promise<OwnerBriefDto> {
    this.assertOwner(key);
    const row = await this.loadBySlug(slug);
    const { data, error } = await this.supabase.client
      .from('website_briefs')
      .update({
        status: dto.status ?? row.status,
        internal_note: dto.internalNote ?? row.internal_note,
      })
      .eq('id', row.id)
      .select('*')
      .single<BriefRow>();
    if (error || !data) {
      throw new BadRequestException(error?.message ?? 'Mise à jour impossible');
    }
    return toOwnerBrief(data);
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  /** Shared field mapping for autosave and submit. */
  private patch(row: BriefRow, dto: SaveBriefDto) {
    return {
      answers: { ...(row.answers ?? {}), ...(dto.answers ?? {}) },
      selected_tier: dto.selectedTier ?? row.selected_tier,
      estimated_total_cents:
        dto.estimatedTotalCents ?? row.estimated_total_cents,
      progress_pct: dto.progressPct ?? row.progress_pct,
      last_seen_at: new Date().toISOString(),
    };
  }

  private async recordEvents(
    briefId: string,
    events: SaveBriefDto['events'],
  ): Promise<void> {
    if (!events?.length) return;
    await this.supabase.client.from('website_brief_events').insert(
      events.slice(0, 100).map((e) => ({
        brief_id: briefId,
        kind: e.kind,
        question_key: e.questionKey ?? null,
        value: e.value ?? null,
      })),
    );
  }

  private async loadBySlug(slug: string): Promise<BriefRow> {
    const { data } = await this.supabase.client
      .from('website_briefs')
      .select('*')
      .eq('slug', slug)
      .maybeSingle<BriefRow>();
    if (!data) throw new NotFoundException('Questionnaire introuvable');
    return data;
  }

  /**
   * A wrong token is indistinguishable from a wrong slug on purpose: the link
   * is the only credential, so we never confirm that a brief exists.
   */
  private async loadByToken(slug: string, token: string): Promise<BriefRow> {
    const { data } = await this.supabase.client
      .from('website_briefs')
      .select('*')
      .eq('slug', slug)
      .maybeSingle<BriefRow>();
    if (!data || !token || !secretEquals(data.token, token)) {
      throw new NotFoundException('Questionnaire introuvable');
    }
    return data;
  }

  private assertOwner(key: string): void {
    const expected = this.config.get<string>('BRIEF_OWNER_KEY') ?? '';
    if (!expected || !key || !secretEquals(expected, key)) {
      throw new UnauthorizedException('Clé d’accès invalide');
    }
  }
}
