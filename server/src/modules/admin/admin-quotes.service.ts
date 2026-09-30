import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { DevicesService } from '../notifications/devices.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AdminMessageDto } from '../messaging/messaging.serializer';
import { AdminConversationsService } from './admin-conversations.service';
import { fetchAllRows } from '../../common/serialization/pagination';
import { eurosToCents } from '../../common/serialization/money.util';
import { QuoteStatus } from '../../common/serialization/status-labels';
import {
  AdminQuoteDto,
  QUOTE_SELECT,
  QuoteRow,
  toAdminQuoteDto,
} from '../quotes/quotes.serializer';
import { UpdateQuoteDto, UpdateQuoteStatusDto } from './dto/quote-admin.dto';

@Injectable()
export class AdminQuotesService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly conversations: AdminConversationsService,
    private readonly devices: DevicesService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(status?: QuoteStatus): Promise<AdminQuoteDto[]> {
    const rows = await fetchAllRows<QuoteRow>((from, to) => {
      let q = this.supabase.client.from('quotes').select(QUOTE_SELECT);
      if (status) q = q.eq('status', status);
      return q
        .order('created_at', { ascending: false })
        .order('id', { ascending: true })
        .range(from, to)
        .returns<QuoteRow[]>();
    });
    return rows.map(toAdminQuoteDto);
  }

  async detail(idOrNumber: string): Promise<QuoteRow> {
    return this.loadByIdOrNumber(idOrNumber);
  }

  async update(
    idOrNumber: string,
    dto: UpdateQuoteDto,
  ): Promise<AdminQuoteDto> {
    const row = await this.loadByIdOrNumber(idOrNumber);

    if (dto.items) {
      await this.supabase.client
        .from('quote_items')
        .delete()
        .eq('quote_id', row.id);
      if (dto.items.length) {
        await this.supabase.client.from('quote_items').insert(
          dto.items.map((it, i) => ({
            quote_id: row.id,
            description: it.description,
            quantity: it.quantity,
            unit_price_cents: eurosToCents(it.unitPrice),
            sort_order: i,
          })),
        );
      }
    }

    const patch: Record<string, unknown> = {};
    if (dto.shipping !== undefined)
      patch.shipping_cents = eurosToCents(dto.shipping);
    if (dto.fabricationDelay !== undefined)
      patch.fabrication_delay = dto.fabricationDelay;
    if (dto.validityDays !== undefined) patch.validity_days = dto.validityDays;
    if (dto.adminMessage !== undefined) patch.admin_message = dto.adminMessage;
    if (dto.tvaRate !== undefined) patch.tva_rate = dto.tvaRate;
    if (dto.pdfUrl !== undefined) patch.pdf_url = dto.pdfUrl;
    if (dto.quotedPrice !== undefined) {
      patch.quoted_price_cents = eurosToCents(dto.quotedPrice);
    } else if (dto.items?.length) {
      // `send` stores the total it priced; re-price from the new lines so a
      // re-sent quote is not frozen at the sum of the first send.
      patch.quoted_price_cents =
        dto.items.reduce(
          (sum, it) => sum + eurosToCents(it.unitPrice) * it.quantity,
          0,
        ) +
        ((patch.shipping_cents as number | undefined) ??
          row.shipping_cents ??
          0);
    }
    if (Object.keys(patch).length) {
      await this.supabase.client.from('quotes').update(patch).eq('id', row.id);
    }

    return toAdminQuoteDto(await this.loadByIdOrNumber(idOrNumber));
  }

  async send(idOrNumber: string): Promise<AdminQuoteDto> {
    const row = await this.loadByIdOrNumber(idOrNumber);
    const quoted = await this.computeQuotedCents(row);
    if (quoted <= 0) {
      throw new BadRequestException(
        'Ajoutez au moins une ligne ou un prix avant d’envoyer le devis',
      );
    }
    await this.supabase.client
      .from('quotes')
      .update({
        status: 'devis_envoye',
        quoted_price_cents: quoted,
        sent_at: new Date().toISOString(),
      })
      .eq('id', row.id);
    return toAdminQuoteDto(await this.loadByIdOrNumber(idOrNumber));
  }

  /**
   * Writes to the customer about their request through the messagerie — the
   * only channel that reaches them before a priced quote exists (asking for
   * measurements, a phone number…). Reuses the thread pinned to this quote, or
   * opens one, so the exchange also shows up in the admin Messages module.
   */
  async message(
    idOrNumber: string,
    adminId: string,
    content?: string,
    attachments?: string[],
  ): Promise<{ conversationId: string; message: AdminMessageDto }> {
    const row = await this.loadByIdOrNumber(idOrNumber);
    if (!row.profile_id) {
      throw new BadRequestException(
        'Le client a supprimé son compte : il ne peut plus recevoir de message',
      );
    }

    // Checked here too so an empty send never leaves an empty thread behind.
    if (!content?.trim() && !attachments?.length) {
      throw new BadRequestException('Message vide');
    }

    const conversationId = await this.conversationFor(row);
    const message = await this.conversations.reply(
      conversationId,
      adminId,
      content,
      attachments,
    );
    await this.notifyCustomer(row.profile_id, message.content, conversationId);
    return { conversationId, message };
  }

  async reject(idOrNumber: string): Promise<AdminQuoteDto> {
    const row = await this.loadByIdOrNumber(idOrNumber);
    await this.supabase.client
      .from('quotes')
      .update({ status: 'devis_rejete', decided_at: new Date().toISOString() })
      .eq('id', row.id);
    return toAdminQuoteDto(await this.loadByIdOrNumber(idOrNumber));
  }

  async setStatus(
    idOrNumber: string,
    dto: UpdateQuoteStatusDto,
  ): Promise<AdminQuoteDto> {
    const row = await this.loadByIdOrNumber(idOrNumber);
    await this.supabase.client
      .from('quotes')
      .update({ status: dto.status })
      .eq('id', row.id);
    return toAdminQuoteDto(await this.loadByIdOrNumber(idOrNumber));
  }

  // ── helpers ────────────────────────────────────────────────────────────────
  /** The customer thread pinned to this quote, created on first use. */
  private async conversationFor(row: QuoteRow): Promise<string> {
    const ref = row.quote_number ?? row.id;
    const { data: existing } = await this.supabase.client
      .from('conversations')
      .select('id')
      .eq('profile_id', row.profile_id!)
      .eq('pinned_kind', 'quote')
      .eq('pinned_ref', ref)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle<{ id: string }>();
    if (existing) return existing.id;

    const { data: created, error } = await this.supabase.client
      .from('conversations')
      .insert({
        profile_id: row.profile_id,
        subject: `Votre demande de devis ${ref}`,
        product_id: row.product_id,
        vendor_name: 'Service Client',
        pinned_kind: 'quote',
        pinned_ref: ref,
        pinned_label: row.product_name ?? 'Demande de devis',
        is_b2b: row.is_b2b,
      })
      .select('id')
      .single<{ id: string }>();
    if (error || !created) {
      throw new BadRequestException('Ouverture de la conversation impossible');
    }
    return created.id;
  }

  /** Best-effort push; the message is already saved whatever happens here. */
  private async notifyCustomer(
    profileId: string,
    content: string,
    conversationId: string,
  ): Promise<void> {
    try {
      const tokens = await this.devices.tokensForProfiles([profileId]);
      if (tokens.length === 0) return;
      await this.notifications.send(tokens, {
        title: 'Nouveau message — votre demande de devis',
        body: content || 'Pièce jointe',
        data: { conversationId, type: 'message' },
      });
    } catch {
      // non-critical
    }
  }

  private async computeQuotedCents(row: QuoteRow): Promise<number> {
    if (row.quoted_price_cents != null && row.quoted_price_cents > 0) {
      return row.quoted_price_cents;
    }
    const itemsTotal = (row.items ?? []).reduce(
      (sum, it) => sum + it.unit_price_cents * it.quantity,
      0,
    );
    return itemsTotal + (row.shipping_cents ?? 0);
  }

  private async loadByIdOrNumber(idOrNumber: string): Promise<QuoteRow> {
    const column = idOrNumber.startsWith('DEV-') ? 'quote_number' : 'id';
    const { data } = await this.supabase.client
      .from('quotes')
      .select(QUOTE_SELECT)
      .eq(column, idOrNumber)
      .maybeSingle<QuoteRow>();
    if (!data) throw new NotFoundException('Devis introuvable');
    return data;
  }
}
