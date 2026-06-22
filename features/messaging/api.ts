import { apiClient } from "../../lib/api";
import type { Conversation, Message } from "../../lib/types";

export const getConversationsApi = async (): Promise<Conversation[]> => {
  const { data } = await apiClient.get<Conversation[]>("/conversations");
  return data;
};

export const startConversationApi = async (params: {
  message: string;
  productId?: string;
}): Promise<Conversation> => {
  const { data } = await apiClient.post<Conversation>("/conversations", params);
  return data;
};

export const getConversationThreadApi = async (
  conversationId: string,
): Promise<Message[]> => {
  const { data } = await apiClient.get<Message[]>(
    `/conversations/${conversationId}/messages`,
  );
  return data;
};

export const sendMessageApi = async (
  conversationId: string,
  content: string,
  attachments?: string[],
): Promise<Message> => {
  const { data } = await apiClient.post<Message>(
    `/conversations/${conversationId}/messages`,
    { content, attachments },
  );
  return data;
};

export const markAsReadApi = async (
  conversationId: string,
): Promise<void> => {
  await apiClient.post(`/conversations/${conversationId}/read`);
};
