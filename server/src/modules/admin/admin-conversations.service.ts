import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import {
  AdminConversationDto,
  AdminMessageDto,
  attachmentType,
  MESSAGE_SELECT,
  MessageRow,
  messagePreview,
  toAdminConversationDto,
  toAdminMessageDto,
} from '../messaging/messaging.serializer';
import { PRODUCT_SELECT, ProductRow } from '../catalog/catalog.serializer';

interface ConvoWithProfile {
  id: string;
  profile_id: string;
  subject: string;
  vendor_name: string;
  is_b2b: boolean;
  pinned_kind: 'order' | 'quote' | null;
  pinned_ref: string | null;
  pinned_label: string | null;
  last_message: string | null;
  last_message_at: string | null;
  unread_admin: number;
  unread_customer: number;
  created_at: string;
  profile?: { full_name: string } | null;
  product?: ProductRow | null;
}

const ADMIN_CONVO_SELECT = `*, profile:profiles(full_name), product:products(${PRODUCT_SELECT})`;

@Injectable()
export class AdminConversationsService {
  constructor(private readonly supabase: SupabaseService) {}

  async list(): Promise<AdminConversationDto[]> {
    const { data } = await this.supabase.client
      .from('conversations')
      .select(ADMIN_CONVO_SELECT)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .returns<ConvoWithProfile[]>();
    return (data ?? []).map((c) =>
      toAdminConversationDto(
        c as never,
        c.profile?.full_name ?? '',
      ),
    );
  }

  async messages(conversationId: string): Promise<AdminMessageDto[]> {
    await this.assertExists(conversationId);
    const { data } = await this.supabase.client
      .from('messages')
      .select(MESSAGE_SELECT)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .returns<MessageRow[]>();
    return (data ?? []).map(toAdminMessageDto);
  }

  async reply(
    conversationId: string,
    adminId: string,
    contentRaw?: string,
    attachments?: string[],
  ): Promise<AdminMessageDto> {
    await this.assertExists(conversationId);

    const content = contentRaw?.trim() ?? '';
    const files = attachments ?? [];
    if (!content && files.length === 0) {
      throw new BadRequestException('Message vide');
    }

    const { data: message, error } = await this.supabase.client
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender: 'admin',
        sender_id: adminId,
        content,
      })
      .select('id')
      .single<{ id: string }>();
    if (error || !message) throw new NotFoundException('Envoi impossible');

    if (files.length) {
      await this.supabase.client.from('message_attachments').insert(
        files.map((url) => ({
          message_id: message.id,
          url,
          type: attachmentType(url),
        })),
      );
    }

    const { data: convo } = await this.supabase.client
      .from('conversations')
      .select('unread_customer')
      .eq('id', conversationId)
      .single<{ unread_customer: number }>();
    await this.supabase.client
      .from('conversations')
      .update({
        last_message: messagePreview(content, files.length),
        last_message_at: new Date().toISOString(),
        unread_customer: (convo?.unread_customer ?? 0) + 1,
      })
      .eq('id', conversationId);

    const { data: full } = await this.supabase.client
      .from('messages')
      .select(MESSAGE_SELECT)
      .eq('id', message.id)
      .single<MessageRow>();
    return toAdminMessageDto(full!);
  }

  async markRead(conversationId: string): Promise<void> {
    await this.assertExists(conversationId);
    await this.supabase.client
      .from('conversations')
      .update({ unread_admin: 0 })
      .eq('id', conversationId);
  }

  async pin(
    conversationId: string,
    kind: 'order' | 'quote' | null,
    ref: string | null,
    label: string | null,
  ): Promise<void> {
    await this.assertExists(conversationId);
    await this.supabase.client
      .from('conversations')
      .update({ pinned_kind: kind, pinned_ref: ref, pinned_label: label })
      .eq('id', conversationId);
  }

  private async assertExists(conversationId: string): Promise<void> {
    const { data } = await this.supabase.client
      .from('conversations')
      .select('id')
      .eq('id', conversationId)
      .maybeSingle();
    if (!data) throw new NotFoundException('Conversation introuvable');
  }
}
