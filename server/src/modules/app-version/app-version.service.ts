import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { isBelowMinimum } from '../../common/version/semver.util';

export type AppPlatform = 'ios' | 'android';

/** Réponse publique consommée par l'app au lancement. */
export interface AppVersionGate {
  /** `true` → l'app doit afficher un écran bloquant « Mise à jour requise ». */
  updateRequired: boolean;
  /** Version minimale exigée sur cette plateforme (null = pas de minimum). */
  minVersion: string | null;
  /** Version renvoyée par l'app, réécho pour faciliter le support. */
  installedVersion: string | null;
  /** Lien du store à ouvrir depuis l'écran bloquant. */
  storeUrl: string | null;
  /** Message personnalisé de l'admin (null = texte par défaut de l'app). */
  message: string | null;
  /** Interrupteur maintenance (settings.maintenance_mode). */
  maintenanceMode: boolean;
}

/** Ligne `settings` mise en cache : ce n'est lu que pour ce verrou. */
interface GateSettings {
  forceUpdateEnabled: boolean;
  minIos: string | null;
  minAndroid: string | null;
  iosStoreUrl: string | null;
  androidStoreUrl: string | null;
  message: string | null;
  maintenanceMode: boolean;
}

/** Toutes les ouvertures d'app tapent cette route : on met la ligne en cache. */
const CACHE_TTL_MS = 30_000;

@Injectable()
export class AppVersionService {
  private cache: { at: number; value: GateSettings } | null = null;

  constructor(private readonly supabase: SupabaseService) {}

  private async settings(): Promise<GateSettings | null> {
    if (this.cache && Date.now() - this.cache.at < CACHE_TTL_MS) {
      return this.cache.value;
    }

    const { data, error } = await this.supabase.client
      .from('settings')
      .select(
        'force_update_enabled, min_app_version_ios, min_app_version_android, ios_store_url, android_store_url, force_update_message, maintenance_mode',
      )
      .eq('id', 1)
      .maybeSingle();

    // Base injoignable : on renvoie null et l'appelant laisse passer. Une panne
    // de la base ne doit pas verrouiller l'app de tout le monde.
    if (error || !data) return null;

    const value: GateSettings = {
      forceUpdateEnabled: !!data.force_update_enabled,
      minIos: data.min_app_version_ios ?? null,
      minAndroid: data.min_app_version_android ?? null,
      iosStoreUrl: data.ios_store_url ?? null,
      androidStoreUrl: data.android_store_url ?? null,
      message: data.force_update_message ?? null,
      maintenanceMode: !!data.maintenance_mode,
    };
    this.cache = { at: Date.now(), value };
    return value;
  }

  /** Invalide le cache après une écriture admin, pour un effet immédiat. */
  invalidate() {
    this.cache = null;
  }

  async check(
    rawPlatform: string | undefined,
    rawVersion: string | undefined,
  ): Promise<AppVersionGate> {
    const platform: AppPlatform | null =
      rawPlatform === 'ios' || rawPlatform === 'android' ? rawPlatform : null;
    const installedVersion = rawVersion?.trim() || null;

    const s = await this.settings();
    if (!s) {
      return {
        updateRequired: false,
        minVersion: null,
        installedVersion,
        storeUrl: null,
        message: null,
        maintenanceMode: false,
      };
    }

    const minVersion =
      platform === 'ios'
        ? s.minIos
        : platform === 'android'
          ? s.minAndroid
          : null;
    const storeUrl =
      platform === 'ios'
        ? s.iosStoreUrl
        : platform === 'android'
          ? s.androidStoreUrl
          : null;

    // Le blocage exige les trois : l'interrupteur, un minimum lisible pour
    // cette plateforme, et une version installée lisible strictement en dessous.
    const updateRequired =
      s.forceUpdateEnabled && isBelowMinimum(installedVersion, minVersion);

    return {
      updateRequired,
      minVersion,
      installedVersion,
      storeUrl,
      message: s.message,
      maintenanceMode: s.maintenanceMode,
    };
  }
}
