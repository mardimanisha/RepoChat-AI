/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Main RAG query module
 * Orchestrates the complete RAG pipeline:
 * 1. Fetch GitHub repo files (limit 50)
 * 2. Chunk content
 * 3. Generate HF embeddings
 * 4. Store in vector table
 * 5. Query similar chunks using pgvector
 * 6. Inject context into Claude prompt
 */

import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import Anthropic from '@anthropic-ai/sdk';
import { SupabaseClient } from '@supabase/supabase-js';
import * as embeddingsModule from './embeddings';
import * as githubModule from './github';
import * as vectorSearchModule from './vector-search';

// Token limits
const MAX_CONTEXT_TOKENS = 8000; // Reserve tokens for context
const MAX_RESPONSE_TOKENS = 1024;
const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;
const TOP_K_CHUNKS = 3;

export interface RAGConfig {
  supabaseUrl: string;
  supabaseKey: string;
  hfToken?: string;
  anthropicApiKey?: string;
  githubToken?: string;
}

export interface EmbedRepositoryOptions {
  repoId: string;
  owner: string;
  repo: string;
  onProgress?: (message: string) => void;
}

export interface QueryRepositoryOptions {
  repoId: string;
  question: string;
  chatHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  maxChunks?: number;
}

/**
 * Initialize RAG client with configuration
 * @param config - RAG configuration
 * @returns Object with initialized clients and methods
 */
