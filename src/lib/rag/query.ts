/* eslint-disable @typescript-eslint/no-explicit-any */
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { SupabaseClient } from "@supabase/supabase-js";
import { GeminiClient } from "../ai/gemini-client";
import * as embeddingsModule from "./embeddings";
import * as githubModule from "./github";
import * as vectorSearchModule from "./vector-search";
import { processAssistantResponse } from "../../utils/markdown";

// ENHANCED: Increased token limits and chunk parameters
const MAX_CONTEXT_TOKENS = 16000; // Increased from 8000
const MAX_RESPONSE_TOKENS = 2048; // Increased from 1024
const CHUNK_SIZE = 2000; // Increased from 1000
const CHUNK_OVERLAP = 400; // Increased from 200
const TOP_K_CHUNKS = 10; // Increased from 3

export interface RAGConfig {
  supabaseUrl: string;
  supabaseKey: string;
  hfToken?: string;
  geminiApiKey?: string;
  githubToken?: string;
}

export interface EmbedRepositoryOptions {
  repoId: string;
  owner: string;
  repo: string;
  onProgress?: (message: string) => void;
}

export interface QueryRepositoryOptions {
  repoId: string;
  question: string;
  chatHistory?: Array<{ role: "user" | "assistant"; content: string }>;
  maxChunks?: number;
}

// ENHANCED: Repository metadata structure
interface RepositoryMetadata {
  readme?: string;
  fileTree: string;
  languages: string[];
  framework?: string;
  totalFiles: number;
}

