/**
 * RAG Pipeline Module
 * 
 * Refactored RAG implementation using Supabase vector database
 * instead of KV store embeddings.
 * 
 * Modules:
 * - embeddings.ts: Hugging Face embeddings generation (384 dimensions)
 * - github.ts: GitHub repository fetching (limit 50 files)
 * - vector-search.ts: Supabase pgvector similarity search
 * - query.ts: Main RAG query pipeline orchestration
 */

export * from './embeddings.js';
export * from './github.js';
export * from './vector-search.js';
export * from './query.js';
export * from './text-generation.js';