export function createRAGClient(config: RAGConfig) {
  const supabaseClient = vectorSearchModule.createSupabaseVectorClient(
    config.supabaseUrl,
    config.supabaseKey
  );
  
  const anthropicClient = config.anthropicApiKey
    ? new Anthropic({ apiKey: config.anthropicApiKey })
    : null;
  
  return {
    supabaseClient,
    anthropicClient,
    
    /**
     * Embed a repository: fetch, chunk, embed, and store
     */
    async embedRepository(options: EmbedRepositoryOptions): Promise<void> {
      const { repoId, owner, repo, onProgress } = options;
      
      try {
        onProgress?.(`Starting embedding process for ${owner}/${repo}`);
        
        // Step 1: Fetch GitHub repository contents
        onProgress?.('Fetching repository contents from GitHub...');
        const repoContent = await githubModule.fetchGitHubRepo(
          owner,
          repo,
          config.githubToken
        );
        
        onProgress?.(`Fetched ${repoContent.files.length} files from repository`);
        
        // Step 2: Format and chunk content
        onProgress?.('Chunking repository content...');
        const formattedContent = githubModule.formatRepositoryContent(repoContent);
        
        const textSplitter = new RecursiveCharacterTextSplitter({
          chunkSize: CHUNK_SIZE,
          chunkOverlap: CHUNK_OVERLAP,
        });
        
        const chunks = await textSplitter.createDocuments([formattedContent]);
        onProgress?.(`Split repository into ${chunks.length} chunks`);
        
        // Step 3: Generate embeddings
        onProgress?.('Generating embeddings...');
        const chunkTexts = chunks.map(chunk => chunk.pageContent);
        const vectors = await embeddingsModule.embedDocuments(
          chunkTexts,
          config.hfToken
        );
        
        onProgress?.(`Generated ${vectors.length} embeddings`);
        
        // Step 4: Store embeddings in vector table
        onProgress?.('Storing embeddings in vector database...');
        
        // Delete existing embeddings for this repo
        await vectorSearchModule.deleteRepositoryEmbeddings(supabaseClient, repoId);
        
        // Store new embeddings
        await vectorSearchModule.storeEmbeddings(
          supabaseClient,
          repoId,
          chunkTexts,
          vectors
        );
        
        onProgress?.(`Successfully embedded repository ${repoId}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        onProgress?.(`Error embedding repository: ${errorMessage}`);
        throw error;
      }
    },
    
    /**
     * Query a repository with a question
     */
    async queryRepository(options: QueryRepositoryOptions): Promise<string> {
      const { repoId, question, chatHistory = [], maxChunks = TOP_K_CHUNKS } = options;
      
      try {
        // Step 1: Generate query embedding
        const questionVector = await embeddingsModule.embedQuery(
          question,
          config.hfToken
        );
        
        // Step 2: Search for similar chunks using pgvector
        const similarChunks = await vectorSearchModule.searchSimilarChunks(
          supabaseClient,
          repoId,
          questionVector,
          maxChunks,
          0.0 // No minimum threshold, let ranking handle it
        );
        
        if (similarChunks.length === 0) {
          throw new Error('No relevant chunks found for the query');
        }
        
        // Step 3: Build context from top chunks
        const context = similarChunks
          .map((chunk, index) => {
            let contextText = `[Chunk ${index + 1}]`;
            if (chunk.file_path) {
              contextText += ` (from ${chunk.file_path})`;
            }
            contextText += `\n${chunk.chunk_text}`;
            return contextText;
          })
          .join('\n\n---\n\n');
        
        // Step 4: Build chat history
        const historyText = chatHistory
          .slice(-10) // Last 10 messages
          .map(msg => `${msg.role === 'user' ? 'Human' : 'Assistant'}: ${msg.content}`)
          .join('\n');
        
        // Step 5: Query Anthropic with context
        if (!anthropicClient) {
          throw new Error('Anthropic API key not configured. Please set ANTHROPIC_API_KEY environment variable.');
        }
        
        const systemPrompt = `You are a helpful AI assistant that answers questions about a GitHub repository. 
Use the following context from the repository to answer the user's question accurately and helpfully.
If the context doesn't contain relevant information, say so clearly.

Repository Context:
${context}`;

        const userPrompt = historyText
          ? `${historyText}\nHuman: ${question}`
          : question;
        
        let message;
        try {
          message = await anthropicClient.messages.create({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: MAX_RESPONSE_TOKENS,
            messages: [
              {
                role: 'user',
                content: userPrompt,
              }
            ],
            system: systemPrompt,
          });
        } catch (apiError: any) {
          // Handle Anthropic API errors more gracefully
          console.error('[RAG] Anthropic API error:', {
            status: apiError.status,
            errorType: apiError.error?.type,
            errorMessage: apiError.error?.message,
            requestId: apiError.requestID,
          });
          
          if (apiError.status === 401 || apiError.error?.type === 'authentication_error') {
            const detailedMessage = apiError.error?.message || 'Invalid API key';
            throw new Error(`Invalid Anthropic API key: ${detailedMessage}. Please verify your ANTHROPIC_API_KEY environment variable is correct and not expired.`);
          }
          throw apiError;
        }
        
        const response = message.content[0].type === 'text' 
          ? message.content[0].text 
          : 'Unable to generate response';
        
        return response;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Error querying repository ${repoId}:`, error);
        throw new Error(`Failed to query repository: ${errorMessage}`);
      }
    },
    
    /**
     * Get embedding count for a repository
     */
    async getEmbeddingCount(repoId: string): Promise<number> {
      return await vectorSearchModule.getEmbeddingCount(supabaseClient, repoId);
    },
    
    /**
     * Delete all embeddings for a repository
     */
    async deleteRepositoryEmbeddings(repoId: string): Promise<void> {
      return await vectorSearchModule.deleteRepositoryEmbeddings(supabaseClient, repoId);
    },
  };
}

/**
 * Estimate token count (rough approximation)
 * @param text - Text to estimate
 * @returns Estimated token count
 */
export function estimateTokens(text: string): number {
  // Rough approximation: 1 token ≈ 4 characters
  return Math.ceil(text.length / 4);
}

/**
 * Truncate context to fit within token limits
 * @param chunks - Array of chunk texts
 * @param maxTokens - Maximum tokens allowed
 * @returns Truncated array of chunks
 */
export function truncateContext(
  chunks: string[],
  maxTokens: number = MAX_CONTEXT_TOKENS
): string[] {
  const result: string[] = [];
  let totalTokens = 0;
  
  for (const chunk of chunks) {
    const chunkTokens = estimateTokens(chunk);
    
    if (totalTokens + chunkTokens > maxTokens) {
      break;
    }
    
    result.push(chunk);
    totalTokens += chunkTokens;
  }
  
  return result;
}

