import { BadRequestException, Injectable } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { DeviceTokenRow } from './notifications.service';
import { RegisterDeviceDto } from './dto/device.dto';

export interface AudienceFilter {
  accountType?: 'particulier' | 'professionnel';
  territory?: string;
}

@Injectable()
export class DevicesService {
  constructor(private readonly supabase: SupabaseService) {}

  async register(userId: string, dto: RegisterDeviceDto): Promise<void> {
    const { error } = await this.supabase.client.from('device_tokens').upsert(
      {
        profile_id: userId,
        token: dto.token,
        platform: dto.platform,
        provider: dto.provider,
        device_id: dto.deviceId,
        is_active: true,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: 'token' },
    );
    if (error) throw new BadRequestException('Enregistrement de l’appareil impossible');
  }

  async unregister(userId: string, token: string): Promise<void> {
    await this.supabase.client
      .from('device_tokens')
      .delete()
      .eq('token', token)
      .eq('profile_id', userId);
  }

  /** Active tokens, optionally filtered by audience (account type / territory). */
  async tokensForAudience(filter: AudienceFilter): Promise<DeviceTokenRow[]> {
    // Resolve matching profile ids if an audience filter is present.
    let profileIds: string[] | null = null;
    if (filter.accountType) {
      const { data } = await this.supabase.client
        .from('profiles')
        .select('id')
        .eq('account_type', filter.accountType)
        .returns<{ id: string }[]>();
      profileIds = (data ?? []).map((p) => p.id);
    }
    if (filter.territory) {
      const { data } = await this.supabase.client
        .from('addresses')
        .select('profile_id')
        .eq('territory', filter.territory)
        .returns<{ profile_id: string }[]>();
      const byTerritory = new Set((data ?? []).map((a) => a.profile_id));
      profileIds = profileIds
        ? profileIds.filter((id) => byTerritory.has(id))
        : [...byTerritory];
    }

    let query = this.supabase.client
      .from('device_tokens')
      .select('id, token, platform, provider')
      .eq('is_active', true);
    if (profileIds) {
      if (profileIds.length === 0) return [];
      query = query.in('profile_id', profileIds);
    }
    const { data } = await query.returns<DeviceTokenRow[]>();
    return data ?? [];
  }

  async tokensForProfiles(profileIds: string[]): Promise<DeviceTokenRow[]> {
    if (profileIds.length === 0) return [];
    const { data } = await this.supabase.client
      .from('device_tokens')
      .select('id, token, platform, provider')
      .eq('is_active', true)
      .in('profile_id', profileIds)
      .returns<DeviceTokenRow[]>();
    return data ?? [];
  }
}
