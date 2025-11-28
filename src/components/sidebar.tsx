'use client'
import React from 'react';
import { motion } from 'framer-motion';
import { Plus, MessageSquare, User, Settings, Moon, Sun, LogOut } from 'lucide-react';
import { Button } from './ui/button';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Separator } from './ui/separator';
import { useTheme } from '../utils/theme-provider';

interface SidebarProps {
  user?: {
    name: string;
    email: string;
  };
  chats?: Array<{
    id: string;
    title: string;
    repoId?: string;
    repositoryName?: string;
    updatedAt?: string;
  }>;
  onNewChat?: () => void;
  onChatSelect?: (chatId: string, repoId?: string) => void;
  onLogout?: () => void;
  selectedChatId?: string;
  showRecentChatsHeader?: boolean;
}

// Format relative timestamp
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  // For older dates, show formatted date
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function Sidebar({ 
  user, 
  chats = [], 
  onNewChat, 
  onChatSelect,
  onLogout,
  selectedChatId,
  showRecentChatsHeader = false
}: SidebarProps) {
  const { theme, toggleTheme } = useTheme();
  
  return (
    <motion.div
      initial={{ x: -300 }}
      animate={{ x: 0 }}
      className="w-64 h-screen bg-sidebar border-r border-sidebar-border flex flex-col"
    >
      {/* Logo Section - NEW */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
            <svg 
              viewBox="0 0 24 24" 
              className="w-6 h-6 text-primary-foreground" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2"
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
            </svg>
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-sidebar-foreground">RepoChat</h1>
            <p className="text-xs text-muted-foreground">AI Assistant</p>
          </div>
        </div>
      </div>
      
      <div className="p-4">
        {onNewChat && (
          <Button
            onClick={onNewChat}
            className="w-full justify-start gap-2"
            variant="outline"
          >
            <Plus className="size-4" />
            New Chat
          </Button>
        )}
      </div>
      
      <div className="flex-1 overflow-y-auto p-2">
        {showRecentChatsHeader && chats.length > 0 && (
          <div className="px-2 py-2 mb-2">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Recent Chats ({chats.length})
            </h2>
          </div>
        )}
        
        {chats.length === 0 && showRecentChatsHeader ? (
          <div className="px-2 py-4 text-center">
            <p className="text-xs text-muted-foreground">No recent chats</p>
          </div>
        ) : (
          chats.map((chat) => (
            <motion.button
              key={chat.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onChatSelect?.(chat.id, chat.repoId)}
              className={`w-full text-left p-3 rounded-lg mb-1 flex flex-col gap-1 transition-colors ${
                selectedChatId === chat.id
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'hover:bg-sidebar-accent/50 text-sidebar-foreground'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <MessageSquare className="size-4 shrink-0" />
                <span className="truncate text-sm font-medium">{chat.title}</span>
              </div>
              {(chat.repositoryName || chat.updatedAt) && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground pl-6">
                  {chat.repositoryName && (
                    <span className="truncate">{chat.repositoryName}</span>
                  )}
                  {chat.repositoryName && chat.updatedAt && (
                    <span>•</span>
                  )}
                  {chat.updatedAt && (
                    <span className="shrink-0">{formatRelativeTime(chat.updatedAt)}</span>
                  )}
                </div>
              )}
            </motion.button>
          ))
        )}
      </div>
      
      {user && (
        <>
          <Separator />
          <div className="mt-auto p-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-2"
                >
                  <User className="size-4" />
                  <div className="flex-1 text-left truncate">
                    <div className="truncate text-sm">{user.name}</div>
                  </div>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56" side="top" align="start">
                <div className="space-y-2">
                  <div className="px-2 py-1.5">
                    <p className="truncate">{user.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  </div>
                  
                  <Separator />
                  
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-2"
                    onClick={toggleTheme}
                  >
                    {theme === 'light' ? (
                      <>
                        <Moon className="size-4" />
                        Dark Mode
                      </>
                    ) : (
                      <>
                        <Sun className="size-4" />
                        Light Mode
                      </>
                    )}
                  </Button>
                  
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-2"
                    onClick={onLogout}
                  >
                    <LogOut className="size-4" />
                    Logout
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </>
      )}
    </motion.div>
  );
}