export function createRAGClient(config: RAGConfig) {
  const supabaseClient = vectorSearchModule.createSupabaseVectorClient(
    config.supabaseUrl,
    config.supabaseKey
  );

  const geminiClient = config.geminiApiKey
    ? new GeminiClient({
        apiKey: config.geminiApiKey,
        model: "gemini-2.5-flash",
      })
    : null;

  return {
    supabaseClient,
    geminiClient,

    /**
     * ENHANCED: Embed repository with metadata extraction
     */
    async embedRepository(options: EmbedRepositoryOptions): Promise<void> {
      const { repoId, owner, repo, onProgress } = options;

      try {
        onProgress?.(`Starting analysis for ${owner}/${repo}`);

        // Fetch GitHub repository contents
        onProgress?.("Fetching repository contents from GitHub...");
        const repoContent = await githubModule.fetchGitHubRepo(
          owner,
          repo,
          config.githubToken
        );

        onProgress?.(
          `Fetched ${repoContent.files.length} files from repository`
        );

        // ENHANCED: Extract repository metadata
        const metadata: RepositoryMetadata = {
          readme: repoContent.readme || undefined,
          fileTree: buildFileTree(repoContent.files.map((f) => f.path)),
          languages: extractLanguages(repoContent.files),
          framework: detectFramework(repoContent.files),
          totalFiles: repoContent.files.length,
        };

        onProgress?.("Analyzing repository structure...");

        // ENHANCED: Chunk with file boundary preservation
        const chunks: Array<{
          text: string;
          filePath: string;
          fileType: string;
          importance: number;
        }> = [];

        // Process README first (high importance)
        if (repoContent.readme) {
          const readmeChunks = await chunkWithMetadata(
            repoContent.readme,
            "README.md",
            "documentation",
            10
          );
          chunks.push(...readmeChunks);
        }

        // Process other files
        for (const file of repoContent.files) {
          const importance = calculateImportance(file.path);
          const fileType = detectFileType(file.path);
          const fileChunks = await chunkWithMetadata(
            file.content,
            file.path,
            fileType,
            importance
          );
          chunks.push(...fileChunks);
        }

        onProgress?.(`Created ${chunks.length} sections with metadata`);

        // Generate embeddings
        onProgress?.("Analyzing repository...");
        const chunkTexts = chunks.map((chunk) => chunk.text);
        const vectors = await embeddingsModule.embedDocuments(
          chunkTexts,
          config.hfToken
        );

        // Store embeddings with metadata
        onProgress?.("Storing analysis in database...");
        await vectorSearchModule.deleteRepositoryEmbeddings(
          supabaseClient,
          repoId
        );

        // ENHANCED: Store with file metadata
        await vectorSearchModule.storeEmbeddingsWithMetadata(
          supabaseClient,
          repoId,
          chunks.map((chunk, i) => ({
            text: chunk.text,
            embedding: vectors[i],
            chunkIndex: i,
            filePath: chunk.filePath,
            metadata: {
              fileType: chunk.fileType,
              importance: chunk.importance,
            },
          }))
        );

        // ENHANCED: Store repository metadata
        await storeRepositoryMetadata(supabaseClient, repoId, metadata);

        onProgress?.(`Successfully analyzed repository ${repoId}`);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        onProgress?.(`Error analyzing repository: ${errorMessage}`);
        throw error;
      }
    },

    /**
     * ENHANCED: Query with rich context and better prompting
     */
    async queryRepository(options: QueryRepositoryOptions): Promise<string> {
      const {
        repoId,
        question,
        chatHistory = [],
        maxChunks = TOP_K_CHUNKS,
      } = options;

      try {
        // Generate query embedding
        const questionVector = await embeddingsModule.embedQuery(
          question,
          config.hfToken
        );

        // ENHANCED: Retrieve repository metadata
        const metadata = await getRepositoryMetadata(supabaseClient, repoId);

        // Search for similar chunks
        const similarChunks = await vectorSearchModule.searchSimilarChunks(
          supabaseClient,
          repoId,
          questionVector,
          maxChunks,
          0.0
        );

        if (similarChunks.length === 0) {
          throw new Error("No relevant sections found for the query");
        }

        // ENHANCED: Build rich context
        const context = buildRichContext(similarChunks, metadata);

        // ENHANCED: Build comprehensive system prompt
        const systemPrompt = buildEnhancedSystemPrompt(metadata, context);

        // Build conversation messages
        const messages: Array<{ role: "user" | "model"; content: string }> = [];

        for (const msg of chatHistory.slice(-10)) {
          messages.push({
            role: msg.role === "assistant" ? "model" : "user",
            content: msg.content,
          });
        }

        messages.push({
          role: "user",
          content: question,
        });

        // Query Gemini
        if (!geminiClient) {
          throw new Error(
            "Gemini API key not configured. Please set GOOGLE_AI_API_KEY environment variable."
          );
        }

        const response = await geminiClient.generateContent({
          system: systemPrompt,
          messages,
          maxTokens: MAX_RESPONSE_TOKENS,
          temperature: 0.7,
        });

        // Clean and process the markdown response
        return processAssistantResponse(response);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        console.error(`Error querying repository ${repoId}:`, error);
        throw new Error(`Failed to query repository: ${errorMessage}`);
      }
    },

    async getEmbeddingCount(repoId: string): Promise<number> {
      return await vectorSearchModule.getEmbeddingCount(supabaseClient, repoId);
    },

    async deleteRepositoryEmbeddings(repoId: string): Promise<void> {
      return await vectorSearchModule.deleteRepositoryEmbeddings(
        supabaseClient,
        repoId
      );
    },
  };
}

// ENHANCED: Helper functions

/**
 * Build file tree structure as string
 */
function buildFileTree(filePaths: string[]): string {
  const tree: any = {};

  filePaths.forEach((path) => {
    const parts = path.split("/");
    let current = tree;

    parts.forEach((part, i) => {
      if (i === parts.length - 1) {
        current[part] = null; // File
      } else {
        current[part] = current[part] || {};
        current = current[part];
      }
    });
  });

  return formatTree(tree, "");
}

function formatTree(node: any, prefix: string): string {
  let result = "";
  const entries = Object.entries(node);

  entries.forEach(([key, value], i) => {
    const isLast = i === entries.length - 1;
    const connector = isLast ? "└── " : "├── ";
    const extension = isLast ? "    " : "│   ";

    result += `${prefix}${connector}${key}\n`;

    if (value !== null) {
      result += formatTree(value, prefix + extension);
    }
  });

  return result;
}

/**
 * Extract languages from file extensions
 */
