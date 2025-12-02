-- Migration: 001_create_tables.sql
-- Description: Migrate from KV-store architecture to relational schema with pgvector
-- Created for: RepoChat-AI database migration

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- REPOSITORIES TABLE
-- ============================================================================
-- Stores GitHub repository metadata and processing status
CREATE TABLE repositories (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    owner TEXT NOT NULL,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'ready', 'error')),
    chunk_count INTEGER DEFAULT 0,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_user_repo UNIQUE (user_id, owner, name)
);

-- Index for user's repositories lookup
CREATE INDEX idx_repositories_user_id ON repositories(user_id);
CREATE INDEX idx_repositories_status ON repositories(status);
CREATE INDEX idx_repositories_updated_at ON repositories(updated_at DESC);

-- ============================================================================
-- EMBEDDINGS TABLE
-- ============================================================================
-- Stores vector embeddings for repository content chunks
-- Uses pgvector for similarity search (384 dimensions for all-MiniLM-L6-v2)
CREATE TABLE embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    repository_id TEXT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    embedding vector(384) NOT NULL,
    chunk_index INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_repo_chunk UNIQUE (repository_id, chunk_index)
);

-- Index for vector similarity search using cosine distance
-- HNSW index for fast approximate nearest neighbor search
CREATE INDEX idx_embeddings_vector ON embeddings 
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- Index for repository lookup
CREATE INDEX idx_embeddings_repository_id ON embeddings(repository_id);

-- ============================================================================
-- CHATS TABLE
-- ============================================================================
-- Stores chat sessions for repositories
CREATE TABLE chats (
    id TEXT PRIMARY KEY,
    repository_id TEXT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'New Chat',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for chat queries
CREATE INDEX idx_chats_repository_id ON chats(repository_id);
CREATE INDEX idx_chats_user_id ON chats(user_id);
CREATE INDEX idx_chats_updated_at ON chats(updated_at DESC);

-- ============================================================================
-- MESSAGES TABLE
-- ============================================================================
-- Stores individual messages within chat sessions
CREATE TABLE messages (
    id TEXT PRIMARY KEY,
    chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for message queries
CREATE INDEX idx_messages_chat_id ON messages(chat_id);
CREATE INDEX idx_messages_created_at ON messages(chat_id, created_at ASC);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE repositories ENABLE ROW LEVEL SECURITY;
ALTER TABLE embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- REPOSITORIES POLICIES
-- Users can only see their own repositories
CREATE POLICY "Users can view their own repositories"
    ON repositories FOR SELECT
    USING (auth.uid() = user_id);

-- Users can create their own repositories
CREATE POLICY "Users can create their own repositories"
    ON repositories FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own repositories
CREATE POLICY "Users can update their own repositories"
    ON repositories FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Users can delete their own repositories
CREATE POLICY "Users can delete their own repositories"
    ON repositories FOR DELETE
    USING (auth.uid() = user_id);

-- EMBEDDINGS POLICIES
-- Users can view embeddings for their own repositories
CREATE POLICY "Users can view embeddings for their repositories"
    ON embeddings FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM repositories
            WHERE repositories.id = embeddings.repository_id
            AND repositories.user_id = auth.uid()
        )
    );

-- Users can insert embeddings for their own repositories
CREATE POLICY "Users can insert embeddings for their repositories"
    ON embeddings FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM repositories
            WHERE repositories.id = embeddings.repository_id
            AND repositories.user_id = auth.uid()
        )
    );

-- Users can update embeddings for their own repositories
CREATE POLICY "Users can update embeddings for their repositories"
    ON embeddings FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM repositories
            WHERE repositories.id = embeddings.repository_id
            AND repositories.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM repositories
            WHERE repositories.id = embeddings.repository_id
            AND repositories.user_id = auth.uid()
        )
    );

-- Users can delete embeddings for their own repositories
CREATE POLICY "Users can delete embeddings for their repositories"
    ON embeddings FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM repositories
            WHERE repositories.id = embeddings.repository_id
            AND repositories.user_id = auth.uid()
        )
    );

-- CHATS POLICIES
-- Users can view their own chats
CREATE POLICY "Users can view their own chats"
    ON chats FOR SELECT
    USING (auth.uid() = user_id);

-- Users can create chats for their own repositories
CREATE POLICY "Users can create chats for their repositories"
    ON chats FOR INSERT
    WITH CHECK (
        auth.uid() = user_id
        AND EXISTS (
            SELECT 1 FROM repositories
            WHERE repositories.id = chats.repository_id
            AND repositories.user_id = auth.uid()
        )
    );

