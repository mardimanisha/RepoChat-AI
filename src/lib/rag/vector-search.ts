/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Vector search module for Supabase pgvector similarity search
 * Uses match_embeddings function for efficient vector similarity queries
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

const EMBEDDING_DIMENSION = 384;

export interface EmbeddingRecord {
  id: string;
  repo_id: string;
  chunk_text: string;
  chunk_index: number;
  file_path: string | null;
  embedding: number[];
  metadata: Record<string, any> | null;
  created_at: string;
}

export interface SimilarChunk {
  chunk_text: string;
  similarity: number;
  file_path: string | null;
  chunk_index: number;
  metadata: Record<string, any> | null;
}

/**
 * Create Supabase client for vector operations
 * @param supabaseUrl - Supabase project URL
 * @param supabaseKey - Supabase service role key (for server-side operations)
 * @returns Supabase client instance
 */
export function createSupabaseVectorClient(
  supabaseUrl: string,
  supabaseKey: string
): SupabaseClient {
  return createClient(supabaseUrl, supabaseKey);
}

/**
 * Store embeddings in the embeddings table
 * @param client - Supabase client
 * @param repoId - Repository ID
 * @param chunks - Array of chunk texts
 * @param embeddings - Array of embedding vectors (384 dimensions)
 * @returns Promise resolving to array of inserted record IDs
 */
export async function storeEmbeddings(
  client: SupabaseClient,
  repoId: string,
  chunks: string[],
  embeddings: number[][]
): Promise<string[]> {
  try {
    if (chunks.length !== embeddings.length) {
      throw new Error("Chunks and embeddings arrays must have the same length");
    }

    // Validate embedding dimensions
    for (let i = 0; i < embeddings.length; i++) {
      if (embeddings[i].length !== EMBEDDING_DIMENSION) {
        throw new Error(
          `Embedding ${i} has dimension ${embeddings[i].length}, expected ${EMBEDDING_DIMENSION}`
        );
      }
    }

    // Prepare records for insertion
    const records = chunks.map((chunkText, index) => ({
      repository_id: repoId,
      text: chunkText,
      chunk_index: index,
      embedding: embeddings[index],
    }));

    // Insert embeddings in batches to avoid payload size limits
    const batchSize = 100;
    const insertedIds: string[] = [];

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);

      const { data, error } = await client
        .from("embeddings")
        .insert(batch)
        .select("id");

      if (error) {
        throw new Error(
          `Failed to store embeddings batch ${i / batchSize + 1}: ${
            error.message
          }`
        );
      }

      if (data) {
        insertedIds.push(...data.map((r: any) => r.id));
      }
    }

    return insertedIds;
  } catch (error) {
    console.error("Error storing embeddings:", error);
    throw error;
  }
}

/**
 * Delete all embeddings for a repository
 * @param client - Supabase client
 * @param repoId - Repository ID
 * @returns Promise resolving when deletion is complete
 */
export async function deleteRepositoryEmbeddings(
  client: SupabaseClient,
  repoId: string
): Promise<void> {
  try {
    const { error } = await client
      .from("embeddings")
      .delete()
      .eq("repository_id", repoId);

    if (error) {
      throw new Error(`Failed to delete embeddings: ${error.message}`);
    }
  } catch (error) {
    console.error("Error deleting embeddings:", error);
    throw error;
  }
}

/**
 * Search for similar chunks using pgvector match_embeddings function
 * @param client - Supabase client
 * @param repoId - Repository ID
 * @param queryEmbedding - Query embedding vector (384 dimensions)
 * @param limit - Maximum number of results (default: 3)
 * @param threshold - Minimum similarity threshold (default: 0.0)
 * @returns Promise resolving to array of similar chunks
 */
export async function searchSimilarChunks(
  client: SupabaseClient,
  repoId: string,
  queryEmbedding: number[],
  limit: number = 3,
  threshold: number = 0.0
): Promise<SimilarChunk[]> {
  try {
    // Validate embedding dimension
    if (queryEmbedding.length !== EMBEDDING_DIMENSION) {
      throw new Error(
        `Query embedding has dimension ${queryEmbedding.length}, expected ${EMBEDDING_DIMENSION}`
      );
    }

    // Use match_embeddings function for vector similarity search
    // This function should be created in the database with pgvector
    const { data, error } = await client.rpc("match_embeddings", {
      query_embedding: queryEmbedding,
      match_repository_id: repoId,
      match_threshold: threshold,
      match_count: limit,
    });

    if (error) {
      // Fallback to direct query if function doesn't exist
      console.warn(
        "match_embeddings function not found, using fallback query:",
        error.message
      );
      return await searchSimilarChunksFallback(
        client,
        repoId,
        queryEmbedding,
        limit,
        threshold
      );
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Transform results to SimilarChunk format
    return data.map((item: any) => ({
      chunk_text: item.text || item.chunk_text,
      similarity: item.similarity || 0,
      file_path: item.file_path || null,
      chunk_index: item.chunk_index || 0,
      metadata: item.metadata || null,
    }));
  } catch (error) {
    console.error("Error searching similar chunks:", error);
    throw error;
  }
}

/**
 * Fallback vector search using direct SQL query
 * Used when match_embeddings function is not available
 * @param client - Supabase client
 * @param repoId - Repository ID
 * @param queryEmbedding - Query embedding vector
 * @param limit - Maximum number of results
 * @param threshold - Minimum similarity threshold
 * @returns Promise resolving to array of similar chunks
 */
async function searchSimilarChunksFallback(
  client: SupabaseClient,
  repoId: string,
  queryEmbedding: number[],
  limit: number,
  threshold: number
): Promise<SimilarChunk[]> {
  try {
    // Use cosine distance operator (<=>) for pgvector
    // This requires the embedding column to be of type vector(384)
    const { data, error } = await client
      .from("embeddings")
      .select("text, chunk_index, embedding")
      .eq("repository_id", repoId)
      .limit(limit * 2); // Get more results to filter by threshold

    if (error) {
      throw new Error(`Fallback search failed: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Calculate cosine similarity manually as fallback
    const results: SimilarChunk[] = [];

    for (const item of data as any[]) {
      const similarity = cosineSimilarity(
        queryEmbedding,
        item.embedding as number[]
      );

      if (similarity >= threshold) {
        results.push({
          chunk_text: item.text || item.chunk_text,
          similarity,
          file_path: item.file_path || null,
          chunk_index: item.chunk_index || 0,
          metadata: item.metadata || null,
        });
      }
    }

    // Sort by similarity and limit
    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, limit);
  } catch (error) {
    console.error("Error in fallback search:", error);
    throw error;
  }
}

/**
 * Calculate cosine similarity between two vectors
 * @param a - First vector
 * @param b - Second vector
 * @returns Cosine similarity score (0-1)
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Vectors must have the same length");
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    magnitudeA += a[i] * a[i];
    magnitudeB += b[i] * b[i];
  }

  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dotProduct / (magnitudeA * magnitudeB);
}

/**
 * Get embedding count for a repository
 * @param client - Supabase client
 * @param repoId - Repository ID
 * @returns Promise resolving to count of embeddings
 */
export async function getEmbeddingCount(
  client: SupabaseClient,
  repoId: string
): Promise<number> {
  try {
    const { count, error } = await client
      .from("embeddings")
      .select("*", { count: "exact", head: true })
      .eq("repository_id", repoId);

    if (error) {
      throw new Error(`Failed to get embedding count: ${error.message}`);
    }

    return count || 0;
  } catch (error) {
    console.error("Error getting embedding count:", error);
    throw error;
  }
}
