import { initials } from '../../common/serialization/initials.util';

export type TicketStatus = 'ouvert' | 'en_cours' | 'resolu' | 'ferme';
export type TicketPriority = 'basse' | 'normale' | 'haute' | 'urgente';
export type TicketCategory = 'commande' | 'livraison' | 'produit' | 'paiement' | 'autre';

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  ouvert: 'Ouvert',
  en_cours: 'En cours',
  resolu: 'Résolu',
  ferme: 'Fermé',
};
export const TICKET_PRIORITY_LABELS: Record<TicketPriority, string> = {
  basse: 'Basse',
  normale: 'Normale',
  haute: 'Haute',
  urgente: 'Urgente',
};
export const TICKET_CATEGORY_LABELS: Record<TicketCategory, string> = {
  commande: 'Commande',
  livraison: 'Livraison',
  produit: 'Produit',
  paiement: 'Paiement',
  autre: 'Autre',
};

export interface TicketMessageRow {
  id: string;
  sender: 'customer' | 'admin';
  content: string;
  created_at: string;
}

export interface TicketRow {
  id: string;
  ticket_number: string;
  profile_id: string;
  subject: string;
  category: TicketCategory;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  order_id: string | null;
  last_reply_at: string | null;
  unread_admin: number;
  unread_customer: number;
  created_at: string;
  updated_at: string;
  profile?: { first_name: string; last_name: string; email: string; account_type: string } | null;
  messages?: TicketMessageRow[];
}

export interface TicketMessageDto {
  id: string;
  sender: 'customer' | 'admin';
  content: string;
  createdAt: string;
}

export interface TicketDto {
  id: string;
  ticketNumber: string;
  subject: string;
  category: TicketCategory;
  categoryLabel: string;
  description: string;
  status: TicketStatus;
  statusLabel: string;
  priority: TicketPriority;
  priorityLabel: string;
  orderId?: string;
  createdAt: string;
  lastReplyAt?: string;
  messages?: TicketMessageDto[];
  // admin-facing extras
  client?: string;
  clientInitials?: string;
  clientEmail?: string;
  b2b?: boolean;
  unread?: number;
}

function toMessageDto(m: TicketMessageRow): TicketMessageDto {
  return { id: m.id, sender: m.sender, content: m.content, createdAt: m.created_at };
}

export function toTicketDto(row: TicketRow, opts: { admin?: boolean } = {}): TicketDto {
  const dto: TicketDto = {
    id: row.id,
    ticketNumber: row.ticket_number,
    subject: row.subject,
    category: row.category,
    categoryLabel: TICKET_CATEGORY_LABELS[row.category],
    description: row.description,
    status: row.status,
    statusLabel: TICKET_STATUS_LABELS[row.status],
    priority: row.priority,
    priorityLabel: TICKET_PRIORITY_LABELS[row.priority],
    orderId: row.order_id ?? undefined,
    createdAt: row.created_at,
    lastReplyAt: row.last_reply_at ?? undefined,
    messages: row.messages
      ? [...row.messages].sort((a, b) => a.created_at.localeCompare(b.created_at)).map(toMessageDto)
      : undefined,
  };
  if (opts.admin) {
    const name = [row.profile?.first_name, row.profile?.last_name].filter(Boolean).join(' ');
    dto.client = name;
    dto.clientInitials = initials(row.profile?.first_name, row.profile?.last_name);
    dto.clientEmail = row.profile?.email;
    dto.b2b = row.profile?.account_type === 'professionnel' || undefined;
    dto.unread = row.unread_admin;
  }
  return dto;
}

export const TICKET_SELECT =
  '*, messages:ticket_messages(*), profile:profiles(first_name,last_name,email,account_type)';
