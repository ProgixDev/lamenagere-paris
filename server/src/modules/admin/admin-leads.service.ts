import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import {
  AdminLeadDto,
  LeadRow,
  toAdminLead,
} from '../leads/leads.serializer';

/**
 * Reading and triaging the contact-form submissions.
 *
 * Separate from the public `LeadsModule` on purpose: writing is open to the
 * world and reading is not, and keeping the two in one controller is how a
 * `@Public()` decorator ends up on a route that lists everyone's messages.
 */
@Injectable()
export class AdminLeadsService {
  constructor(private readonly supabase: SupabaseService) {}

  async list(statut?: string): Promise<AdminLeadDto[]> {
    let requete = this.supabase.client
      .from('website_leads')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    if (statut) requete = requete.eq('status', statut);

    const { data } = await requete.returns<LeadRow[]>();
    return (data ?? []).map(toAdminLead);
  }

  async detail(id: string): Promise<AdminLeadDto> {
    const { data } = await this.supabase.client
      .from('website_leads')
      .select('*')
      .eq('id', id)
      .maybeSingle<LeadRow>();

    if (!data) throw new NotFoundException('Demande introuvable');
    return toAdminLead(data);
  }

  async update(
    id: string,
    champs: { statut?: string; noteInterne?: string },
  ): Promise<AdminLeadDto> {
    const patch: Record<string, unknown> = {};
    if (champs.statut !== undefined) patch.status = champs.statut;
    if (champs.noteInterne !== undefined) patch.internal_note = champs.noteInterne;

    const { data } = await this.supabase.client
      .from('website_leads')
      .update(patch)
      .eq('id', id)
      .select('*')
      .maybeSingle<LeadRow>();

    if (!data) throw new NotFoundException('Demande introuvable');
    return toAdminLead(data);
  }
}
