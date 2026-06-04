import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { DevicesService } from '../notifications/devices.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UpsertCampaignDto } from './dto/campaign-admin.dto';

interface CampaignRow {
  id: string;
  name: string;
  title: string | null;
  body: string | null;
  audience: { accountType?: 'particulier' | 'professionnel'; territory?: string };
  link: Record<string, string> | null;
  status: 'draft' | 'scheduled' | 'sent' | 'archived';
  scheduled_at: string | null;
  sent_at: string | null;
  sent_count: number;
  created_at: string;
}

@Injectable()
export class AdminCampaignsService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly devices: DevicesService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(status?: string): Promise<CampaignRow[]> {
    let q = this.supabase.client.from('campaigns').select('*');
    if (status) q = q.eq('status', status);
    const { data } = await q
      .order('created_at', { ascending: false })
      .returns<CampaignRow[]>();
    return data ?? [];
  }

  async get(id: string): Promise<CampaignRow> {
    const { data } = await this.supabase.client
      .from('campaigns')
      .select('*')
      .eq('id', id)
      .maybeSingle<CampaignRow>();
    if (!data) throw new NotFoundException('Campagne introuvable');
    return data;
  }

  async create(dto: UpsertCampaignDto): Promise<CampaignRow> {
    const { data, error } = await this.supabase.client
      .from('campaigns')
      .insert(this.row(dto))
      .select('*')
      .single<CampaignRow>();
    if (error || !data) throw new BadRequestException('Création impossible');
    return data;
  }

  async update(id: string, dto: UpsertCampaignDto): Promise<CampaignRow> {
    await this.get(id);
    const { data, error } = await this.supabase.client
      .from('campaigns')
      .update(this.row(dto))
      .eq('id', id)
      .select('*')
      .single<CampaignRow>();
    if (error || !data) throw new BadRequestException('Mise à jour impossible');
    return data;
  }

  async remove(id: string): Promise<void> {
    await this.supabase.client.from('campaigns').delete().eq('id', id);
  }

  /** Resolve audience, deliver, record per-recipient results, mark sent. */
  async send(id: string): Promise<{ sent: number; failed: number }> {
    const campaign = await this.get(id);
    if (!campaign.title || !campaign.body) {
      throw new BadRequestException('Titre et message requis avant l’envoi');
    }

    const tokens = await this.devices.tokensForAudience(campaign.audience ?? {});
    const result = await this.notifications.send(tokens, {
      title: campaign.title,
      body: campaign.body,
      data: campaign.link ?? {},
    });

    if (result.results.length) {
      await this.supabase.client.from('campaign_deliveries').insert(
        result.results.map((r) => ({
          campaign_id: id,
          device_token_id: r.tokenId,
          status: r.status,
          error: r.error,
        })),
      );
    }

    await this.supabase.client
      .from('campaigns')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        sent_count: result.sent,
      })
      .eq('id', id);

    // Activity feed entry.
    await this.supabase.client.from('activity_log').insert({
      kind: 'campaign',
      entity_ref: id,
      summary: `Campagne « ${campaign.name} » envoyée (${result.sent})`,
    });

    return { sent: result.sent, failed: result.failed };
  }

  /** Send the campaign to the admin's own devices only (preview). */
  async test(id: string, adminId: string): Promise<{ sent: number }> {
    const campaign = await this.get(id);
    const tokens = await this.devices.tokensForProfiles([adminId]);
    const result = await this.notifications.send(tokens, {
      title: campaign.title ?? campaign.name,
      body: campaign.body ?? '',
      data: campaign.link ?? {},
    });
    return { sent: result.sent };
  }

  private row(dto: UpsertCampaignDto): Record<string, unknown> {
    return {
      name: dto.name,
      title: dto.title,
      body: dto.body,
      audience: dto.audience ?? {},
      link: dto.link ?? {},
      scheduled_at: dto.scheduledAt,
      status: dto.scheduledAt ? 'scheduled' : 'draft',
    };
  }
}
