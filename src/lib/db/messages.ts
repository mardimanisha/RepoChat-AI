/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Database operations for messages
 * Replaces KV store operations with Supabase table operations
 */

import { createClient } from "@/lib/supabase/admin";

export interface Message {
  id: string;
  chatId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

/**
 * Get all messages for a chat
 */
export async function getChatMessages(chatId: string): Promise<Message[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error(`[DB] Error fetching messages for chat ${chatId}:`, error);
    return [];
  }

  return (data || []).map((msg: any) => ({
    id: msg.id,
    chatId: msg.chat_id,
    role: msg.role as "user" | "assistant",
    content: msg.content,
    createdAt: msg.created_at,
  }));
}

/**
 * Create a new message
 */
export async function createMessage(
  message: Omit<Message, "createdAt">
): Promise<Message> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("messages")
    .insert({
      id: message.id,
      chat_id: message.chatId,
      role: message.role,
      content: message.content,
    } as any)
    .select()
    .single();

  if (error) {
    console.error(`[DB] Error creating message:`, error);
    throw new Error(`Failed to create message: ${error.message}`);
  }

  const result = data as any;
  return {
    id: result.id,
    chatId: result.chat_id,
    role: result.role as "user" | "assistant",
    content: result.content,
    createdAt: result.created_at,
  };
}

/**
 * Get chat history for RAG context (last N messages)
 */
export async function getChatHistory(
  chatId: string,
  limit: number = 10
): Promise<Array<{ role: "user" | "assistant"; content: string }>> {
  const messages = await getChatMessages(chatId);
  return messages.slice(-limit).map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));
}

/**
 * Get message count for a chat (efficient check for zero messages)
 */
export async function getMessageCount(chatId: string): Promise<number> {
  const supabase = createClient();
  const { count, error } = await supabase
    .from("messages")
    .select("*", { count: "exact", head: true })
    .eq("chat_id", chatId);

  if (error) {
    console.error(`[DB] Error counting messages for chat ${chatId}:`, error);
    return 0;
  }

  return count || 0;
}