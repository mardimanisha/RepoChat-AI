/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
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
import { toast } from 'sonner';

export default function RepositoryPage() {
  const router = useRouter();
  const params = useParams();
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
  const [messages, setMessages] = useState<Message[]>([]);
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

      setChats(data.chats || []);
    } catch (error: any) {
      console.error('Load chats error:', error);
    }
  }, [repoId]);

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
        toast.error('Repository is not ready yet');
        return;
      }

      setSending(true);
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) return;

        const data = await sendMessage(selectedChat.id, content, session.access_token);

        // Use functional update to append messages and derive previous length safely
        setMessages((prevMessages) => {
          const newMessages = [...prevMessages, data.userMessage, data.assistantMessage];

          // If previous was empty, update chat title (do it here to know previous length)
          if (prevMessages.length === 0) {
            const updatedChat: Chat = {
              ...selectedChat,
              title: content.substring(0, 50),
            } as Chat;

            // update selectedChat & chats safely
            setSelectedChat(updatedChat);
            setChats((prevChats) => prevChats.map((c) => (c.id === selectedChat.id ? updatedChat : c)));
          }

          return newMessages;
        });
      } catch (error: any) {
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
    <div className="flex h-screen bg-background">
      <Sidebar
        user={user}
        chats={chats}
        selectedChatId={selectedChat?.id}
        onNewChat={handleNewChat}
        onChatSelect={(chatId) => {
          const chat = chats.find((c) => c.id === chatId);
          if (chat) setSelectedChat(chat);
        }}
        onLogout={handleLogout}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="border-b border-border p-4 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard')}>
            <ArrowLeft className="size-4 mr-2" />
            Back
          </Button>

          {repository && (
            <div className="flex-1">
              <h2 className="truncate">
                {repository.owner}/{repository.name}
              </h2>
              <p className="text-xs text-muted-foreground">Status: {repository.status}</p>
            </div>
          )}
        </div>

        {!selectedChat ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center space-y-4 max-w-md"
            >
              <h2 className="text-2xl">Start a New Chat</h2>
              <p className="text-muted-foreground">
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
            <div className="flex-1 overflow-y-auto p-6">
              <div className="max-w-3xl mx-auto">
                {messages.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center py-12"
                  >
                    <p className="text-muted-foreground">
                      Start the conversation by asking a question about the repository
                    </p>
                  </motion.div>
                ) : (
                  messages.map((message) => <ChatMessage key={message.id} message={message} />)
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            <div className="border-t border-border p-4">
              <div className="max-w-3xl mx-auto">
                <ChatInput
                  onSend={handleSendMessage}
                  disabled={sending || repository?.status !== 'ready'}
                  placeholder={
                    repository?.status === 'processing'
                      ? 'Repository is processing...'
                      : repository?.status === 'error'
                      ? 'Repository processing failed'
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
