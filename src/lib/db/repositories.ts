/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Database operations for repositories
 * Replaces KV store operations with Supabase table operations
 */

import { createClient } from "@/lib/supabase/admin";

export interface Repository {
  id: string;
  userId: string;
  url: string;
  owner: string;
  name: string;
  status: "processing" | "ready" | "error";
  error?: string;
  chunkCount?: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Get a repository by ID
 */
export async function getRepository(
  repoId: string
): Promise<Repository | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("repositories")
    .select("*")
    .eq("id", repoId)
    .maybeSingle();

  if (error) {
    console.error(`[DB] Error fetching repository ${repoId}:`, error);
    return null;
  }

  if (!data) {
    return null;
  }

  const repo = data as any;
  return {
    id: repo.id,
    userId: repo.user_id,
    url: repo.url,
    owner: repo.owner,
    name: repo.name,
    status: repo.status,
    error: repo.error || undefined,
    chunkCount: repo.chunk_count || undefined,
    createdAt: repo.created_at,
    updatedAt: repo.updated_at,
  };
}

/**
 * Get all repositories for a user
 */
export async function getUserRepositories(
  userId: string
): Promise<Repository[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("repositories")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error(
      `[DB] Error fetching repositories for user ${userId}:`,
      error
    );
    return [];
  }

  return (data || []).map((repo: any) => ({
    id: repo.id,
    userId: repo.user_id,
    url: repo.url,
    owner: repo.owner,
    name: repo.name,
    status: repo.status,
    error: repo.error || undefined,
    chunkCount: repo.chunk_count || undefined,
    createdAt: repo.created_at,
    updatedAt: repo.updated_at,
  }));
}

/**
 * Create a new repository
 */
export async function createRepository(
  repo: Omit<Repository, "createdAt" | "updatedAt">
): Promise<Repository> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("repositories")
    .insert({
      id: repo.id,
      user_id: repo.userId,
      url: repo.url,
      owner: repo.owner,
      name: repo.name,
      status: repo.status,
      error: repo.error || null,
      chunk_count: repo.chunkCount || 0,
    } as any)
    .select()
    .single();

  if (error) {
    console.error(`[DB] Error creating repository:`, error);
    throw new Error(`Failed to create repository: ${error.message}`);
  }

  const result = data as any;
  return {
    id: result.id,
    userId: result.user_id,
    url: result.url,
    owner: result.owner,
    name: result.name,
    status: result.status,
    error: result.error || undefined,
    chunkCount: result.chunk_count || undefined,
    createdAt: result.created_at,
    updatedAt: result.updated_at,
  };
}

/**
 * Update repository status
 */
export async function updateRepositoryStatus(
  repoId: string,
  status: "processing" | "ready" | "error",
  error?: string,
  chunkCount?: number
): Promise<void> {
  const supabase = createClient();
  const updateData: Record<string, any> = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (error !== undefined) {
    updateData.error = error;
  }

  if (chunkCount !== undefined) {
    updateData.chunk_count = chunkCount;
  }

  const { error: updateError } = await (
    supabase.from("repositories").update(updateData as never) as any
  ).eq("id", repoId);

  if (updateError) {
    console.error(`[DB] Error updating repository ${repoId}:`, updateError);
    throw new Error(`Failed to update repository: ${updateError.message}`);
  }
}

/**
 * Delete a repository and all related data (cascades via foreign keys)
 */
export async function deleteRepository(repoId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("repositories")
    .delete()
    .eq("id", repoId);

  if (error) {
    console.error(`[DB] Error deleting repository ${repoId}:`, error);
    throw new Error(`Failed to delete repository: ${error.message}`);
  }
}

/**
 * Check if repository exists for user
 */
export async function repositoryExistsForUser(
  userId: string,
  owner: string,
  name: string
): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("repositories")
    .select("id")
    .eq("user_id", userId)
    .eq("owner", owner)
    .eq("name", name)
    .maybeSingle();

  if (error) {
    console.error(`[DB] Error checking repository existence:`, error);
    return false;
  }

  return data !== null;
}
