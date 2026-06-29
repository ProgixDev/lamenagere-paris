import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { CreateReviewDto } from './dto/create-review.dto';

export interface ReviewDto {
  id: string;
  rating: number;
  comment?: string;
  authorName?: string;
  createdAt: string;
}

interface ReviewRow {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  // Supabase types embedded to-one relations as an array; handle both.
  profile?:
    | { full_name: string | null }
    | { full_name: string | null }[]
    | null;
}

@Injectable()
export class ReviewsService {
  constructor(private readonly supabase: SupabaseService) {}

  /** Create (or update) the review for one purchased line of a delivered order. */
  async create(userId: string, dto: CreateReviewDto): Promise<ReviewDto> {
    // The order line must belong to the user, reference this product, and the
    // parent order must be delivered ('livree').
    const { data: item } = await this.supabase.client
      .from('order_items')
      .select('id, product_id, order:orders!inner(profile_id, status)')
      .eq('id', dto.orderItemId)
      .maybeSingle();

    if (!item) throw new NotFoundException('Order line not found');
    const order = item.order as unknown as {
      profile_id: string;
      status: string;
    };
    if (order.profile_id !== userId) {
      throw new ForbiddenException('Not your order');
    }
    if (item.product_id !== dto.productId) {
      throw new ForbiddenException('Product does not match order line');
    }
    if (order.status !== 'livree') {
      throw new ForbiddenException('Order not delivered yet');
    }

    const { data: review, error } = await this.supabase.client
      .from('product_reviews')
      .upsert(
        {
          profile_id: userId,
          product_id: dto.productId,
          order_item_id: dto.orderItemId,
          rating: dto.rating,
          comment: dto.comment ?? null,
        },
        { onConflict: 'order_item_id' },
      )
      .select('id, rating, comment, created_at, profile:profiles(full_name)')
      .single();

    if (error || !review) {
      throw new NotFoundException(error?.message ?? 'Could not save review');
    }

    await this.recomputeAggregates(dto.productId);
    return this.toDto(review as unknown as ReviewRow);
  }

  /** Public list of reviews for a product (newest first). */
  async listForProduct(productId: string): Promise<ReviewDto[]> {
    const { data } = await this.supabase.client
      .from('product_reviews')
      .select('id, rating, comment, created_at, profile:profiles(full_name)')
      .eq('product_id', productId)
      .order('created_at', { ascending: false });

    return ((data ?? []) as unknown as ReviewRow[]).map((r) => this.toDto(r));
  }

  /** Recompute and persist products.rating_avg / rating_count. */
  private async recomputeAggregates(productId: string): Promise<void> {
    const { data } = await this.supabase.client
      .from('product_reviews')
      .select('rating')
      .eq('product_id', productId);

    const ratings = ((data ?? []) as { rating: number }[]).map((r) => r.rating);
    const count = ratings.length;
    const avg = count
      ? Math.round((ratings.reduce((s, n) => s + n, 0) / count) * 10) / 10
      : 0;

    await this.supabase.client
      .from('products')
      .update({ rating_avg: avg, rating_count: count })
      .eq('id', productId);
  }

  private toDto(row: ReviewRow): ReviewDto {
    const profile = Array.isArray(row.profile) ? row.profile[0] : row.profile;
    const full = profile?.full_name?.trim();
    const authorName = full ? full.split(/\s+/)[0] : undefined;
    return {
      id: row.id,
      rating: row.rating,
      comment: row.comment ?? undefined,
      authorName,
      createdAt: row.created_at,
    };
  }
}
