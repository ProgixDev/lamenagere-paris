import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { eurosToCents } from '../../common/serialization/money.util';
import { QuoteStatus } from '../../common/serialization/status-labels';
import {
  AdminQuoteDto,
  QUOTE_SELECT,
  QuoteRow,
  toAdminQuoteDto,
} from '../quotes/quotes.serializer';
import {
  UpdateQuoteDto,
  UpdateQuoteStatusDto,
} from './dto/quote-admin.dto';

@Injectable()
export class AdminQuotesService {
  constructor(private readonly supabase: SupabaseService) {}

  async list(status?: QuoteStatus): Promise<AdminQuoteDto[]> {
    let q = this.supabase.client.from('quotes').select(QUOTE_SELECT);
    if (status) q = q.eq('status', status);
    const { data } = await q
      .order('created_at', { ascending: false })
      .returns<QuoteRow[]>();
    return (data ?? []).map(toAdminQuoteDto);
  }

  async detail(idOrNumber: string): Promise<QuoteRow> {
    return this.loadByIdOrNumber(idOrNumber);
  }

  async update(idOrNumber: string, dto: UpdateQuoteDto): Promise<AdminQuoteDto> {
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
    if (dto.shipping !== undefined) patch.shipping_cents = eurosToCents(dto.shipping);
    if (dto.fabricationDelay !== undefined) patch.fabrication_delay = dto.fabricationDelay;
    if (dto.validityDays !== undefined) patch.validity_days = dto.validityDays;
    if (dto.adminMessage !== undefined) patch.admin_message = dto.adminMessage;
    if (dto.tvaRate !== undefined) patch.tva_rate = dto.tvaRate;
    if (dto.pdfUrl !== undefined) patch.pdf_url = dto.pdfUrl;
    if (dto.quotedPrice !== undefined) {
      patch.quoted_price_cents = eurosToCents(dto.quotedPrice);
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
