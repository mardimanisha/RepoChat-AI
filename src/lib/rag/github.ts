/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * GitHub module for fetching repository contents
 * Limits to 50 files for performance and token management
 */

const MAX_FILES = 50;
const SUPPORTED_EXTENSIONS = [
  '.md', '.txt',
  '.js', '.ts', '.tsx', '.jsx',
  '.py', '.go', '.java',
  '.rs', '.cpp', '.c', '.h',
  '.json', '.yaml', '.yml',
  '.html', '.css', '.scss',
  '.sql', '.sh', '.bash'
];

export interface GitHubFile {
  path: string;
  content: string;
  size: number;
}

export interface RepositoryContent {
  owner: string;
  repo: string;
  description: string | null;
  language: string | null;
  defaultBranch: string;
  readme: string | null;
  files: GitHubFile[];
}

/**
 * Fetch README content from GitHub
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param branch - Branch name (default: 'main')
 * @returns Promise resolving to README content or null
 */
async function fetchReadme(
  owner: string,
  repo: string,
  branch: string = 'main'
): Promise<string | null> {
  const readmeVariants = ['README.md', 'readme.md', 'Readme.md', 'README.txt'];
  
  for (const readmePath of readmeVariants) {
    try {
      const readmeUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${readmePath}`;
      const response = await fetch(readmeUrl);
      
      if (response.ok) {
        return await response.text();
      }
    } catch (error) {
      console.log(`Could not fetch ${readmePath} for ${owner}/${repo}: ${error}`);
    }
  }
  
  return null;
}

/**
 * Fetch file content from GitHub
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param path - File path
 * @param branch - Branch name
 * @returns Promise resolving to file content or null
 */
async function fetchFileContent(
  owner: string,
  repo: string,
  path: string,
  branch: string
): Promise<string | null> {
  try {
    const fileUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
    const response = await fetch(fileUrl);
    
    if (!response.ok) {
      return null;
    }
    
    const content = await response.text();
    return content;
  } catch (error) {
    console.log(`Could not fetch file ${path} for ${owner}/${repo}: ${error}`);
    return null;
  }
}

/**
 * Check if file extension is supported
 * @param path - File path
 * @returns True if file extension is supported
 */
function isSupportedFile(path: string): boolean {
  return SUPPORTED_EXTENSIONS.some(ext => path.toLowerCase().endsWith(ext));
}

/**
 * Fetch repository contents from GitHub
 * Includes README, metadata, and up to 50 code files
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param githubToken - Optional GitHub personal access token for higher rate limits
 * @returns Promise resolving to RepositoryContent
 */
export async function fetchGitHubRepo(
  owner: string,
  repo: string,
  githubToken?: string
): Promise<RepositoryContent> {
  try {
    const headers: HeadersInit = {
      'Accept': 'application/vnd.github.v3+json',
    };
    
    if (githubToken) {
      headers['Authorization'] = `token ${githubToken}`;
    }
    
    // Fetch repository metadata
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}`;
    const repoResponse = await fetch(apiUrl, { headers });
    
    if (!repoResponse.ok) {
      if (repoResponse.status === 404) {
        throw new Error(`Repository ${owner}/${repo} not found`);
      }
      if (repoResponse.status === 403) {
        throw new Error('GitHub API rate limit exceeded. Consider providing a GitHub token.');
      }
      throw new Error(`Failed to fetch repository info: ${repoResponse.statusText}`);
    }
    
    const repoData: any = await repoResponse.json();
    const defaultBranch = repoData.default_branch || 'main';
    
    // Fetch README
    const readme = await fetchReadme(owner, repo, defaultBranch);
    
    // Fetch repository tree
    const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`;
    const treeResponse = await fetch(treeUrl, { headers });
    
    if (!treeResponse.ok) {
      throw new Error(`Failed to fetch repository tree: ${treeResponse.statusText}`);
    }
    
    const treeData: any = await treeResponse.json();
    
    // Filter and limit files
    const fileItems = treeData.tree
      .filter((item: any) => 
        item.type === 'blob' && isSupportedFile(item.path)
      )
      .slice(0, MAX_FILES);
    
    // Fetch file contents
    const files: GitHubFile[] = [];
    for (const item of fileItems) {
      const content = await fetchFileContent(owner, repo, item.path, defaultBranch);
      if (content !== null) {
        files.push({
          path: item.path,
          content,
          size: content.length,
        });
      }
      
      // Add small delay to respect rate limits
      if (files.length % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    return {
      owner,
      repo,
      description: repoData.description || null,
      language: repoData.language || null,
      defaultBranch,
      readme,
      files,
    };
  } catch (error) {
    console.error(`Error fetching GitHub repository ${owner}/${repo}:`, error);
    throw error;
  }
}

/**
 * Format repository content into a single text string
 * @param content - RepositoryContent object
 * @returns Formatted text string
 */
export function formatRepositoryContent(content: RepositoryContent): string {
  let text = `Repository: ${content.owner}/${content.repo}\n`;
  text += `Description: ${content.description || 'No description'}\n`;
  text += `Language: ${content.language || 'Unknown'}\n`;
  text += `Default Branch: ${content.defaultBranch}\n\n`;
  
  if (content.readme) {
    text += `README:\n${content.readme}\n\n`;
  }
  
  text += `Files (${content.files.length}):\n`;
  for (const file of content.files) {
    text += `\n--- File: ${file.path} ---\n`;
    text += `${file.content}\n`;
  }
  
  return text;
}

