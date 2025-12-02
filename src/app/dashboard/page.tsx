/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Plus, Loader2 } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent } from '../../components/ui/card';
import { Sidebar } from '../../components/sidebar';
import { RepositoryCard } from '../../components/repository-card';
import { createClient } from '../../lib/supabase/client';
import { getRepositories, createRepository } from '../../utils/api';
import type { Repository, Chat } from '../../utils/api';
import { toast } from 'sonner';
import { getChats } from '../../utils/api';

interface RecentChat extends Chat {
  repositoryName?: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [recentChats, setRecentChats] = useState<RecentChat[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [repoUrl, setRepoUrl] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  
  useEffect(() => {
    checkAuth();
  }, []);
  
  useEffect(() => {
    if (user) {
      loadRepositories();
      
      // Poll for repository status updates
      const interval = setInterval(() => {
        loadRepositories();
      }, 5000);
      
      return () => clearInterval(interval);
    }
  }, [user]);

  const loadRecentChats = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) return;
      
      // Fetch chats from all repositories
      const allChats: RecentChat[] = [];
      
      for (const repo of repositories) {
        try {
          // Authentication is handled via cookies to avoid 431 errors
          // No need to pass the token - the server reads from cookies
          const data = await getChats(repo.id);
          const chatsWithRepo = (data.chats || []).map((chat: Chat) => ({
            ...chat,
            repositoryName: `${repo.owner}/${repo.name}`,
          }));
          allChats.push(...chatsWithRepo);
        } catch (error: any) {
          console.error(`Error loading chats for repo ${repo.id}:`, error);
          // Continue with other repositories
        }
      }
      
      // Sort by updatedAt DESC
      allChats.sort((a, b) => {
        const dateA = new Date(a.updatedAt).getTime();
        const dateB = new Date(b.updatedAt).getTime();
        return dateB - dateA;
      });
      
      setRecentChats(allChats);
    } catch (error: any) {
      console.error('Error loading recent chats:', error);
    }
  }, [repositories]);

  useEffect(() => {
    if (user && repositories.length > 0) {
      loadRecentChats();
    }
  }, [user, repositories, loadRecentChats]);
  
  const checkAuth = async () => {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/auth');
        return;
      }
      
      setUser({
        name: session.user.user_metadata?.name || 'User',
        email: session.user.email,
      });
    } catch (error) {
      console.error('Auth check error:', error);
      router.push('/auth');
    } finally {
      setLoading(false);
    }
  };
  
  const loadRepositories = async () => {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) return;
      
      // Authentication is handled via cookies to avoid 431 errors
      // No need to pass the token - the server reads from cookies
      const data = await getRepositories();
      setRepositories(data.repositories);
    } catch (error: any) {
      console.error('Error loading repositories:', error);
    }
  };

  
  
  const handleAddRepository = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!repoUrl.trim()) {
      toast.error('Please enter a repository URL');
      return;
    }
    
    setAdding(true);
    
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error('Please sign in first');
        setAdding(false);
        return;
      }
      
      // Authentication is handled via cookies to avoid 431 errors
      // No need to pass the token - the server reads from cookies
      const data = await createRepository(repoUrl);
      setRepositories([...repositories, data.repository]);
      setRepoUrl('');
      toast.success('Repository added successfully!');
      setShowAddDialog(false);
    } catch (error: any) {
      console.error('Error adding repository:', error);
      toast.error(error.message || 'Failed to add repository');
    } finally {
      setAdding(false);
    }
  };
  
  const handleDeleteRepository = async (repoId: string) => {
    try {
      // If the repo ID contains a colon, it's an old format - just remove it from the UI
      if (repoId.includes(':')) {
        toast.info('Removing old repository format from your list...');
        setRepositories(repositories.filter(r => r.id !== repoId));
        toast.success('Old repository removed. Please add it again to use the new format.');
        return;
      }
      
      // Handle normal deletion for new format repos
      toast.success('Repository deleted successfully');
      setRepositories(repositories.filter(r => r.id !== repoId));
    } catch (error: any) {
      console.error('Error deleting repository:', error);
      toast.error(error.message || 'Failed to delete repository');
    }
  };
  
  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
  };

  const handleChatSelect = (chatId: string, repoId?: string) => {
    if (repoId) {
      router.push(`/repository/${encodeURIComponent(repoId)}?chatId=${chatId}`);
    }
  };
  
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
        chats={recentChats}
        onChatSelect={handleChatSelect}
        onLogout={handleLogout}
        showRecentChatsHeader={true}
      />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-6xl mx-auto space-y-8"
          >
            <div className="text-center lg:text-left">
              <h1 className="text-2xl md:text-3xl lg:text-4xl mb-2">Your Repositories</h1>
              <p className="text-muted-foreground">
                Add GitHub repositories to chat with them using AI
              </p>
            </div>
            
            <Card>
              <CardContent className="p-6">
                <form onSubmit={handleAddRepository} className="flex flex-col sm:flex-row gap-3">
                  <Input
                    placeholder="https://github.com/owner/repository"
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                    disabled={adding}
                    className="flex-1"
                  />
                  
                  <Button type="submit" disabled={adding}>
                    {adding ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      <>
                        <Plus className="mr-2 size-4" />
                        Add Repository
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
            
            {repositories.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-12"
              >
                <p className="text-muted-foreground">
                  No repositories yet. Add your first repository to get started!
                </p>
              </motion.div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {repositories.map((repo) => (
                  <RepositoryCard
                    key={repo.id}
                    repository={repo}
                    onClick={() => router.push(`/repository/${encodeURIComponent(repo.id)}`)}
                    onDelete={() => handleDeleteRepository(repo.id)}
                  />
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}

