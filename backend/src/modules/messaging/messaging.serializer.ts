import {
  PRODUCT_SELECT,
  ProductDto,
  ProductRow,
  toProductDto,
} from '../catalog/catalog.serializer';

export type MsgSender = 'customer' | 'admin';

export interface MessageAttachmentRow {
  id: string;
  url: string;
  type: string;
}

export interface MessageRow {
  id: string;
  conversation_id: string;
  sender: MsgSender;
  content: string;
  created_at: string;
  attachments?: MessageAttachmentRow[];
}

export interface ConversationRow {
  id: string;
  profile_id: string;
  subject: string;
  product_id: string | null;
  vendor_name: string;
  vendor_avatar: string | null;
  pinned_kind: 'order' | 'quote' | null;
  pinned_ref: string | null;
  pinned_label: string | null;
  last_message: string | null;
  last_message_at: string | null;
  unread_customer: number;
  unread_admin: number;
  is_b2b: boolean;
  created_at: string;
  product?: ProductRow | null;
}

// ── Mobile DTOs ─────────────────────────────────────────────────────────────
export interface ConversationDto {
  id: string;
  subject: string;
  product?: ProductDto;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  vendorName: string;
  vendorAvatar?: string;
  createdAt: string;
}

export interface MessageDto {
  id: string;
  conversationId: string;
  content: string;
  sender: 'user' | 'vendor';
  attachments?: { type: string; url: string }[];
  createdAt: string;
}

// ── Admin DTOs ──────────────────────────────────────────────────────────────
export interface AdminConversationDto {
  id: string;
  vendorName: string;
  subject: string;
  lastMessage: string;
  lastMessageAt: string;
  unread: number;
  b2b?: boolean;
  pinnedEntity?: { kind: 'order' | 'quote'; ref: string; label: string };
}

export interface AdminMessageDto {
  id: string;
  conversationId: string;
  sender: 'admin' | 'client';
  content: string;
  attachments?: string[];
  createdAt: string;
}

// ── Serializers ─────────────────────────────────────────────────────────────
export function toConversationDto(row: ConversationRow): ConversationDto {
  return {
    id: row.id,
    subject: row.subject,
    product: row.product ? toProductDto(row.product) : undefined,
    lastMessage: row.last_message ?? '',
    lastMessageAt: row.last_message_at ?? row.created_at,
    unreadCount: row.unread_customer,
    vendorName: row.vendor_name,
    vendorAvatar: row.vendor_avatar ?? undefined,
    createdAt: row.created_at,
  };
}

export function toMessageDto(row: MessageRow): MessageDto {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    content: row.content,
    sender: row.sender === 'customer' ? 'user' : 'vendor',
    attachments: row.attachments?.length
      ? row.attachments.map((a) => ({ type: a.type, url: a.url }))
      : undefined,
    createdAt: row.created_at,
  };
}

export function toAdminConversationDto(
  row: ConversationRow,
  clientName: string,
): AdminConversationDto {
  return {
    id: row.id,
    vendorName: clientName || row.vendor_name,
    subject: row.subject,
    lastMessage: row.last_message ?? '',
    lastMessageAt: row.last_message_at ?? row.created_at,
    unread: row.unread_admin,
    b2b: row.is_b2b || undefined,
    pinnedEntity:
      row.pinned_kind && row.pinned_ref
        ? {
            kind: row.pinned_kind,
            ref: row.pinned_ref,
            label: row.pinned_label ?? row.pinned_ref,
          }
        : undefined,
  };
}

export function toAdminMessageDto(row: MessageRow): AdminMessageDto {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    sender: row.sender === 'admin' ? 'admin' : 'client',
    content: row.content,
    attachments: row.attachments?.map((a) => a.url),
    createdAt: row.created_at,
  };
}

export const CONVERSATION_SELECT = `*, product:products(${PRODUCT_SELECT})`;
export const MESSAGE_SELECT = '*, attachments:message_attachments(*)';
