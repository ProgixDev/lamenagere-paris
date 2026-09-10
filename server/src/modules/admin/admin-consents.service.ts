import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import {
  AdminConsentDto,
  ConsentRow,
  toAdminConsent,
} from '../consents/consents.serializer';

/**
 * The proof of consent, looked up by the visitor's own identifier.
 *
 * There is no list-everything route on purpose: a receipt means nothing
 * outside the cookie that carries its id, and the one question this table
 * answers is "what did the person holding this id choose, and when" — the
 * question a data-subject request asks.
 */
@Injectable()
export class AdminConsentsService {
  constructor(private readonly supabase: SupabaseService) {}

  async historique(consentId: string): Promise<AdminConsentDto[]> {
    const { data } = await this.supabase.client
      .from('website_consents')
      .select('*')
      .eq('consent_id', consentId)
      .order('created_at', { ascending: false })
      .limit(50)
      .returns<ConsentRow[]>();

    return (data ?? []).map(toAdminConsent);
  }
}
