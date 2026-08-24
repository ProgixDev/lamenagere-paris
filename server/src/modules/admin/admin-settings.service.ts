import { BadRequestException, Injectable } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { centsToEuros, eurosToCents } from '../../common/serialization/money.util';
import { parseVersion } from '../../common/version/semver.util';
import { AppVersionService } from '../app-version/app-version.service';
import {
  UpdateSettingsDto,
  UpdateZoneFeeDto,
} from './dto/settings-admin.dto';

@Injectable()
export class AdminSettingsService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly appVersion: AppVersionService,
  ) {}

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
            forceUpdateEnabled: !!settings.force_update_enabled,
            minAppVersionIos: settings.min_app_version_ios,
            minAppVersionAndroid: settings.min_app_version_android,
            iosStoreUrl: settings.ios_store_url,
            androidStoreUrl: settings.android_store_url,
            forceUpdateMessage: settings.force_update_message,
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

    if (dto.forceUpdateEnabled !== undefined)
      patch.force_update_enabled = dto.forceUpdateEnabled;
    if (dto.minAppVersionIos !== undefined)
      patch.min_app_version_ios = normalizeMinVersion(dto.minAppVersionIos, 'iOS');
    if (dto.minAppVersionAndroid !== undefined)
      patch.min_app_version_android = normalizeMinVersion(
        dto.minAppVersionAndroid,
        'Android',
      );
    if (dto.iosStoreUrl !== undefined) patch.ios_store_url = dto.iosStoreUrl || null;
    if (dto.androidStoreUrl !== undefined)
      patch.android_store_url = dto.androidStoreUrl || null;
    if (dto.forceUpdateMessage !== undefined)
      patch.force_update_message = dto.forceUpdateMessage || null;

    if (Object.keys(patch).length) {
      await this.supabase.client.from('settings').update(patch).eq('id', 1);
      // Le verrou de version sert une copie en cache : la purger pour que la
      // nouvelle version minimale s'applique au prochain lancement, pas 30s plus tard.
      this.appVersion.invalidate();
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

/**
 * Une version minimale illisible désactiverait silencieusement le verrou (le
 * serveur laisse passer en cas de doute) : on refuse l'enregistrement plutôt
 * que de laisser l'admin croire que l'app est protégée. Chaîne vide = retirer
 * le minimum.
 */
function normalizeMinVersion(raw: string, label: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (!parseVersion(value)) {
    throw new BadRequestException(
      `Version minimale ${label} invalide : « ${value} ». Format attendu : 1.3.0`,
    );
  }
  return value;
}
