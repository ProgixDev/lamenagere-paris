import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { centsToEuros, eurosToCents } from '../../common/serialization/money.util';
import {
  UpdateSettingsDto,
  UpdateZoneFeeDto,
} from './dto/settings-admin.dto';

@Injectable()
export class AdminSettingsService {
  constructor(private readonly supabase: SupabaseService) {}

  async get() {
    const [{ data: settings }, { data: zones }] = await Promise.all([
      this.supabase.client.from('settings').select('*').eq('id', 1).maybeSingle(),
      this.supabase.client
        .from('shipping_zone_fees')
        .select('*')
        .order('zone', { ascending: true }),
    ]);

    return {
      settings: settings
        ? {
            storeName: settings.store_name,
            contactEmail: settings.contact_email,
            contactPhone: settings.contact_phone,
            warehouseAddress: settings.warehouse_address,
            siret: settings.siret,
            tvaIntracom: settings.tva_intracom,
            tvaRate: settings.tva_rate,
            freeShippingThreshold:
              settings.free_shipping_threshold_cents != null
                ? centsToEuros(settings.free_shipping_threshold_cents)
                : null,
            autoShippingByWeight: settings.auto_shipping_by_weight,
            maintenanceMode: settings.maintenance_mode,
            depositEnabled: settings.deposit_enabled,
            depositThreshold:
              settings.deposit_threshold_cents != null
                ? centsToEuros(settings.deposit_threshold_cents)
                : null,
          }
        : null,
      shippingZones: (zones ?? []).map((z: any) => ({
        zone: z.zone,
        delay: z.delay,
        fee: centsToEuros(z.fee_cents),
        isActive: z.is_active,
      })),
    };
  }

  async update(dto: UpdateSettingsDto) {
    const patch: Record<string, unknown> = {};
    if (dto.storeName !== undefined) patch.store_name = dto.storeName;
    if (dto.contactEmail !== undefined) patch.contact_email = dto.contactEmail;
    if (dto.contactPhone !== undefined) patch.contact_phone = dto.contactPhone;
    if (dto.warehouseAddress !== undefined)
      patch.warehouse_address = dto.warehouseAddress;
    if (dto.siret !== undefined) patch.siret = dto.siret;
    if (dto.tvaIntracom !== undefined) patch.tva_intracom = dto.tvaIntracom;
    if (dto.tvaRate !== undefined) patch.tva_rate = dto.tvaRate;
    if (dto.freeShippingThreshold !== undefined)
      patch.free_shipping_threshold_cents = eurosToCents(dto.freeShippingThreshold);
    if (dto.autoShippingByWeight !== undefined)
      patch.auto_shipping_by_weight = dto.autoShippingByWeight;
    if (dto.maintenanceMode !== undefined)
      patch.maintenance_mode = dto.maintenanceMode;
    if (dto.depositEnabled !== undefined)
      patch.deposit_enabled = dto.depositEnabled;
    if (dto.depositThreshold !== undefined)
      patch.deposit_threshold_cents = eurosToCents(dto.depositThreshold);

    if (Object.keys(patch).length) {
      await this.supabase.client.from('settings').update(patch).eq('id', 1);
    }
    return this.get();
  }

  async updateZone(dto: UpdateZoneFeeDto) {
    await this.supabase.client.from('shipping_zone_fees').upsert(
      {
        zone: dto.zone,
        delay: dto.delay,
        fee_cents: dto.feeCents,
        is_active: dto.isActive ?? true,
      },
      { onConflict: 'zone' },
    );
    return this.get();
  }
}
