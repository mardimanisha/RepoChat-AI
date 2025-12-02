/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Loader2, Plus } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Sidebar } from '../../../components/sidebar';
import { ChatMessage } from '../../../components/chat-message';
import { ChatInput } from '../../../components/chat-input';
import { createClient } from '../../../lib/supabase/client';
import {
  getRepository,
  getChats,
  createChat,
  getMessages,
  sendMessage,
} from '../../../utils/api';
import type { Repository, Chat, Message } from '../../../utils/api';

// Extended message type for optimistic UI
type ExtendedMessage = Message & {
  isStreaming?: boolean;
};
import { toast } from 'sonner';

export default function RepositoryPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const repoId = (params?.repoId as string) || '';
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // refs to prevent repeated loads
  const hasLoadedRef = useRef(false);
  const isMountedRef = useRef(true);
  const hasCheckedAuthRef = useRef(false);

  const [user, setUser] = useState<any>(null);
  const [repository, setRepository] = useState<Repository | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<ExtendedMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Run checkAuth once on mount (guarded)
  useEffect(() => {
    if (hasCheckedAuthRef.current) return;
    hasCheckedAuthRef.current = true;
    void checkAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load repository & chats once user is set and repoId exists (guarded)
  useEffect(() => {
    if (!user || !repoId) return;

    // Prevent double-loads (useful with React Strict Mode)
    if (hasLoadedRef.current) return;

    hasLoadedRef.current = true;
    void loadRepository();
    void loadChats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, repoId]);

  // Load messages when selectedChat changes
  useEffect(() => {
    if (!selectedChat) {
      setMessages([]);
      return;
    }
    void loadMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChat?.id]);

  // Scroll when messages update
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    try {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    } catch {
      /* ignore scroll errors */
    }
  };

  const checkAuth = async () => {
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push('/auth');
        return;
      }

      if (!isMountedRef.current) return;

      setUser({
        name: session.user.user_metadata?.name || 'User',
        email: session.user.email,
      });
    } catch (error) {
      console.error('Auth check error:', error);
      router.push('/auth');
    } finally {
      // keep loading true until repository load finishes
    }
  };

  const loadRepository = useCallback(async () => {
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session || !repoId) return;

      const data = await getRepository(decodeURIComponent(repoId), session.access_token);
      if (!isMountedRef.current) return;

      setRepository(data.repository);
    } catch (error: any) {
      toast.error('Failed to load repository');
      console.error('Load repository error:', error);
      router.push('/dashboard');
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, [repoId, router]);

  const loadChats = useCallback(async () => {
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session || !repoId) return;

      const data = await getChats(decodeURIComponent(repoId), session.access_token);
      if (!isMountedRef.current) return;

      const loadedChats = data.chats || [];
      setChats(loadedChats);

      // If there's a chatId in URL params, select that chat
      const chatIdFromUrl = searchParams?.get('chatId');
      if (chatIdFromUrl && !selectedChat) {
        const chatToSelect = loadedChats.find((c) => c.id === chatIdFromUrl);
        if (chatToSelect) {
          setSelectedChat(chatToSelect);
        }
      }
    } catch (error: any) {
      console.error('Load chats error:', error);
    }
  }, [repoId, searchParams, selectedChat]);

  const loadMessages = useCallback(async () => {
    if (!selectedChat) return;

    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) return;

      const data = await getMessages(selectedChat.id, session.access_token);
      if (!isMountedRef.current) return;

      setMessages(data.messages || []);
    } catch (error: any) {
      console.error('Load messages error:', error);
    }
  }, [selectedChat]);

  const handleNewChat = useCallback(async () => {
    if (!repoId) return;

    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) return;

      const data = await createChat(decodeURIComponent(repoId), 'New Chat', session.access_token);

      // prepend using functional update to avoid stale closure
      setChats((prev) => [data.chat, ...prev]);
      setSelectedChat(data.chat);
      setMessages([]);
      toast.success('New chat created');
    } catch (error: any) {
      toast.error('Failed to create chat');
      console.error('Create chat error:', error);
    }
  }, [repoId]);

  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!selectedChat || repository?.status !== 'ready') {
        toast.error('Repository is not available yet');
        return;
      }

      // Create optimistic user message with temporary ID
      const timestamp = Date.now();
      const tempUserId = `temp_user_${timestamp}`;
      const tempAssistantId = `temp_assistant_${timestamp}`;
      
      const optimisticUserMessage: ExtendedMessage = {
        id: tempUserId,
        chatId: selectedChat.id,
        role: 'user',
        content,
        createdAt: new Date().toISOString(),
      };

      // Create streaming placeholder for assistant
      const streamingPlaceholder: ExtendedMessage = {
        id: tempAssistantId,
        chatId: selectedChat.id,
        role: 'assistant',
        content: '',
        createdAt: new Date().toISOString(),
        isStreaming: true,
      };

      // Add optimistic messages immediately
      setMessages((prevMessages) => [...prevMessages, optimisticUserMessage, streamingPlaceholder]);

      setSending(true);
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          // Remove temp messages on error
          setMessages((prevMessages) =>
            prevMessages.filter((msg) => msg.id !== tempUserId && msg.id !== tempAssistantId)
          );
          return;
        }

        const data = await sendMessage(selectedChat.id, content, session.access_token);

        // Replace temp messages with real messages using functional update
        setMessages((prevMessages) => {
          // Remove temp messages
          const withoutTemp = prevMessages.filter(
            (msg) => msg.id !== tempUserId && msg.id !== tempAssistantId
          );

          // Add real messages
          const newMessages = [...withoutTemp, data.userMessage, data.assistantMessage];

          // If previous was empty and API returned updated chat, sync title optimistically
          if (prevMessages.filter((m) => !m.id.startsWith('temp_')).length === 0 && (data as any).updatedChat) {
            const updatedChat = (data as any).updatedChat as Chat;

            // update selectedChat & chats safely
            setSelectedChat(updatedChat);
            setChats((prevChats) => prevChats.map((c) => (c.id === selectedChat.id ? updatedChat : c)));
          }

          return newMessages;
        });
      } catch (error: any) {
        // Remove temp messages on error
        setMessages((prevMessages) =>
          prevMessages.filter((msg) => msg.id !== tempUserId && msg.id !== tempAssistantId)
        );
        toast.error(error?.message || 'Failed to send message');
        console.error('Send message error:', error);
      } finally {
        if (isMountedRef.current) setSending(false);
      }
    },
    [selectedChat, repository?.status]
  );

  const handleLogout = useCallback(async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch (e) {
      console.error('Logout error', e);
    } finally {
      router.push('/');
    }
  }, [router]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-background overflow-hidden">
      <Sidebar
        user={user}
        chats={chats}
        selectedChatId={selectedChat?.id}
        onNewChat={handleNewChat}
        onChatSelect={(chatId) => {
          const chat = chats.find((c) => c.id === chatId);
          if (chat) setSelectedChat(chat);
        }}
        showRecentChatsHeader={false}
        onLogout={handleLogout}
      />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <div className="border-b border-border p-3 lg:p-4 flex items-center gap-3 min-w-0 pl-14 lg:pl-4">
          <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard')} className="shrink-0">
            <ArrowLeft className="size-4 md:mr-2" />
            <span className="hidden md:inline">Back</span>
          </Button>

          {repository && (
            <div className="flex-1 min-w-0">
              <h2 className="truncate text-sm md:text-base">
                {repository.owner}/{repository.name}
              </h2>
              <p className="text-xs text-muted-foreground truncate">
                Status: {repository.status === 'ready' ? 'Available' : repository.status === 'processing' ? 'Analyzing…' : repository.status}
              </p>
            </div>
          )}
        </div>

        {!selectedChat ? (
          <div className="flex-1 flex items-center justify-center p-4 md:p-8 min-w-0">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center space-y-4 max-w-md w-full px-4"
            >
              <h2 className="text-xl md:text-2xl">Start a New Chat</h2>
              <p className="text-muted-foreground text-sm md:text-base">
                Create a new chat to start asking questions about this repository
              </p>
              <Button onClick={handleNewChat} size="lg">
                <Plus className="mr-2 size-4" />
                New Chat
              </Button>
            </motion.div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-3 md:p-4 lg:p-6 min-w-0">
              <div className="max-w-3xl mx-auto w-full">
                {messages.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center py-12"
                  >
                    <p className="text-muted-foreground text-sm md:text-base px-2">
                      Start the conversation by asking a question about the repository
                    </p>
                  </motion.div>
                ) : (
                  <AnimatePresence mode="popLayout">
                    {messages.map((message) => (
                      <ChatMessage key={message.id} message={message} />
                    ))}
                  </AnimatePresence>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            <div className="border-t border-border p-3 md:p-4 pb-safe">
              <div className="max-w-3xl mx-auto w-full">
                <ChatInput
                  onSend={handleSendMessage}
                  disabled={sending || repository?.status !== 'ready'}
                  placeholder={
                    repository?.status === 'processing'
                      ? 'Repository is being analyzed...'
                      : repository?.status === 'error'
                      ? 'Repository analysis failed'
                      : 'Ask a question about this repository...'
                  }
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
