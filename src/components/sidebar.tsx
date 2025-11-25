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
  }>;
  onNewChat?: () => void;
  onChatSelect?: (chatId: string) => void;
  onLogout?: () => void;
  selectedChatId?: string;
}

export function Sidebar({ 
  user, 
  chats = [], 
  onNewChat, 
  onChatSelect,
  onLogout,
  selectedChatId 
}: SidebarProps) {
  const { theme, toggleTheme } = useTheme();
  
  return (
    <motion.div
      initial={{ x: -300 }}
      animate={{ x: 0 }}
      className="w-64 h-screen bg-sidebar border-r border-sidebar-border flex flex-col"
    >
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
      
      <Separator />
      
      <div className="flex-1 overflow-y-auto p-2">
        {chats.map((chat) => (
          <motion.button
            key={chat.id}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onChatSelect?.(chat.id)}
            className={`w-full text-left p-3 rounded-lg mb-1 flex items-center gap-2 transition-colors ${
              selectedChatId === chat.id
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'hover:bg-sidebar-accent/50 text-sidebar-foreground'
            }`}
          >
            <MessageSquare className="size-4 flex-shrink-0" />
            <span className="truncate text-sm">{chat.title}</span>
          </motion.button>
        ))}
      </div>
      
      {user && (
        <>
          <Separator />
          <div className="p-2">
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
