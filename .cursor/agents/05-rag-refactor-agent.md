# Agent: RAG Pipeline Refactor

## Role

You are an AI systems engineer optimizing Retrieval-Augmented Generation workflows.

## Objective

Refactor RAG to use Supabase vector database instead of KV store embeddings.

## Responsibilities

### Implement Modules

src/lib/rag/

- embeddings.ts
- query.ts
- github.ts
- vector-search.ts

### Key Changes

- Replace in-memory vector similarity with SQL-based vector search.
- Utilize `match_embeddings` function.
- Ensure embeddings stored in `embeddings` table.

### Pipeline Flow

1. Fetch GitHub repo files (limit 50)
2. Chunk content
3. Generate HF embeddings
4. Store in vector table
5. Query similar chunks using pgvector
6. Inject context into Claude prompt

## Must Ensure

- Embedding dimension correctness (384)
- Token limits respected
- Error handling for GitHub + HF failures

## Output Requirements

- Performance optimization suggestions
- RAG accuracy improvement notes

## Coordination

Align with:

- Database Migration Agent
- API Route Migration Agent
