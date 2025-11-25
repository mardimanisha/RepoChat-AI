/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Embeddings module for generating vector embeddings using Hugging Face
 * Model: sentence-transformers/all-MiniLM-L6-v2 (384 dimensions)
 */

import { HuggingFaceInferenceEmbeddings } from '@langchain/community/embeddings/hf';

const EMBEDDING_MODEL = 'sentence-transformers/all-MiniLM-L6-v2';
const EMBEDDING_DIMENSION = 384;

/**
 * Initialize Hugging Face embeddings client
 * @param hfToken - Hugging Face API token
 * @returns HuggingFaceInferenceEmbeddings instance
 */
export function getEmbeddings(hfToken?: string): HuggingFaceInferenceEmbeddings {
  // Support both Node.js and Deno environments
  let token = hfToken;
  if (!token) {
    if (typeof process !== 'undefined' && process.env) {
      token = process.env.HF_TOKEN;
    } else if (typeof Deno !== 'undefined' && Deno.env) {
      token = Deno.env.get('HF_TOKEN');
    }
  }
  
  if (!token) {
    throw new Error('HF_TOKEN environment variable is required for embeddings');
  }
  
  return new HuggingFaceInferenceEmbeddings({
    apiKey: token,
    model: EMBEDDING_MODEL,
  });
}

/**
 * Generate embedding for a single query text
 * @param text - Text to embed
 * @param hfToken - Optional Hugging Face API token
 * @returns Promise resolving to embedding vector (384 dimensions)
 */
export async function embedQuery(
  text: string,
  hfToken?: string
): Promise<number[]> {
  try {
    const embeddings = getEmbeddings(hfToken);
    const vector = await embeddings.embedQuery(text);
    
    // Validate dimension
    if (vector.length !== EMBEDDING_DIMENSION) {
      throw new Error(
        `Expected embedding dimension ${EMBEDDING_DIMENSION}, got ${vector.length}`
      );
    }
    
    return vector;
  } catch (error) {
    console.error('Error generating query embedding:', error);
    throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generate embeddings for multiple documents
 * @param texts - Array of texts to embed
 * @param hfToken - Optional Hugging Face API token
 * @returns Promise resolving to array of embedding vectors (384 dimensions each)
 */
export async function embedDocuments(
  texts: string[],
  hfToken?: string
): Promise<number[][]> {
  try {
    if (texts.length === 0) {
      return [];
    }
    
    const embeddings = getEmbeddings(hfToken);
    const vectors = await embeddings.embedDocuments(texts);
    
    // Validate dimensions
    for (let i = 0; i < vectors.length; i++) {
      if (vectors[i].length !== EMBEDDING_DIMENSION) {
        throw new Error(
          `Expected embedding dimension ${EMBEDDING_DIMENSION} for document ${i}, got ${vectors[i].length}`
        );
      }
    }
    
    return vectors;
  } catch (error) {
    console.error('Error generating document embeddings:', error);
    throw new Error(`Failed to generate document embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get the expected embedding dimension
 * @returns Embedding dimension (384)
 */
export function getEmbeddingDimension(): number {
  return EMBEDDING_DIMENSION;
}

/**
 * Get the embedding model name
 * @returns Model name
 */
export function getEmbeddingModel(): string {
  return EMBEDDING_MODEL;
}

