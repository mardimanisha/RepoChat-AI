/**
 * Database operations for messages
 * Replaces KV store operations with Supabase table operations
 */

import { createClient } from '@/lib/supabase/admin';

export interface Message {
  id: string;
  chatId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

/**
 * Get all messages for a chat
 */
export async function getChatMessages(chatId: string): Promise<Message[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: true });
  
  if (error) {
    console.error(`[DB] Error fetching messages for chat ${chatId}:`, error);
    return [];
  }
  
  return (data || []).map(msg => ({
    id: msg.id,
    chatId: msg.chat_id,
    role: msg.role as 'user' | 'assistant',
    content: msg.content,
    createdAt: msg.created_at,
  }));
}

/**
 * Create a new message
 */
export async function createMessage(message: Omit<Message, 'createdAt'>): Promise<Message> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('messages')
    .insert({
      id: message.id,
      chat_id: message.chatId,
      role: message.role,
      content: message.content,
    })
    .select()
    .single();
  
  if (error) {
    console.error(`[DB] Error creating message:`, error);
    throw new Error(`Failed to create message: ${error.message}`);
  }
  
  return {
    id: data.id,
    chatId: data.chat_id,
    role: data.role as 'user' | 'assistant',
    content: data.content,
    createdAt: data.created_at,
  };
}

/**
 * Get chat history for RAG context (last N messages)
 */
export async function getChatHistory(chatId: string, limit: number = 10): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
  const messages = await getChatMessages(chatId);
  return messages
    .slice(-limit)
    .map(msg => ({
      role: msg.role,
      content: msg.content,
    }));
}


