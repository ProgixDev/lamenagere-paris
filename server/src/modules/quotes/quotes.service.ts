import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import {
  QUOTE_SELECT,
  QuoteRequestDto,
  QuoteRow,
  toQuoteRequestDto,
} from './quotes.serializer';
import { CreateQuoteDto } from './dto/create-quote.dto';

@Injectable()
export class QuotesService {
  constructor(private readonly supabase: SupabaseService) {}

  async list(userId: string): Promise<QuoteRequestDto[]> {
    const { data } = await this.supabase.client
      .from('quotes')
      .select(QUOTE_SELECT)
      .eq('profile_id', userId)
      .order('created_at', { ascending: false })
      .returns<QuoteRow[]>();
    return (data ?? []).map(toQuoteRequestDto);
  }

  async findOne(userId: string, id: string): Promise<QuoteRequestDto> {
    const row = await this.loadOwned(userId, id);
    return toQuoteRequestDto(row);
  }

  async create(
    userId: string,
    dto: CreateQuoteDto,
    isB2b: boolean,
  ): Promise<QuoteRequestDto> {
    // Snapshot product name/image.
    const { data: product } = await this.supabase.client
      .from('products')
      .select('name, media:product_media(url,type,is_primary)')
      .eq('id', dto.productId)
      .maybeSingle<{
        name: string;
        media: { url: string; type: string; is_primary: boolean }[];
      }>();
    if (!product) throw new NotFoundException('Produit introuvable');

    const primary =
      product.media?.find((m) => m.is_primary && m.type === 'image') ??
      product.media?.find((m) => m.type === 'image');

    const year = new Date().getFullYear();
    const { data: seq } = await this.supabase.client.rpc('next_counter', {
      p_scope: `quote:${year}`,
    });
    const quoteNumber = `DEV-${year}-${String(seq ?? 1).padStart(5, '0')}`;

    const { data: quote, error } = await this.supabase.client
      .from('quotes')
      .insert({
        quote_number: quoteNumber,
        profile_id: userId,
        product_id: dto.productId,
        product_name: product.name,
        product_image: primary?.url ?? null,
        req_width: dto.dimensions?.width ?? null,
        req_height: dto.dimensions?.height ?? null,
        notes: dto.notes,
        status: 'en_attente_devis',
        is_b2b: isB2b,
      })
      .select('id')
      .single<{ id: string }>();
    if (error || !quote) {
      throw new BadRequestException(
        error?.message ?? 'Création de la demande de devis impossible',
      );
    }

    if (dto.images?.length) {
      await this.supabase.client.from('quote_attachments').insert(
        dto.images.map((url) => ({ quote_id: quote.id, url, type: 'image' })),
      );
    }

    return this.findOne(userId, quote.id);
  }

  async accept(userId: string, id: string): Promise<void> {
    const row = await this.loadOwned(userId, id);
    if (row.status !== 'devis_envoye') {
      throw new BadRequestException(
        'Seul un devis envoyé peut être accepté',
      );
    }
    await this.supabase.client
      .from('quotes')
      .update({ status: 'devis_accepte', decided_at: new Date().toISOString() })
      .eq('id', id)
      .eq('profile_id', userId);
  }

  private async loadOwned(userId: string, id: string): Promise<QuoteRow> {
    const { data } = await this.supabase.client
      .from('quotes')
      .select(QUOTE_SELECT)
      .eq('id', id)
      .eq('profile_id', userId)
      .maybeSingle<QuoteRow>();
    if (!data) throw new NotFoundException('Devis introuvable');
    return data;
  }
}
