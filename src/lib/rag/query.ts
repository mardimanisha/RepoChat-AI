/* eslint-disable @typescript-eslint/no-explicit-any */
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { SupabaseClient } from "@supabase/supabase-js";
import { GeminiClient } from "../ai/gemini-client";
import * as embeddingsModule from "./embeddings";
import * as githubModule from "./github";
import * as vectorSearchModule from "./vector-search";

// Token limits
const MAX_CONTEXT_TOKENS = 8000;
const MAX_RESPONSE_TOKENS = 1024;
const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;
const TOP_K_CHUNKS = 3;

export interface RAGConfig {
  supabaseUrl: string;
  supabaseKey: string;
  hfToken?: string;
  geminiApiKey?: string; // Changed from anthropicApiKey
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
  chatHistory?: Array<{ role: "user" | "assistant"; content: string }>;
  maxChunks?: number;
}

/**
 * Initialize RAG client with Gemini configuration
 */
export function createRAGClient(config: RAGConfig) {
  const supabaseClient = vectorSearchModule.createSupabaseVectorClient(
    config.supabaseUrl,
    config.supabaseKey
  );

  const geminiClient = config.geminiApiKey
    ? new GeminiClient({
        apiKey: config.geminiApiKey,
        model: "gemini-2.5-flash", // Using latest Gemini model
      })
    : null;

  return {
    supabaseClient,
    geminiClient,

    /**
     * Embed a repository: fetch, chunk, embed, and store
     */
    async embedRepository(options: EmbedRepositoryOptions): Promise<void> {
      const { repoId, owner, repo, onProgress } = options;

      try {
        onProgress?.(`Starting embedding process for ${owner}/${repo}`);

        // Step 1: Fetch GitHub repository contents
        onProgress?.("Fetching repository contents from GitHub...");
        const repoContent = await githubModule.fetchGitHubRepo(
          owner,
          repo,
          config.githubToken
        );

        onProgress?.(
          `Fetched ${repoContent.files.length} files from repository`
        );

        // Step 2: Format and chunk content
        onProgress?.("Chunking repository content...");
        const formattedContent =
          githubModule.formatRepositoryContent(repoContent);

        const textSplitter = new RecursiveCharacterTextSplitter({
          chunkSize: CHUNK_SIZE,
          chunkOverlap: CHUNK_OVERLAP,
        });

        const chunks = await textSplitter.createDocuments([formattedContent]);
        onProgress?.(`Split repository into ${chunks.length} chunks`);

        // Step 3: Generate embeddings
        onProgress?.("Generating embeddings...");
        const chunkTexts = chunks.map((chunk) => chunk.pageContent);
        const vectors = await embeddingsModule.embedDocuments(
          chunkTexts,
          config.hfToken
        );

        onProgress?.(`Generated ${vectors.length} embeddings`);

        // Step 4: Store embeddings in vector table
        onProgress?.("Storing embeddings in vector database...");

        // Delete existing embeddings for this repo
        await vectorSearchModule.deleteRepositoryEmbeddings(
          supabaseClient,
          repoId
        );

        // Store new embeddings
        await vectorSearchModule.storeEmbeddings(
          supabaseClient,
          repoId,
          chunkTexts,
          vectors
        );

        onProgress?.(`Successfully embedded repository ${repoId}`);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        onProgress?.(`Error embedding repository: ${errorMessage}`);
        throw error;
      }
    },

    /**
     * Query a repository with a question using Gemini
     */
    async queryRepository(options: QueryRepositoryOptions): Promise<string> {
      const {
        repoId,
        question,
        chatHistory = [],
        maxChunks = TOP_K_CHUNKS,
      } = options;

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
          0.0
        );

        if (similarChunks.length === 0) {
          throw new Error("No relevant chunks found for the query");
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
          .join("\n\n---\n\n");

        // Step 4: Build system prompt
        const systemPrompt = `You are a helpful AI assistant that answers questions about a GitHub repository. 
Use the following context from the repository to answer the user's question accurately and helpfully.
If the context doesn't contain relevant information, say so clearly.

Repository Context:
${context}`;

        // Step 5: Build conversation messages in Gemini format
        const messages: Array<{ role: "user" | "model"; content: string }> = [];

        // Add chat history (convert 'assistant' to 'model' for Gemini)
        for (const msg of chatHistory.slice(-10)) {
          messages.push({
            role: msg.role === "assistant" ? "model" : "user",
            content: msg.content,
          });
        }

        // Add current question
        messages.push({
          role: "user",
          content: question,
        });

        // Step 6: Query Gemini with context
        if (!geminiClient) {
          throw new Error(
            "Gemini API key not configured. Please set GOOGLE_AI_API_KEY environment variable."
          );
        }

        let response: string;
        try {
          response = await geminiClient.generateContent({
            system: systemPrompt,
            messages,
            maxTokens: MAX_RESPONSE_TOKENS,
            temperature: 0.7,
          });
        } catch (apiError: any) {
          // Handle Gemini API errors
          console.error("[RAG] Gemini API error:", {
            error: apiError.message,
            requestId: apiError.requestId,
          });

          if (
            apiError.message?.includes("API key") ||
            apiError.message?.includes("authentication")
          ) {
            throw new Error(
              `Invalid Gemini API key: ${apiError.message}. Please verify your GOOGLE_AI_API_KEY environment variable.`
            );
          }
          throw apiError;
        }

        return response;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
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
      return await vectorSearchModule.deleteRepositoryEmbeddings(
        supabaseClient,
        repoId
      );
    },
  };
}

/**
 * Estimate token count (rough approximation)
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Truncate context to fit within token limits
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
