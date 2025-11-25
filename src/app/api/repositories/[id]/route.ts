/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/lib/auth/verify";
import * as dbRepos from "@/lib/db/repositories";
import { createRAGClient } from "@/lib/rag/query";

// GET /api/repositories/[id] - Get a specific repository
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: repoId } = await params;
    const decodedRepoId = decodeURIComponent(repoId);
    console.log(`[API] Fetching repository: ${decodedRepoId}`);

    const repository = await dbRepos.getRepository(decodedRepoId);

    if (!repository || repository.userId !== user.id) {
      console.log(
        `[API] Repository not found or unauthorized: ${decodedRepoId}`
      );
      return NextResponse.json(
        { error: "Repository not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ repository });
  } catch (error: any) {
    console.error(`[API] Server error fetching repository: ${error}`);
    return NextResponse.json(
      { error: "Internal server error while fetching repository" },
      { status: 500 }
    );
  }
}

// DELETE /api/repositories/[id] - Delete a repository
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: repoId } = await params;
    const repository = await dbRepos.getRepository(repoId);

    if (!repository || repository.userId !== user.id) {
      return NextResponse.json(
        { error: "Repository not found" },
        { status: 404 }
      );
    }

    // Delete repository (cascades to chats, messages, and embeddings via foreign keys)
    await dbRepos.deleteRepository(repoId);

    return NextResponse.json(
      { message: "Repository deleted successfully" },
      { status: 200 }
    );
  } catch (error: any) {
    console.error(`[API] Error deleting repository: ${error}`);
    return NextResponse.json(
      { error: "Internal server error while deleting repository" },
      { status: 500 }
    );
  }
}
