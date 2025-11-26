/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/lib/auth/verify";
import * as dbRepos from "@/lib/db/repositories";
import { createRAGClient } from "@/lib/rag/query";

// POST /api/repositories - Create a new repository
export async function POST(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { url } = await request.json();

    if (!url) {
      return NextResponse.json(
        { error: "Repository URL is required" },
        { status: 400 }
      );
    }

    // Validate GitHub URL
    const githubUrlPattern =
      /^https?:\/\/(www\.)?github\.com\/[\w-]+\/[\w.-]+\/?$/;
    if (!githubUrlPattern.test(url)) {
      return NextResponse.json(
        { error: "Invalid GitHub repository URL" },
        { status: 400 }
      );
    }

    // Extract owner and repo name
    const urlParts = url.replace(/\/$/, "").split("/");
    const owner = urlParts[urlParts.length - 2];
    const repo = urlParts[urlParts.length - 1];

    // Check if repository already exists for this user
    const exists = await dbRepos.repositoryExistsForUser(user.id, owner, repo);
    if (exists) {
      return NextResponse.json(
        { error: "Repository already added" },
        { status: 400 }
      );
    }

    // Generate a clean repository ID using timestamp and random string
    const repoId = `repo_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    // Create repository record
    const repository = await dbRepos.createRepository({
      id: repoId,
      userId: user.id,
      url,
      owner,
      name: repo,
      status: "processing",
    });

    // Start embedding process in background (non-blocking)
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const hfToken = process.env.HF_TOKEN;
    const geminiApiKey = process.env.GOOGLE_AI_API_KEY;
    const githubToken = process.env.GITHUB_TOKEN;

    if (!supabaseUrl || !supabaseKey) {
      console.error("[API] Missing Supabase environment variables");
      await dbRepos.updateRepositoryStatus(
        repoId,
        "error",
        "Missing Supabase configuration"
      );
    } else {
      const ragClient = createRAGClient({
        supabaseUrl,
        supabaseKey,
        hfToken,
        geminiApiKey,
        githubToken,
      });

      ragClient
        .embedRepository({
          repoId,
          owner,
          repo,
          onProgress: (message) => {
            console.log(`[RAG] ${repoId}: ${message}`);
          },
        })
        .then(async () => {
          // Update repository status to ready
          await dbRepos.updateRepositoryStatus(repoId, "ready");
        })
        .catch(async (error) => {
          console.error(`[RAG] Error embedding repository ${repoId}:`, error);
          // Update repository status to error
          await dbRepos.updateRepositoryStatus(
            repoId,
            "error",
            error instanceof Error ? error.message : "Unknown error"
          );
        });
    }

    return NextResponse.json({ repository }, { status: 201 });
  } catch (error: any) {
    console.error(`[API] Server error creating repository: ${error}`);
    return NextResponse.json(
      { error: "Internal server error while creating repository" },
      { status: 500 }
    );
  }
}

// GET /api/repositories - Get all repositories for the authenticated user
export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const repositories = await dbRepos.getUserRepositories(user.id);

    return NextResponse.json({
      repositories,
    });
  } catch (error: any) {
    console.error(`[API] Server error fetching repositories: ${error}`);
    return NextResponse.json(
      { error: "Internal server error while fetching repositories" },
      { status: 500 }
    );
  }
}