-- Users can update their own chats
CREATE POLICY "Users can update their own chats"
    ON chats FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Users can delete their own chats
CREATE POLICY "Users can delete their own chats"
    ON chats FOR DELETE
    USING (auth.uid() = user_id);

-- MESSAGES POLICIES
-- Users can view messages for their own chats
CREATE POLICY "Users can view messages for their chats"
    ON messages FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM chats
            WHERE chats.id = messages.chat_id
            AND chats.user_id = auth.uid()
        )
    );

-- Users can create messages for their own chats
CREATE POLICY "Users can create messages for their chats"
    ON messages FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM chats
            WHERE chats.id = messages.chat_id
            AND chats.user_id = auth.uid()
        )
    );

-- Users can update messages for their own chats
CREATE POLICY "Users can update messages for their chats"
    ON messages FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM chats
            WHERE chats.id = messages.chat_id
            AND chats.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM chats
            WHERE chats.id = messages.chat_id
            AND chats.user_id = auth.uid()
        )
    );

-- Users can delete messages for their own chats
CREATE POLICY "Users can delete messages for their chats"
    ON messages FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM chats
            WHERE chats.id = messages.chat_id
            AND chats.user_id = auth.uid()
        )
    );

-- ============================================================================
-- VECTOR SIMILARITY FUNCTION
-- ============================================================================
-- Function to find similar embeddings using cosine similarity
-- Returns top N most similar chunks for a given query vector
CREATE OR REPLACE FUNCTION match_embeddings(
    query_embedding vector(384),
    match_repository_id TEXT,
    match_threshold FLOAT DEFAULT 0.5,
    match_count INT DEFAULT 3
)
RETURNS TABLE (
    id UUID,
    repository_id TEXT,
    text TEXT,
    chunk_index INTEGER,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        e.id,
        e.repository_id,
        e.text,
        e.chunk_index,
        1 - (e.embedding <=> query_embedding) AS similarity
    FROM embeddings e
    WHERE e.repository_id = match_repository_id
        AND 1 - (e.embedding <=> query_embedding) > match_threshold
    ORDER BY e.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION match_embeddings(vector(384), TEXT, FLOAT, INT) TO authenticated;

-- ============================================================================
-- TRIGGERS
-- ============================================================================
-- Auto-update updated_at timestamp for repositories
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_repositories_updated_at
    BEFORE UPDATE ON repositories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chats_updated_at
    BEFORE UPDATE ON chats
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- VALIDATION CHECKLIST
-- ============================================================================
-- ✓ Foreign keys with CASCADE delete rules:
--   - repositories.user_id -> auth.users(id) ON DELETE CASCADE
--   - embeddings.repository_id -> repositories(id) ON DELETE CASCADE
--   - chats.repository_id -> repositories(id) ON DELETE CASCADE
--   - chats.user_id -> auth.users(id) ON DELETE CASCADE
--   - messages.chat_id -> chats(id) ON DELETE CASCADE
--
-- ✓ pgvector dimensions: 384 (for all-MiniLM-L6-v2 model)
--
-- ✓ RLS policies enforce multi-tenant security:
--   - All tables have RLS enabled
--   - Users can only access their own data
--   - Policies use auth.uid() for user identification
--
-- ✓ Indexes for performance:
--   - HNSW index on embeddings.embedding for fast vector search
--   - Indexes on foreign keys for join performance
--   - Indexes on frequently queried columns (user_id, status, created_at, etc.)
--
-- ✓ Vector similarity function:
--   - match_embeddings() uses cosine distance (<=> operator)
--   - Returns similarity scores (1 - distance)
--   - Filtered by repository_id and threshold
--   - Limited to top N results

-- ============================================================================
-- PERFORMANCE NOTES
-- ============================================================================
-- 1. HNSW index parameters:
--    - m = 16: Balance between index size and search quality
--    - ef_construction = 64: Quality of index construction
--    - Consider tuning based on data size and query patterns
--
-- 2. Vector search optimization:
--    - The match_embeddings function uses cosine distance (<=>)
--    - HNSW index provides approximate nearest neighbor search
--    - For exact results, consider IVFFlat index instead
--
-- 3. Query patterns to optimize:
--    - Repository lookups by user_id (indexed)
--    - Chat lookups by repository_id (indexed)
--    - Message retrieval by chat_id (indexed)
--    - Vector similarity search (HNSW indexed)
--
-- 4. Future considerations:
--    - Partition embeddings table by repository_id for very large datasets
--    - Add materialized views for frequently accessed aggregations
--    - Consider connection pooling for high concurrency

