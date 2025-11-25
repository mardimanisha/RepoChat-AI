'use client'
import React from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Github } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Sidebar } from '../components/sidebar';

export default function HomePage() {
  const router = useRouter();
  
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-2xl w-full text-center space-y-8"
        >
          <div className="space-y-4">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring' }}
              className="inline-block p-4 bg-primary rounded-2xl"
            >
              <Github className="size-12 text-primary-foreground" />
            </motion.div>
            
            <h1 className="text-4xl">
              Chat with GitHub Repositories
            </h1>
            
            <p className="text-muted-foreground text-lg">
              Sign in to start chatting with your favorite repositories using AI-powered insights
            </p>
          </div>
          
          <div className="flex gap-4 justify-center">
            <Button
              size="lg"
              onClick={() => router.push('/auth?mode=signin')}
            >
              Sign In
            </Button>
            
            <Button
              size="lg"
              variant="outline"
              onClick={() => router.push('/auth?mode=signup')}
            >
              Sign Up
            </Button>
          </div>
        </motion.div>
      </div>
      
      <div className="fixed top-4 right-4 flex gap-2">
        <Button
          variant="ghost"
          onClick={() => router.push('/auth?mode=signin')}
        >
          Sign In
        </Button>
        
        <Button
          onClick={() => router.push('/auth?mode=signup')}
        >
          Sign Up
        </Button>
      </div>
    </div>
  );
}
