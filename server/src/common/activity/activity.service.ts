import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export type ActivityKind =
  | 'order'
  | 'quote'
  | 'message'
  | 'product'
  | 'customer'
  | 'auth'
  | 'campaign'
  | 'system';

export interface LogActivityOpts {
  kind: ActivityKind;
  actorId?: string;
  actorEmail?: string;
  summary: string;
  entityRef?: string;
  action?: string;
  meta?: Record<string, unknown>;
  ipAddress?: string;
}

@Injectable()
export class ActivityService {
  constructor(private readonly supabase: SupabaseService) {}

  async log(opts: LogActivityOpts): Promise<void> {
    await this.supabase.client.from('activity_log').insert({
      kind: opts.kind,
      actor_id: opts.actorId ?? null,
      actor_email: opts.actorEmail ?? null,
      summary: opts.summary,
      entity_ref: opts.entityRef ?? null,
      action: opts.action ?? null,
      meta: opts.meta ?? {},
      ip_address: opts.ipAddress ?? null,
    });
  }

  async listForAdmin(opts: {
    actorId?: string;
    kind?: ActivityKind;
    limit?: number;
    offset?: number;
  }) {
    let query = this.supabase.client
      .from('activity_log')
      .select('id, kind, actor_id, actor_email, summary, entity_ref, action, ip_address, meta, created_at')
      .order('created_at', { ascending: false })
      .limit(opts.limit ?? 50)
      .range(opts.offset ?? 0, (opts.offset ?? 0) + (opts.limit ?? 50) - 1);

    if (opts.actorId) query = query.eq('actor_id', opts.actorId);
    if (opts.kind) query = query.eq('kind', opts.kind);

    const { data } = await query;
    return (data ?? []).map((row: Record<string, unknown>) => ({
      id: row.id as string,
      kind: row.kind as ActivityKind,
      actorId: (row.actor_id as string) ?? null,
      actorEmail: (row.actor_email as string) ?? null,
      summary: row.summary as string,
      entityRef: (row.entity_ref as string) ?? null,
      action: (row.action as string) ?? null,
      ipAddress: (row.ip_address as string) ?? null,
      meta: (row.meta as Record<string, unknown>) ?? {},
      createdAt: row.created_at as string,
    }));
  }
}
