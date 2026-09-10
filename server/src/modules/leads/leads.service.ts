import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { hacherIp } from '../../common/http/ip-hash.util';
import { isSmtpConfigured, sendMail } from '../../common/mail/mailer.util';
import { CreateLeadDto } from './dto/create-lead.dto';
import { LeadAccepteDto, LeadRow } from './leads.serializer';
import { renderLeadEmail } from './leads.mail';

/** A submission typed faster than this was not typed. */
const DELAI_MINIMAL_MS = 3_000;
/** A form left open longer than this has a stale token; ask for a fresh page. */
const DELAI_MAXIMAL_MS = 2 * 60 * 60 * 1_000;

const LIMITE_PAR_IP_1H = 3;
const LIMITE_PAR_IP_24H = 10;
/** Circuit breaker: a distributed flood must not bury a real lead. */
const LIMITE_GLOBALE_1H = 60;

/** Window in which a repeat from the same address is treated as a double-click. */
const FENETRE_DOUBLON_MS = 10 * 60 * 1_000;

/**
 * SMTP budget. `vercel.json` caps the function at 30s and the invoice defaults
 * (15/15/30) can eat all of it; a contact form must answer well before that.
 */
const DELAIS_SMTP = { connection: 5_000, greeting: 5_000, socket: 8_000 };

