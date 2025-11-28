/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'
import React from 'react';
import { motion } from 'framer-motion';
import { User, Bot } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Message } from '../utils/api';

interface ChatMessageProps {
  message: Message & { isStreaming?: boolean };
}

// Animated loading dots component
function LoadingDots() {
  return (
    <div className="flex items-center gap-1 py-1">
      <motion.span
        className="w-2 h-2 rounded-full bg-current opacity-60"
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.6, 1, 0.6],
        }}
        transition={{
          duration: 1.4,
          repeat: Infinity,
          delay: 0,
        }}
      />
      <motion.span
        className="w-2 h-2 rounded-full bg-current opacity-60"
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.6, 1, 0.6],
        }}
        transition={{
          duration: 1.4,
          repeat: Infinity,
          delay: 0.2,
        }}
      />
      <motion.span
        className="w-2 h-2 rounded-full bg-current opacity-60"
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.6, 1, 0.6],
        }}
        transition={{
          duration: 1.4,
          repeat: Infinity,
          delay: 0.4,
        }}
      />
    </div>
  );
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const isStreaming = message.isStreaming && !isUser;
  
  return (
    <motion.div
      key={message.id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={`flex gap-3 mb-4 ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center">
          <Bot className="size-4 text-primary-foreground" />
        </div>
      )}
      
      <div className={`max-w-[70%] ${isUser ? 'order-first' : ''}`}>
        <div
          className={`rounded-2xl px-4 py-2 ${
            isUser
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-foreground'
          }`}
        >
          {isStreaming ? (
            <LoadingDots />
          ) : isUser ? (
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
              {message.content}
            </p>
          ) : (
            <div className="max-w-none text-sm leading-relaxed">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  // Custom styling for code blocks
                  code({ node, inline, className, children, ...props } : any) {
                    const match = /language-(\w+)/.exec(className || '');
                    return !inline && match ? (
                      <pre className="bg-muted-foreground/10 rounded-lg p-3 overflow-x-auto my-2">
                        <code className={className} {...props}>
                          {children}
                        </code>
                      </pre>
                    ) : (
                      <code className="bg-muted-foreground/10 px-1.5 py-0.5 rounded text-xs" {...props}>
                        {children}
                      </code>
                    );
                  },
                  // Custom styling for headings
                  h1: ({ node, ...props }) => <h1 className="text-lg font-bold mt-4 mb-2" {...props} />,
                  h2: ({ node, ...props }) => <h2 className="text-base font-bold mt-3 mb-2" {...props} />,
                  h3: ({ node, ...props }) => <h3 className="text-sm font-semibold mt-2 mb-1" {...props} />,
                  // Custom styling for lists
                  ul: ({ node, ...props }) => <ul className="list-disc list-inside my-2 space-y-1" {...props} />,
                  ol: ({ node, ...props }) => <ol className="list-decimal list-inside my-2 space-y-1" {...props} />,
                  li: ({ node, ...props }) => <li className="ml-2" {...props} />,
                  // Custom styling for paragraphs
                  p: ({ node, ...props }) => <p className="my-2 break-words" {...props} />,
                  // Custom styling for links
                  a: ({ node, ...props }) => (
                    <a className="text-primary underline hover:text-primary/80" {...props} />
                  ),
                  // Custom styling for tables
                  table: ({ node, ...props }) => (
                    <div className="overflow-x-auto my-2">
                      <table className="border-collapse border border-border" {...props} />
                    </div>
                  ),
                  th: ({ node, ...props }) => (
                    <th className="border border-border px-2 py-1 bg-muted-foreground/10 font-semibold" {...props} />
                  ),
                  td: ({ node, ...props }) => (
                    <td className="border border-border px-2 py-1" {...props} />
                  ),
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>
      
      {isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
          <User className="size-4 text-secondary-foreground" />
        </div>
      )}
    </motion.div>
  );
}
