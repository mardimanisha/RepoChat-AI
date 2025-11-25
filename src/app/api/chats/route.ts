/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/lib/auth/verify";
import * as dbRepos from "@/lib/db/repositories";
import * as dbChats from "@/lib/db/chats";

// POST /api/chats - Create a new chat
export async function POST(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { repoId, title } = await request.json();

    const repository = await dbRepos.getRepository(repoId);
    if (!repository || repository.userId !== user.id) {
      return NextResponse.json(
        { error: "Repository not found" },
        { status: 404 }
      );
    }

    const chatId = `${repoId}:${Date.now()}`;
    const chat = await dbChats.createChat({
      id: chatId,
      repoId,
      userId: user.id,
      title: title || "New Chat",
    });

    return NextResponse.json({ chat }, { status: 201 });
  } catch (error: any) {
    console.error(`[API] Server error creating chat: ${error}`);
    return NextResponse.json(
      { error: "Internal server error while creating chat" },
      { status: 500 }
    );
  }
}
