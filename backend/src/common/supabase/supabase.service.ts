import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Holds two Supabase clients:
 *
 *  - `_client` (service role): used for ALL database + storage queries and the
 *    GoTrue admin API. Service-role bypasses RLS, so NestJS guards are the
 *    authorization source of truth.
 *  - `_authClient` (anon key): used ONLY for end-user GoTrue calls
 *    (signInWithPassword, signUp, signInWithIdToken, getUser, password reset).
 *
 * The split is critical: calling sign-in methods stores a user session on the
 * client instance and overrides its Authorization header. If those ran on the
 * service-role client, every subsequent `.from()` query would silently run as
 * the `authenticated` role and hit RLS. Keeping auth on a separate instance
 * guarantees the DB client always acts as service_role.
 */
@Injectable()
export class SupabaseService implements OnModuleInit {
  private _client!: SupabaseClient;
  private _authClient!: SupabaseClient;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const url = this.config.getOrThrow<string>('SUPABASE_URL');
    const serviceRoleKey = this.config.getOrThrow<string>(
      'SUPABASE_SERVICE_ROLE_KEY',
    );
    const anonKey =
      this.config.get<string>('SUPABASE_ANON_KEY') || serviceRoleKey;

    this._client = createClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    this._authClient = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  /** Service-role client for database + storage operations (bypasses RLS). */
  get client(): SupabaseClient {
    return this._client;
  }

  /**
   * GoTrue auth for end-user sign-in / token validation. Lives on a SEPARATE
   * client so storing a user session never affects the service-role DB client.
   */
  get auth() {
    return this._authClient.auth;
  }

  /** GoTrue admin API (create users, generate links, etc.) — service role. */
  get admin() {
    return this._client.auth.admin;
  }

  /** Storage bucket configured via SUPABASE_STORAGE_BUCKET. */
  get storage() {
    const bucket = this.config.getOrThrow<string>('SUPABASE_STORAGE_BUCKET');
    return this._client.storage.from(bucket);
  }
}
