'use client'
import React from 'react';
import { motion } from 'framer-motion';
import { Github, Loader2, AlertCircle, CheckCircle, Trash2 } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import type { Repository } from '../utils/api';

interface RepositoryCardProps {
  repository: Repository;
  onClick?: () => void;
  onDelete?: () => void;
}

export function RepositoryCard({ repository, onClick, onDelete }: RepositoryCardProps) {
  const statusConfig = {
    processing: {
      icon: Loader2,
      label: 'Processing',
      color: 'bg-blue-500',
      className: 'animate-spin',
    },
    ready: {
      icon: CheckCircle,
      label: 'Ready',
      color: 'bg-green-500',
      className: '',
    },
    error: {
      icon: AlertCircle,
      label: 'Error',
      color: 'bg-red-500',
      className: '',
    },
  };
  
  const status = statusConfig[repository.status];
  const StatusIcon = status.icon;
  
  // Check if this is an old format repository
  const isOldFormat = repository.id.includes(':');
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2 }}
    >
      <Card 
        className="cursor-pointer hover:shadow-md transition-shadow relative group"
        onClick={repository.status === 'ready' && !isOldFormat ? onClick : undefined}
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-primary rounded-lg">
              <Github className="size-5 text-primary-foreground" />
            </div>
            
            <div className="flex-1 min-w-0">
              <h3 className="truncate mb-1">
                {repository.owner}/{repository.name}
              </h3>
              
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="gap-1">
                  <StatusIcon className={`size-3 ${status.className}`} />
                  {status.label}
                </Badge>
                
                {repository.chunkCount && (
                  <span className="text-xs text-muted-foreground">
                    {repository.chunkCount} chunks
                  </span>
                )}
              </div>
              
              {isOldFormat && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                  Old format - please remove and re-add this repository
                </p>
              )}
              
              {repository.error && (
                <p className="text-xs text-destructive mt-2">
                  {repository.error}
                </p>
              )}
            </div>
            
            {onDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}