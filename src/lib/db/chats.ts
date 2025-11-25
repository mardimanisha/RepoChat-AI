/**
 * Database operations for chats
 * Replaces KV store operations with Supabase table operations
 */

import { createClient } from '@/lib/supabase/admin';

export interface Chat {
  id: string;
  repoId: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Get a chat by ID
 */
export async function getChat(chatId: string): Promise<Chat | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('chats')
    .select('*')
    .eq('id', chatId)
    .maybeSingle();
  
  if (error) {
    console.error(`[DB] Error fetching chat ${chatId}:`, error);
    return null;
  }
  
  if (!data) {
    return null;
  }
  
  return {
    id: data.id,
    repoId: data.repository_id,
    userId: data.user_id,
    title: data.title,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Get all chats for a repository
 */
export async function getRepositoryChats(repoId: string): Promise<Chat[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('chats')
    .select('*')
    .eq('repository_id', repoId)
    .order('updated_at', { ascending: false });
  
  if (error) {
    console.error(`[DB] Error fetching chats for repository ${repoId}:`, error);
    return [];
  }
  
  return (data || []).map(chat => ({
    id: chat.id,
    repoId: chat.repository_id,
    userId: chat.user_id,
    title: chat.title,
    createdAt: chat.created_at,
    updatedAt: chat.updated_at,
  }));
}

/**
 * Create a new chat
 */
export async function createChat(chat: Omit<Chat, 'createdAt' | 'updatedAt'>): Promise<Chat> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('chats')
    .insert({
      id: chat.id,
      repository_id: chat.repoId,
      user_id: chat.userId,
      title: chat.title,
    })
    .select()
    .single();
  
  if (error) {
    console.error(`[DB] Error creating chat:`, error);
    throw new Error(`Failed to create chat: ${error.message}`);
  }
  
  return {
    id: data.id,
    repoId: data.repository_id,
    userId: data.user_id,
    title: data.title,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Update chat's updated_at timestamp
 */
export async function updateChatTimestamp(chatId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('chats')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', chatId);
  
  if (error) {
    console.error(`[DB] Error updating chat timestamp ${chatId}:`, error);
    throw new Error(`Failed to update chat: ${error.message}`);
  }
}