function extractLanguages(files: any[]): string[] {
  const extensions = new Set<string>();

  files.forEach((file) => {
    const ext = file.path.split(".").pop()?.toLowerCase();
    if (ext) extensions.add(ext);
  });

  const langMap: Record<string, string> = {
    ts: "TypeScript",
    tsx: "TypeScript",
    js: "JavaScript",
    jsx: "JavaScript",
    py: "Python",
    java: "Java",
    go: "Go",
    rs: "Rust",
    cpp: "C++",
    c: "C",
  };

  return Array.from(extensions)
    .map((ext) => langMap[ext])
    .filter(Boolean);
}

/**
 * Detect framework from files
 */
function detectFramework(files: any[]): string | undefined {
  const paths = files.map((f) => f.path);

  if (paths.some((p) => p.includes("package.json"))) {
    if (paths.some((p) => p.includes("next.config"))) return "Next.js";
    if (paths.some((p) => p.includes("vite.config"))) return "Vite";
    return "Node.js";
  }

  if (paths.some((p) => p.includes("requirements.txt"))) return "Python";
  if (paths.some((p) => p.includes("pom.xml"))) return "Maven/Java";
  if (paths.some((p) => p.includes("Cargo.toml"))) return "Rust";
  if (paths.some((p) => p.includes("go.mod"))) return "Go";

  return undefined;
}

/**
 * Calculate file importance score
 */
function calculateImportance(filePath: string): number {
  if (filePath.includes("README")) return 10;
  if (filePath.endsWith(".md")) return 8;
  if (filePath.includes("package.json")) return 9;
  if (filePath.includes("config")) return 7;
  if (filePath.includes("/api/")) return 8;
  if (filePath.includes("/src/")) return 6;
  if (filePath.includes("test")) return 3;
  return 5;
}

/**
 * Detect file type
 */
function detectFileType(filePath: string): string {
  if (filePath.endsWith(".md")) return "documentation";
  if (filePath.endsWith(".json") || filePath.endsWith(".yaml")) return "config";
  if (filePath.includes("/api/")) return "api";
  if (filePath.includes("/components/")) return "component";
  if (filePath.includes("/lib/")) return "library";
  return "code";
}

/**
 * Chunk text with metadata
 */
async function chunkWithMetadata(
  content: string,
  filePath: string,
  fileType: string,
  importance: number
): Promise<
  Array<{
    text: string;
    filePath: string;
    fileType: string;
    importance: number;
  }>
> {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: CHUNK_SIZE,
    chunkOverlap: CHUNK_OVERLAP,
  });

  const docs = await splitter.createDocuments([content]);

  return docs.map((doc) => ({
    text: `File: ${filePath}\n\n${doc.pageContent}`,
    filePath,
    fileType,
    importance,
  }));
}

/**
 * Build rich context from chunks
 */
function buildRichContext(chunks: any[], metadata: RepositoryMetadata): string {
  let context = "=== REPOSITORY CONTEXT ===\n\n";

  // Add file tree
  if (metadata.fileTree) {
    context += "## File Structure:\n```\n";
    context += metadata.fileTree;
    context += "```\n\n";
  }

  // Add languages and framework
  if (metadata.languages.length > 0) {
    context += `## Languages: ${metadata.languages.join(", ")}\n`;
  }
  if (metadata.framework) {
    context += `## Framework: ${metadata.framework}\n`;
  }
  context += `## Total Files: ${metadata.totalFiles}\n\n`;

  // Add README summary if available
  if (metadata.readme) {
    context += "## README Summary:\n";
    context += metadata.readme.substring(0, 500) + "...\n\n";
  }

  // Add relevant sections
  context += "## Relevant Code Sections:\n\n";
  chunks.forEach((chunk, i) => {
    context += `### [${i + 1}] ${chunk.file_path || "Unknown file"}\n`;
    context += `Similarity: ${(chunk.similarity * 100).toFixed(1)}%\n`;
    context += "```\n";
    context += chunk.chunk_text || chunk.text;
    context += "\n```\n\n";
  });

  return context;
}

/**
 * Build enhanced system prompt
 */
