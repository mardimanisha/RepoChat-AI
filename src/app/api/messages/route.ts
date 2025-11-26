/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/lib/auth/verify";
import * as dbChats from "@/lib/db/chats";
import * as dbMessages from "@/lib/db/messages";
import * as dbRepos from "@/lib/db/repositories";
import { createRAGClient } from "@/lib/rag/query";

// POST /api/messages - Send a message and get AI response
export async function POST(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { chatId, content } = await request.json();

    if (!content) {
      return NextResponse.json(
        { error: "Message content is required" },
        { status: 400 }
      );
    }

    const chat = await dbChats.getChat(chatId);
    if (!chat || chat.userId !== user.id) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    const repository = await dbRepos.getRepository(chat.repoId);
    if (!repository) {
      return NextResponse.json(
        { error: "Repository not found" },
        { status: 404 }
      );
    }

    if (repository.status !== "ready") {
      return NextResponse.json(
        { error: "Repository is still processing" },
        { status: 400 }
      );
    }

    // Create user message
    const userMessageId = `${chatId}:msg:${Date.now()}`;
    const userMessage = await dbMessages.createMessage({
      id: userMessageId,
      chatId,
      role: "user",
      content,
    });

    // Get chat history for RAG context
    const chatHistory = await dbMessages.getChatHistory(chatId, 10);

    // Generate AI response using RAG with Gemini
    let response: string;
    try {
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const hfToken = process.env.HF_TOKEN;
      const geminiApiKey = process.env.GOOGLE_AI_API_KEY?.trim(); // Changed from ANTHROPIC_API_KEY

      if (!supabaseUrl || !supabaseKey) {
        throw new Error("Missing Supabase configuration");
      }

      if (!geminiApiKey) {
        console.error("[API] GOOGLE_AI_API_KEY is missing or empty");
        throw new Error(
          "Gemini API key is not configured. Please set GOOGLE_AI_API_KEY environment variable."
        );
      }

      // Log key status for debugging (without exposing the actual key)
      if (geminiApiKey.length < 20) {
        console.warn(
          "[API] GOOGLE_AI_API_KEY appears to be too short. Valid keys are typically longer."
        );
      }

      const ragClient = createRAGClient({
        supabaseUrl,
        supabaseKey,
        hfToken,
        geminiApiKey, // Changed from anthropicApiKey
      });

      response = await ragClient.queryRepository({
        repoId: chat.repoId,
        question: content,
        chatHistory,
      });
    } catch (error: any) {
      console.error(`[RAG] Error generating RAG response: ${error}`);

      // Provide more helpful error messages
      let errorMessage = error.message || "Unknown error occurred";
      if (
        errorMessage.includes("API key") ||
        errorMessage.includes("authentication")
      ) {
        errorMessage =
          "Gemini API key is invalid or expired. Please check your GOOGLE_AI_API_KEY environment variable.";
      } else if (errorMessage.includes("not configured")) {
        errorMessage =
          "Gemini API key is not configured. Please set the GOOGLE_AI_API_KEY environment variable.";
      } else if (errorMessage.includes("quota")) {
        errorMessage =
          "Gemini API quota exceeded. Please check your usage limits or upgrade your plan.";
      }

      response = `I encountered an error while processing your question: ${errorMessage}. Please try again or contact support if the issue persists.`;
    }

    // Create assistant message
    const assistantMessageId = `${chatId}:msg:${Date.now() + 1}`;
    const assistantMessage = await dbMessages.createMessage({
      id: assistantMessageId,
      chatId,
      role: "assistant",
      content: response,
    });

    // Update chat's updatedAt timestamp
    await dbChats.updateChatTimestamp(chatId);

    return NextResponse.json(
      {
        userMessage,
        assistantMessage,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error(`[API] Server error sending message: ${error}`);
    return NextResponse.json(
      { error: "Internal server error while sending message" },
      { status: 500 }
    );
  }
}
