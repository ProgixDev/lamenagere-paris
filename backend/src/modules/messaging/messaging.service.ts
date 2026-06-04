import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import {
  CONVERSATION_SELECT,
  ConversationDto,
  ConversationRow,
  MESSAGE_SELECT,
  MessageDto,
  MessageRow,
  toConversationDto,
  toMessageDto,
} from './messaging.serializer';
import { SendMessageDto } from './dto/send-message.dto';

@Injectable()
export class MessagingService {
  constructor(private readonly supabase: SupabaseService) {}

  async list(userId: string): Promise<ConversationDto[]> {
    const { data } = await this.supabase.client
      .from('conversations')
      .select(CONVERSATION_SELECT)
      .eq('profile_id', userId)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .returns<ConversationRow[]>();
    return (data ?? []).map(toConversationDto);
  }

  async messages(userId: string, conversationId: string): Promise<MessageDto[]> {
    await this.assertOwned(userId, conversationId);
    const { data } = await this.supabase.client
      .from('messages')
      .select(MESSAGE_SELECT)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .returns<MessageRow[]>();
    return (data ?? []).map(toMessageDto);
  }

  async send(
    userId: string,
    conversationId: string,
    dto: SendMessageDto,
  ): Promise<MessageDto> {
    await this.assertOwned(userId, conversationId);

    const { data: message, error } = await this.supabase.client
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender: 'customer',
        sender_id: userId,
        content: dto.content,
      })
      .select('id')
      .single<{ id: string }>();
    if (error || !message) {
      throw new NotFoundException('Envoi du message impossible');
    }

    if (dto.attachments?.length) {
      await this.supabase.client.from('message_attachments').insert(
        dto.attachments.map((url) => ({ message_id: message.id, url })),
      );
    }

    // Update conversation preview + bump admin's unread counter.
    const { data: convo } = await this.supabase.client
      .from('conversations')
      .select('unread_admin')
      .eq('id', conversationId)
      .single<{ unread_admin: number }>();
    await this.supabase.client
      .from('conversations')
      .update({
        last_message: dto.content,
        last_message_at: new Date().toISOString(),
        unread_admin: (convo?.unread_admin ?? 0) + 1,
      })
      .eq('id', conversationId);

    const { data: full } = await this.supabase.client
      .from('messages')
      .select(MESSAGE_SELECT)
      .eq('id', message.id)
      .single<MessageRow>();
    return toMessageDto(full!);
  }

  async markRead(userId: string, conversationId: string): Promise<void> {
    await this.assertOwned(userId, conversationId);
    await this.supabase.client
      .from('conversations')
      .update({ unread_customer: 0 })
      .eq('id', conversationId);
    await this.supabase.client
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('sender', 'admin')
      .is('read_at', null);
  }

  private async assertOwned(
    userId: string,
    conversationId: string,
  ): Promise<void> {
    const { data } = await this.supabase.client
      .from('conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('profile_id', userId)
      .maybeSingle();
    if (!data) throw new NotFoundException('Conversation introuvable');
  }
}