function buildEnhancedSystemPrompt(
  metadata: RepositoryMetadata,
  context: string
): string {
  return `You are an expert code analysis AI assistant specialized in understanding and explaining software repositories.

**Your Capabilities:**
- Analyze code architecture and design patterns
- Explain code functionality in detail
- Suggest improvements and best practices
- Generate project structure diagrams
- Provide language-specific insights
- Trace code flow and dependencies
- Identify potential issues or bugs

**Current Repository Context:**
${context}

**Instructions:**
1. **Be Detailed**: Provide comprehensive explanations with examples
2. **Use Code**: Include code snippets when relevant
3. **Visualize**: Use tree structures, diagrams, or ASCII art when helpful
4. **Reference Files**: Always mention specific files when discussing code
5. **Be Specific**: Give exact line numbers or function names when possible
6. **Explain Thoroughly**: Don't assume user knowledge - explain concepts
7. **Suggest Improvements**: Point out optimization opportunities
8. **Consider Context**: Use the full repository context to provide holistic answers
9. **User-Friendly Language**: Do not mention embeddings, chunks, vectors, or RAG. Explain everything in simple, user-friendly terms.

**Response Format Guidelines:**
- Format all responses in clean, readable Markdown
- Use headings (##, ###) to organize content
- Use bullet points (-) and numbered lists (1.) for structured information
- Use fenced code blocks (\`\`\`language) for code snippets with proper language tags
- Use inline code (\`code\`) for function names, variables, and short code references
- Use links ([text](url)) when referencing external resources
- Use tables for structured data comparisons
- For code explanations: Include file path, function names, and logic flow
- For architecture questions: Provide diagrams using text/ASCII
- For file structure: Use tree format with descriptions
- For code generation: Provide complete, working examples
- For debugging: Show exact locations and suggest fixes

**Markdown Formatting Rules:**
- Avoid excessive newlines (use single line breaks between paragraphs)
- Avoid excessive bolding (**word**) as emphasis artifacts
- Ensure all code blocks are properly closed with triple backticks
- Format JSON data in code blocks with \`\`\`json
- Use proper heading hierarchy (## for main sections, ### for subsections)
- Keep formatting clean and consistent

**Example Tree Format:**

src/
├── app/
│   ├── api/          # API routes
│   └── components/   # React components
├── lib/
│   └── utils/        # Utility functions
└── types/            # TypeScript types


Now, answer the user's question using all available context and following these guidelines. Format your response in clean, readable Markdown.`;
}

/**
 * Store repository metadata in database
 */
async function storeRepositoryMetadata(
  client: SupabaseClient,
  repoId: string,
  metadata: RepositoryMetadata
): Promise<void> {
  const { error } = await client
    .from("repositories")
    .update({
      readme: metadata.readme,
      file_tree: metadata.fileTree,
      languages: metadata.languages,
      framework: metadata.framework,
    } as any)
    .eq("id", repoId);

  if (error) {
    console.error("Error storing repository metadata:", error);
  }
}

/**
 * Get repository metadata from database
 */
async function getRepositoryMetadata(
  client: SupabaseClient,
  repoId: string
): Promise<RepositoryMetadata> {
  const { data, error } = await client
    .from("repositories")
    .select("readme, file_tree, languages, framework, chunk_count")
    .eq("id", repoId)
    .single();

  if (error || !data) {
    return {
      fileTree: "",
      languages: [],
      totalFiles: 0,
    };
  }

  return {
    readme: data.readme,
    fileTree: data.file_tree,
    languages: data.languages || [],
    framework: data.framework,
    totalFiles: data.chunk_count || 0,
  };
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function truncateContext(
  chunks: string[],
  maxTokens: number = MAX_CONTEXT_TOKENS
): string[] {
  const result: string[] = [];
  let totalTokens = 0;

  for (const chunk of chunks) {
    const chunkTokens = estimateTokens(chunk);

    if (totalTokens + chunkTokens > maxTokens) {
      break;
    }

    result.push(chunk);
    totalTokens += chunkTokens;
  }

  return result;
}
