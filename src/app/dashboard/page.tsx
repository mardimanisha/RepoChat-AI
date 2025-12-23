/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Plus, Loader2 } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent } from '../../components/ui/card';
import { Sidebar } from '../../components/sidebar';
import { RepositoryCard } from '../../components/repository-card';
import { createClient } from '../../lib/supabase/client';
import { getRepositories, createRepository, deleteRepository } from '../../utils/api';
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
  
  // Refs for managing state and polling
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasInitialized = useRef(false);
  const loadedChatsForRepos = useRef<Set<string>>(new Set()); // Track which repos have loaded chats
  
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          router.push('/auth');
          return;
        }
        
        setUser((prev: any) => {
          const newUser = {
            name: session.user.user_metadata?.name || 'User',
            email: session.user.email,
          };
          // Only update if user data has changed
          if (prev && prev.name === newUser.name && prev.email === newUser.email) {
            return prev;
          }
          return newUser;
        });
      } catch (error) {
        console.error('Auth check error:', error);
        router.push('/auth');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // Initialize data once when user is authenticated
  useEffect(() => {
    if (user && !hasInitialized.current) {
      hasInitialized.current = true;
      initializeData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Smart polling: Only when there are processing repositories
  useEffect(() => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Check if there are any repositories still processing
    const hasProcessingRepos = repositories.some(repo => repo.status === 'processing');
    
    if (hasProcessingRepos) {
      // Poll for status updates only when needed
      intervalRef.current = setInterval(() => {
        checkRepositoryUpdates();
      }, 5000);
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repositories]);

  // ✅ REMOVED: No longer refetch all chats when repositories change
  // Chats are now managed granularly via client-side operations
  
  // Helper: Load chats for a specific repository
  const loadChatsForRepo = async (repo: Repository) => {
    if (loadedChatsForRepos.current.has(repo.id)) {
      return; // Already loaded
    }
    
    try {
      const data = await getChats(repo.id);
      const chatsWithRepo = (data.chats || []).map((chat: Chat) => ({
        ...chat,
        repositoryName: `${repo.owner}/${repo.name}`,
      }));
      
      // Add to existing chats and sort
      setRecentChats(prev => {
        const combined = [...prev, ...chatsWithRepo];
        return combined.sort((a, b) => 
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
      });
      
      loadedChatsForRepos.current.add(repo.id);
    } catch (error: any) {
      console.error(`Error loading chats for repo ${repo.id}:`, error);
    }
  };

  // Initialize: Load repositories and their chats (called once)
  const initializeData = async () => {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const data = await getRepositories();
      setRepositories(data.repositories);
      
      // Load chats for all ready repositories
      const readyRepos = data.repositories.filter((repo: Repository) => repo.status === 'ready');
      await Promise.all(readyRepos.map((repo: Repository) => loadChatsForRepo(repo)));
    } catch (error: any) {
      console.error('Error initializing data:', error);
    }
  };

  // Polling: Check for status changes (only updates changed repos)
  const checkRepositoryUpdates = async () => {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const data = await getRepositories();
      const newRepos = data.repositories;
      
      setRepositories(prev => {
        // Detect repos that changed from processing to ready
        const newlyReadyRepos = newRepos.filter((newRepo: Repository) => {
          const oldRepo = prev.find(r => r.id === newRepo.id);
          return oldRepo && 
                 oldRepo.status === 'processing' && 
                 newRepo.status === 'ready';
        });
        
        // Load chats for newly ready repositories
        newlyReadyRepos.forEach((repo: Repository) => {
          loadChatsForRepo(repo);
        });
        
        // Only update if data actually changed
        if (JSON.stringify(prev) === JSON.stringify(newRepos)) {
          return prev;
        }
        return newRepos;
      });
    } catch (error: any) {
      console.error('Error checking repository updates:', error);
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
      
      // Call API to create repository
      const data = await createRepository(repoUrl);
      const newRepo = data.repository;
      
      // ✅ Client-side update: Add to local state immediately
      setRepositories(prev => [...prev, newRepo]);
      
      // ✅ Granular fetch: Load chats only for this new repo (if ready)
      if (newRepo.status === 'ready') {
        await loadChatsForRepo(newRepo);
      }
      // If processing, polling will handle it when it becomes ready
      
      setRepoUrl('');
      toast.success('Repository added successfully!');
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
        // ✅ Client-side update: Remove from both repositories and chats
        setRepositories(prev => prev.filter(r => r.id !== repoId));
        setRecentChats(prev => prev.filter(chat => chat.repoId !== repoId));
        loadedChatsForRepos.current.delete(repoId);
        toast.success('Old repository removed. Please add it again to use the new format.');
        return;
      }
      
      // Call API to delete the repository from the database
      await deleteRepository(repoId);
      
      // ✅ Client-side update: Remove from local state immediately
      setRepositories(prev => prev.filter(r => r.id !== repoId));
      
      // ✅ Client-side update: Remove associated chats (no refetch needed)
      setRecentChats(prev => prev.filter(chat => chat.repoId !== repoId));
      loadedChatsForRepos.current.delete(repoId);
      
      toast.success('Repository deleted successfully');
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
        {/* Fixed header with glass effect */}
        <div className="sticky top-0 z-30 backdrop-blur-md bg-background/80 border-b border-border/50 p-4 md:p-6 lg:px-8 lg:py-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center lg:text-left">
              <h1 className="text-2xl md:text-3xl lg:text-4xl mb-2">Your Repositories</h1>
              <p className="text-muted-foreground">
                Add GitHub repositories to chat with them using AI
              </p>
            </div>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-6xl mx-auto space-y-8"
          >
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

