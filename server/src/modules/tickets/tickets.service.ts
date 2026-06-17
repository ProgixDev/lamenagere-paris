import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import {
  TICKET_SELECT,
  TicketDto,
  TicketRow,
  toTicketDto,
} from './tickets.serializer';
import {
  CreateTicketDto,
  TicketMessageDtoIn,
  UpdateTicketDto,
} from './dto/ticket.dto';

@Injectable()
export class TicketsService {
  constructor(private readonly supabase: SupabaseService) {}

  // ── Customer ────────────────────────────────────────────────────────────
  async listForUser(userId: string): Promise<TicketDto[]> {
    const { data } = await this.supabase.client
      .from('tickets')
      .select(TICKET_SELECT)
      .eq('profile_id', userId)
      .order('created_at', { ascending: false })
      .returns<TicketRow[]>();
    return (data ?? []).map((t) => toTicketDto(t));
  }

  async getForUser(userId: string, id: string): Promise<TicketDto> {
    const row = await this.loadOwned(userId, id);
    // Customer opened it -> clear their unread.
    await this.supabase.client
      .from('tickets')
      .update({ unread_customer: 0 })
      .eq('id', id);
    return toTicketDto(row);
  }

  async create(userId: string, dto: CreateTicketDto): Promise<TicketDto> {
    const year = new Date().getFullYear();
    const { data: seq } = await this.supabase.client.rpc('next_counter', {
      p_scope: `ticket:${year}`,
    });
    const ticketNumber = `TKT-${year}-${String(seq ?? 1).padStart(5, '0')}`;

    const { data: ticket, error } = await this.supabase.client
      .from('tickets')
      .insert({
        ticket_number: ticketNumber,
        profile_id: userId,
        subject: dto.subject,
        category: dto.category,
        description: dto.description,
        order_id: dto.orderId ?? null,
        status: 'ouvert',
        unread_admin: 1,
      })
      .select('id')
      .single<{ id: string }>();
    if (error || !ticket) {
      throw new BadRequestException(error?.message ?? 'Création du ticket impossible');
    }

    await this.supabase.client.from('activity_log').insert({
      kind: 'system',
      entity_ref: ticketNumber,
      summary: `Nouveau ticket : ${dto.subject}`,
    });

    return this.getForUser(userId, ticket.id);
  }

  async addUserMessage(
    userId: string,
    id: string,
    dto: TicketMessageDtoIn,
  ): Promise<TicketDto> {
    await this.loadOwned(userId, id);
    await this.appendMessage(id, 'customer', userId, dto.content);
    // Re-open if it was resolved/closed and bump admin unread.
    await this.supabase.client
      .from('tickets')
      .update({
        last_reply_at: new Date().toISOString(),
        status: 'ouvert',
      })
      .eq('id', id)
      .in('status', ['resolu', 'ferme']);
    await this.bumpUnread(id, 'admin');
    return this.getForUser(userId, id);
  }

  // ── Admin ───────────────────────────────────────────────────────────────
  async adminList(filters: {
    status?: string;
    priority?: string;
  }): Promise<TicketDto[]> {
    let q = this.supabase.client.from('tickets').select(TICKET_SELECT);
    if (filters.status) q = q.eq('status', filters.status);
    if (filters.priority) q = q.eq('priority', filters.priority);
    const { data } = await q
      .order('created_at', { ascending: false })
      .returns<TicketRow[]>();
    return (data ?? []).map((t) => toTicketDto(t, { admin: true }));
  }

  async adminDetail(id: string): Promise<TicketDto> {
    const row = await this.load(id);
    await this.supabase.client
      .from('tickets')
      .update({ unread_admin: 0 })
      .eq('id', id);
    return toTicketDto(row, { admin: true });
  }

  async adminUpdate(id: string, dto: UpdateTicketDto): Promise<TicketDto> {
    await this.load(id);
    const patch: Record<string, unknown> = {};
    if (dto.status) {
      patch.status = dto.status;
      patch.resolved_at =
        dto.status === 'resolu' || dto.status === 'ferme'
          ? new Date().toISOString()
          : null;
    }
    if (dto.priority) patch.priority = dto.priority;
    if (Object.keys(patch).length) {
      await this.supabase.client.from('tickets').update(patch).eq('id', id);
    }
    return toTicketDto(await this.load(id), { admin: true });
  }

  async adminReply(
    id: string,
    adminId: string,
    dto: TicketMessageDtoIn,
  ): Promise<TicketDto> {
    await this.load(id);
    await this.appendMessage(id, 'admin', adminId, dto.content);
    await this.supabase.client
      .from('tickets')
      .update({ last_reply_at: new Date().toISOString(), status: 'en_cours' })
      .eq('id', id)
      .eq('status', 'ouvert');
    await this.bumpUnread(id, 'customer');
    return toTicketDto(await this.load(id), { admin: true });
  }

  // ── helpers ───────────────────────────────────────────────────────────────
  private async appendMessage(
    ticketId: string,
    sender: 'customer' | 'admin',
    senderId: string,
    content: string,
  ): Promise<void> {
    await this.supabase.client.from('ticket_messages').insert({
      ticket_id: ticketId,
      sender,
      sender_id: senderId,
      content,
    });
  }

  private async bumpUnread(
    ticketId: string,
    side: 'admin' | 'customer',
  ): Promise<void> {
    const col = side === 'admin' ? 'unread_admin' : 'unread_customer';
    const { data } = await this.supabase.client
      .from('tickets')
      .select(col)
      .eq('id', ticketId)
      .single<Record<string, number>>();
    await this.supabase.client
      .from('tickets')
      .update({ [col]: (data?.[col] ?? 0) + 1 })
      .eq('id', ticketId);
  }

  private async loadOwned(userId: string, id: string): Promise<TicketRow> {
    const { data } = await this.supabase.client
      .from('tickets')
      .select(TICKET_SELECT)
      .eq('id', id)
      .eq('profile_id', userId)
      .maybeSingle<TicketRow>();
    if (!data) throw new NotFoundException('Ticket introuvable');
    return data;
  }

  private async load(id: string): Promise<TicketRow> {
    const { data } = await this.supabase.client
      .from('tickets')
      .select(TICKET_SELECT)
      .eq('id', id)
      .maybeSingle<TicketRow>();
    if (!data) throw new NotFoundException('Ticket introuvable');
    return data;
  }
}
