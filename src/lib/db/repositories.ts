/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * ENHANCED: Database operations for repositories with metadata support
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
  // ENHANCED: New metadata fields
  readme?: string;
  fileTree?: string;
  languages?: string[];
  framework?: string;
  createdAt: string;
  updatedAt: string;
}

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

  return transformRepository(data);
}

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

  return (data || []).map(transformRepository);
}

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
      readme: repo.readme || null,
      file_tree: repo.fileTree || null,
      languages: repo.languages || [],
      framework: repo.framework || null,
    } as any)
    .select()
    .single();

  if (error) {
    console.error(`[DB] Error creating repository:`, error);
    throw new Error(`Failed to create repository: ${error.message}`);
  }

  return transformRepository(data);
}

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
 * ENHANCED: Update repository metadata after embedding
 */
export async function updateRepositoryMetadata(
  repoId: string,
  metadata: {
    readme?: string;
    fileTree?: string;
    languages?: string[];
    framework?: string;
    chunkCount?: number;
  }
): Promise<void> {
  const supabase = createClient();
  
  const updateData: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (metadata.readme !== undefined) {
    updateData.readme = metadata.readme;
  }

  if (metadata.fileTree !== undefined) {
    updateData.file_tree = metadata.fileTree;
  }

  if (metadata.languages !== undefined) {
    updateData.languages = metadata.languages;
  }

  if (metadata.framework !== undefined) {
    updateData.framework = metadata.framework;
  }

  if (metadata.chunkCount !== undefined) {
    updateData.chunk_count = metadata.chunkCount;
  }

  const { error } = await (
    supabase.from("repositories").update(updateData as never) as any
  ).eq("id", repoId);

  if (error) {
    console.error(`[DB] Error updating repository metadata ${repoId}:`, error);
    throw new Error(`Failed to update repository metadata: ${error.message}`);
  }

  console.log(`[DB] Updated metadata for repository ${repoId}`);
}

/**
 * ENHANCED: Get repository with full metadata
 */
export async function getRepositoryWithMetadata(
  repoId: string
): Promise<Repository | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("repositories")
    .select("*")
    .eq("id", repoId)
    .maybeSingle();

  if (error) {
    console.error(`[DB] Error fetching repository with metadata ${repoId}:`, error);
    return null;
  }

  if (!data) {
    return null;
  }

  return transformRepository(data);
}

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

/**
 * Helper function to transform database record to Repository interface
 */
function transformRepository(data: any): Repository {
  return {
    id: data.id,
    userId: data.user_id,
    url: data.url,
    owner: data.owner,
    name: data.name,
    status: data.status,
    error: data.error || undefined,
    chunkCount: data.chunk_count || undefined,
    readme: data.readme || undefined,
    fileTree: data.file_tree || undefined,
    languages: data.languages || undefined,
    framework: data.framework || undefined,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}