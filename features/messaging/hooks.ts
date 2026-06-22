import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getConversationsApi,
  startConversationApi,
  getConversationThreadApi,
  sendMessageApi,
  markAsReadApi,
} from "./api";
import { useMessagingStore } from "./store";

export const useConversations = () => {
  const setConversations = useMessagingStore((s) => s.setConversations);

  return useQuery({
    queryKey: ["conversations"],
    queryFn: async () => {
      const data = await getConversationsApi();
      setConversations(data);
      return data;
    },
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
  });
};

export const useStartConversation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { message: string; productId?: string }) =>
      startConversationApi(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
};

export const useConversationThread = (conversationId: string) =>
  useQuery({
    queryKey: ["conversation", conversationId, "messages"],
    queryFn: () => getConversationThreadApi(conversationId),
    enabled: !!conversationId,
    staleTime: 10 * 1000,
    refetchInterval: 10 * 1000,
  });

export const useSendMessage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      conversationId,
      content,
    }: {
      conversationId: string;
      content: string;
    }) => sendMessageApi(conversationId, content),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["conversation", variables.conversationId, "messages"],
      });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
};

export const useMarkAsRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) => markAsReadApi(conversationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
};
