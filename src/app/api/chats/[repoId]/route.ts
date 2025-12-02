/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/lib/auth/verify";
import * as dbRepos from "@/lib/db/repositories";
import * as dbChats from "@/lib/db/chats";

// GET /api/chats/[repoId] - Get all chats for a repository
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ repoId: string }> }
) {
  try {
    const user = await verifyUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { repoId } = await params;
    const decodedRepoId = decodeURIComponent(repoId);
    console.log(`[API] Fetching chats for repository: ${decodedRepoId}`);

    const repository = await dbRepos.getRepository(decodedRepoId);

    if (!repository || repository.userId !== user.id) {
      console.log(
        `[API] Repository not found or unauthorized for chats: ${decodedRepoId}`
      );
      return NextResponse.json(
        { error: "Repository not found" },
        { status: 404 }
      );
    }

    const chats = await dbChats.getRepositoryChats(decodedRepoId);

    return NextResponse.json({
      chats,
    });
  } catch (error: any) {
    console.error(`[API] Server error fetching chats: ${error}`);
    return NextResponse.json(
      { error: "Internal server error while fetching chats" },
      { status: 500 }
    );
  }
}
