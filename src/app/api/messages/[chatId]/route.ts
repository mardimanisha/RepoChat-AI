/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/lib/auth/verify";
import * as dbChats from "@/lib/db/chats";
import * as dbMessages from "@/lib/db/messages";

// GET /api/messages/[chatId] - Get all messages for a chat
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  try {
    const user = await verifyUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { chatId } = await params;
    const chat = await dbChats.getChat(chatId);

    if (!chat || chat.userId !== user.id) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    const messages = await dbMessages.getChatMessages(chatId);

    return NextResponse.json({
      messages,
    });
  } catch (error: any) {
    console.error(`[API] Server error fetching messages: ${error}`);
    return NextResponse.json(
      { error: "Internal server error while fetching messages" },
      { status: 500 }
    );
  }
}
