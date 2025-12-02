# RAG Pipeline Refactor

This directory contains the refactored RAG (Retrieval-Augmented Generation) pipeline that uses Supabase vector database instead of KV store embeddings.

## Architecture

The RAG pipeline is split into four main modules:

### 1. `embeddings.ts`
- Generates vector embeddings using Hugging Face
- Model: `sentence-transformers/all-MiniLM-L6-v2`
- Embedding dimension: **384** (validated)
- Functions:
  - `embedQuery(text)` - Generate embedding for a single query
  - `embedDocuments(texts[])` - Generate embeddings for multiple documents
  - `getEmbeddingDimension()` - Returns 384
  - `getEmbeddingModel()` - Returns model name

### 2. `github.ts`
- Fetches repository contents from GitHub
- **Limits to 50 files** for performance and token management
- Supports multiple file types (code, markdown, config files)
- Functions:
  - `fetchGitHubRepo(owner, repo)` - Fetch repository contents
  - `formatRepositoryContent(content)` - Format for processing

### 3. `vector-search.ts`
- Supabase pgvector similarity search
- Uses `match_embeddings` function for efficient queries
- Fallback to manual cosine similarity if function unavailable
- Functions:
  - `storeEmbeddings()` - Store embeddings in `embeddings` table
  - `searchSimilarChunks()` - Query similar chunks using pgvector
  - `deleteRepositoryEmbeddings()` - Clean up embeddings
  - `getEmbeddingCount()` - Get count for a repository

### 4. `query.ts`
- Main RAG orchestration module
- Complete pipeline flow:
  1. Fetch GitHub repo files (limit 50)
  2. Chunk content using RecursiveCharacterTextSplitter
  3. Generate HF embeddings (384 dimensions)
  4. Store in vector table
  5. Query similar chunks using pgvector
  6. Inject context into Claude prompt
- Functions:
  - `createRAGClient(config)` - Initialize RAG client
  - `embedRepository()` - Complete embedding pipeline
  - `queryRepository()` - Query with RAG context

## Usage

```typescript
import { createRAGClient } from './lib/rag/query.js';

// Initialize client
const ragClient = createRAGClient({
  supabaseUrl: process.env.SUPABASE_URL!,
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  hfToken: process.env.HF_TOKEN,
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  githubToken: process.env.GITHUB_TOKEN, // Optional, for higher rate limits
});

// Embed a repository
await ragClient.embedRepository({
  repoId: 'repo-123',
  owner: 'owner',
  repo: 'repo-name',
  onProgress: (message) => console.log(message),
});

// Query a repository
const response = await ragClient.queryRepository({
  repoId: 'repo-123',
  question: 'How does authentication work?',
  chatHistory: [
    { role: 'user', content: 'Previous question' },
    { role: 'assistant', content: 'Previous answer' },
  ],
  maxChunks: 3,
});
```

## Database Requirements

### Embeddings Table Schema

The `embeddings` table should have the following structure:

```sql
CREATE TABLE embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repo_id TEXT NOT NULL,
  chunk_text TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  file_path TEXT,
  embedding vector(384) NOT NULL,  -- pgvector column
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for efficient vector search
CREATE INDEX ON embeddings USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Index for repo_id lookups
CREATE INDEX idx_embeddings_repo_id ON embeddings(repo_id);
```

### match_embeddings Function

Create this function in your Supabase database for efficient vector similarity search:

```sql
CREATE OR REPLACE FUNCTION match_embeddings(
  query_embedding vector(384),
  repo_id TEXT,
  match_threshold FLOAT DEFAULT 0.0,
  match_count INT DEFAULT 3
)
RETURNS TABLE (
  chunk_text TEXT,
  similarity FLOAT,
  file_path TEXT,
  chunk_index INTEGER,
  metadata JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.chunk_text,
    1 - (e.embedding <=> query_embedding) AS similarity,
    e.file_path,
    e.chunk_index,
    e.metadata
  FROM embeddings e
  WHERE e.repo_id = match_embeddings.repo_id
    AND 1 - (e.embedding <=> query_embedding) >= match_threshold
  ORDER BY e.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

## Key Features

### ✅ Embedding Dimension Correctness
- Validates all embeddings are exactly 384 dimensions
- Throws errors if dimension mismatch detected

### ✅ Token Limits Respected
- Context truncation based on token estimates
- Configurable max tokens for responses
- Chunk size: 1000, overlap: 200

### ✅ Error Handling
- GitHub API failures handled gracefully
- Hugging Face API failures with clear error messages
- Supabase connection errors handled
- Rate limit detection and warnings

### ✅ Performance Optimizations
- Batch embedding storage (100 records per batch)
- Efficient pgvector similarity search
- Progress callbacks for long-running operations
- File fetching with rate limit delays

## Migration from KV Store

The refactored implementation replaces:
- ❌ KV store embeddings (`kv.set('embeddings:${repoId}', ...)`)
- ❌ In-memory cosine similarity calculation
- ✅ Supabase vector database with `embeddings` table
- ✅ SQL-based vector search using pgvector

## Performance Notes

1. **Vector Search**: Using pgvector with IVFFlat index provides fast similarity search even with thousands of embeddings
2. **Batch Operations**: Embeddings are stored in batches to avoid payload size limits
3. **Caching**: Consider caching frequently accessed embeddings at the application level
4. **Indexing**: Ensure proper indexes on `repo_id` and vector column for optimal performance

## Accuracy Improvements

1. **Better Ranking**: pgvector's cosine distance operator provides more accurate similarity scores
2. **Scalability**: Can handle much larger repositories without memory constraints
3. **Persistence**: Embeddings persist across server restarts
4. **Query Optimization**: Database-level optimizations improve search speed

