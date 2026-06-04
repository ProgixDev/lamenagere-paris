import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Wraps a single service-role Supabase client. Service-role bypasses RLS, so
 * authorization is enforced in NestJS guards — RLS policies exist only as
 * defense-in-depth. Use `.client` for db/storage and `.admin` for GoTrue admin.
 */
@Injectable()
export class SupabaseService implements OnModuleInit {
  private _client!: SupabaseClient;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const url = this.config.getOrThrow<string>('SUPABASE_URL');
    const serviceRoleKey = this.config.getOrThrow<string>(
      'SUPABASE_SERVICE_ROLE_KEY',
    );
    this._client = createClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  /** Service-role client for database + storage operations. */
  get client(): SupabaseClient {
    return this._client;
  }

  /** GoTrue admin API (create users, generate links, etc.). */
  get auth() {
    return this._client.auth;
  }

  get admin() {
    return this._client.auth.admin;
  }

  /** Storage bucket configured via SUPABASE_STORAGE_BUCKET. */
  get storage() {
    const bucket = this.config.getOrThrow<string>('SUPABASE_STORAGE_BUCKET');
    return this._client.storage.from(bucket);
  }
}
