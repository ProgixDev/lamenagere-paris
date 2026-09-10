import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { hacherIp } from '../../common/http/ip-hash.util';
import { CreateConsentDto } from './dto/create-consent.dto';

/**
 * One row per click on the banner, so a NAT'd office or a café reaches double
 * digits legitimately. The global figure is a flood breaker, nothing finer.
 */
const LIMITE_PAR_IP_1H = 20;
const LIMITE_GLOBALE_1H = 3_000;

interface Contexte {
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class ConsentsService {
  private readonly logger = new Logger(ConsentsService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Record a receipt.
   *
   * No honeypot and no time-on-page check: there is nothing to spam here but
   * volume, and the browser fires this request with `keepalive` as the banner
   * closes, so anything that slows the answer is wasted. The row is the record;
   * the caller ignores the response body.
   */
  async enregistrer(dto: CreateConsentDto, contexte: Contexte): Promise<{ ok: true }> {
    const ipHash = hacherIp(contexte.ip);
    await this.verifierDebit(ipHash);

    const { error } = await this.supabase.client.from('website_consents').insert({
      consent_id: dto.consentId,
      version: dto.version,
      action: dto.action,
      choices: { mesure: dto.choix.mesure, marketing: dto.choix.marketing },
      page: dto.page ?? null,
      ip_hash: ipHash,
      user_agent: contexte.userAgent?.slice(0, 500) ?? null,
    });

    if (error) {
      // Nothing was recorded: say so. The banner has already closed and does
      // not read this, but the status is what the logs will be searched for.
      this.logger.error(`Enregistrement du consentement impossible : ${error.message}`);
      throw new HttpException(
        "Le consentement n'a pas pu être enregistré.",
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    return { ok: true };
  }

  // ── Interne ───────────────────────────────────────────────────────────────

  private async verifierDebit(ipHash: string | null): Promise<void> {
    const depuis = new Date(Date.now() - 60 * 60 * 1_000).toISOString();

    if (ipHash) {
      const parIp = await this.compter({ ipHash, depuis });
      if (parIp >= LIMITE_PAR_IP_1H) {
        throw new HttpException(
          'Trop de requêtes depuis cette connexion.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    const global = await this.compter({ depuis });
    if (global >= LIMITE_GLOBALE_1H) {
      this.logger.warn(`Coupe-circuit consentements : ${global} reçus en une heure`);
      throw new HttpException(
        'Volume inhabituel de requêtes.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async compter(filtre: { ipHash?: string; depuis: string }): Promise<number> {
    let requete = this.supabase.client
      .from('website_consents')
      .select('id', { count: 'exact', head: true })
      .gt('created_at', filtre.depuis);

    if (filtre.ipHash) requete = requete.eq('ip_hash', filtre.ipHash);

    const { count, error } = await requete;
    if (error) {
      // Fail open, as for leads: a database hiccup must not turn a receipt
      // into a wall — the insert will fail on its own if the base is down.
      this.logger.error(`Comptage du débit impossible : ${error.message}`);
      return 0;
    }
    return count ?? 0;
  }
}