interface Contexte {
  ip?: string;
  userAgent?: string;
  referer?: string;
}

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Accept a submission.
   *
   * The order is deliberate: every cheap rejection happens before the database
   * is touched, the row is written before the mail is attempted, and the mail
   * can fail without the caller ever knowing. The row is the record; the
   * notification is a convenience.
   */
  async creer(dto: CreateLeadDto, contexte: Contexte): Promise<LeadAccepteDto> {
    // 1. Honeypot. Hidden from people; anything in it came from a bot.
    //    Answered as a success on purpose — a 400 tells the author what to fix.
    if (dto.siteWeb && dto.siteWeb.trim().length > 0) {
      this.logger.debug('Lead écarté : honeypot rempli');
      return { id: FAUX_ID, ok: true };
    }

    // 2. Time on page.
    if (typeof dto.ouvertureAt === 'number') {
      const ecoule = Date.now() - dto.ouvertureAt;
      if (ecoule < DELAI_MINIMAL_MS || ecoule > DELAI_MAXIMAL_MS) {
        this.logger.debug(`Lead écarté : soumis en ${ecoule} ms`);
        return { id: FAUX_ID, ok: true };
      }
    }

    const ipHash = hacherIp(contexte.ip);

    // 3. Rate limits, counted in Postgres because it is the only state the
    //    serverless instances share. See the note in migration 0043.
    await this.verifierDebit(ipHash);

    // 4. The impatient double-click. Same address, minutes apart: hand back the
    //    first row rather than creating a twin and sending a second email.
    const doublon = await this.trouverDoublonRecent(dto.email);
    if (doublon) return { id: doublon, ok: true };

    const { data, error } = await this.supabase.client
      .from('website_leads')
      .insert({
        source: dto.source ?? 'site',
        name: dto.nom,
        email: dto.email,
        phone: dto.telephone ?? null,
        postal_code: dto.codePostal ?? null,
        message: dto.message,
        answers: dto.reponses ?? {},
        consent: dto.consentement ?? false,
        ip_hash: ipHash,
        user_agent: contexte.userAgent?.slice(0, 500) ?? null,
        referer: contexte.referer?.slice(0, 500) ?? null,
      })
      .select('id')
      .single<Pick<LeadRow, 'id'>>();

    if (error || !data) {
      // This one *does* fail the request: nothing was recorded, so telling the
      // visitor it went through would lose the lead silently.
      this.logger.error(`Enregistrement du lead impossible : ${error?.message}`);
      throw new HttpException(
        "Votre demande n'a pas pu être enregistrée. Réessayez dans un instant.",
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    await this.notifier(data.id, dto);
    return { id: data.id, ok: true };
  }

  // ── Interne ───────────────────────────────────────────────────────────────

  private async verifierDebit(ipHash: string | null): Promise<void> {
    const depuis = (ms: number) => new Date(Date.now() - ms).toISOString();

    if (ipHash) {
      const [heure, jour] = await Promise.all([
        this.compter({ ipHash, depuis: depuis(60 * 60 * 1_000) }),
        this.compter({ ipHash, depuis: depuis(24 * 60 * 60 * 1_000) }),
      ]);

      if (heure >= LIMITE_PAR_IP_1H || jour >= LIMITE_PAR_IP_24H) {
        throw new HttpException(
          'Trop de demandes envoyées depuis cette connexion. Réessayez plus tard, ou appelez-nous au 07 82 41 68 80.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    const global = await this.compter({ depuis: depuis(60 * 60 * 1_000) });
    if (global >= LIMITE_GLOBALE_1H) {
      this.logger.warn(`Coupe-circuit leads : ${global} demandes en une heure`);
      throw new HttpException(
        'Nous recevons un volume inhabituel de demandes. Merci de nous appeler au 07 82 41 68 80.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async compter(filtre: { ipHash?: string; depuis: string }): Promise<number> {
    let requete = this.supabase.client
      .from('website_leads')
      .select('id', { count: 'exact', head: true })
      .gt('created_at', filtre.depuis);

    if (filtre.ipHash) requete = requete.eq('ip_hash', filtre.ipHash);

    const { count, error } = await requete;
    if (error) {
      // Fail open rather than closed. A database hiccup must not turn the
      // contact form into a wall; the honeypot and the timing check still stand.
      this.logger.error(`Comptage du débit impossible : ${error.message}`);
      return 0;
    }
    return count ?? 0;
  }

  private async trouverDoublonRecent(email: string): Promise<string | null> {
    const { data } = await this.supabase.client
      .from('website_leads')
      .select('id')
      .eq('email', email)
      .gt('created_at', new Date(Date.now() - FENETRE_DOUBLON_MS).toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<Pick<LeadRow, 'id'>>();

    return data?.id ?? null;
  }

  /**
   * Tell someone. Never throws — the row is already safe, and a send failure is
   * recorded on it rather than surfaced to the visitor. Same shape as
   * `invoices.service.ts:236-242`.
   *
   * Awaited rather than fired and forgotten: on Vercel the function is frozen
   * the instant the response is written, so a floating promise is a coin flip.
   * The tightened timeouts are what keep the wait inside `maxDuration`.
   */
  private async notifier(id: string, dto: CreateLeadDto): Promise<void> {
    const destinataire =
      process.env.LEADS_NOTIFY_TO || process.env.SMTP_FROM || process.env.SMTP_USER;

    if (!isSmtpConfigured() || !destinataire) {
      await this.enregistrerEchec(
        id,
        'smtp_not_configured',
        'SMTP_HOST/SMTP_USER/SMTP_PASS ou LEADS_NOTIFY_TO ne sont pas définis',
      );
      return;
    }

    try {
      const contenu = renderLeadEmail(dto, { id, recuLe: new Date() });
      await sendMail({
        to: destinataire,
        // The single most valuable detail here: Reply answers the customer.
        replyTo: dto.email,
        subject: contenu.subject,
        text: contenu.text,
        html: contenu.html,
        timeouts: DELAIS_SMTP,
      });
      await this.supabase.client
        .from('website_leads')
        .update({ notified_at: new Date().toISOString(), notify_error: null })
        .eq('id', id);
    } catch (erreur) {
      await this.enregistrerEchec(id, 'send_failed', String(erreur));
    }
  }

  private async enregistrerEchec(id: string, code: string, detail: string): Promise<void> {
    this.logger.warn(`Notification du lead ${id} non envoyée (${code}) : ${detail}`);
    await this.supabase.client
      .from('website_leads')
      .update({ notify_error: `${code}: ${detail}`.slice(0, 300) })
      .eq('id', id);
  }
}

/**
 * Returned to a rejected bot so the response is indistinguishable from a
 * success. A caller that stores it and asks for it later gets a 404, which is
 * the same thing an expired reference would give.
 */
const FAUX_ID = '00000000-0000-0000-0000-000000000000';
