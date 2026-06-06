import { apiClient } from "../../lib/api";

export interface TicketMessage {
  id: string;
  sender: "customer" | "admin";
  content: string;
  createdAt: string;
}

export interface Ticket {
  id: string;
  ticketNumber: string;
  subject: string;
  category: string;
  categoryLabel: string;
  description: string;
  status: "ouvert" | "en_cours" | "resolu" | "ferme";
  statusLabel: string;
  priority: string;
  priorityLabel: string;
  createdAt: string;
  messages?: TicketMessage[];
}

export interface CreateTicketPayload {
  subject: string;
  category: string;
  description: string;
  orderId?: string;
}

export const listTicketsApi = async (): Promise<Ticket[]> => {
  const { data } = await apiClient.get<Ticket[]>("/tickets");
  return data;
};

export const getTicketApi = async (id: string): Promise<Ticket> => {
  const { data } = await apiClient.get<Ticket>(`/tickets/${id}`);
  return data;
};

export const createTicketApi = async (
  payload: CreateTicketPayload,
): Promise<Ticket> => {
  const { data } = await apiClient.post<Ticket>("/tickets", payload);
  return data;
};

export const replyTicketApi = async (
  id: string,
  content: string,
): Promise<Ticket> => {
  const { data } = await apiClient.post<Ticket>(`/tickets/${id}/messages`, {
    content,
  });
  return data;
};
