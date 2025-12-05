/* eslint-disable @typescript-eslint/no-explicit-any */
// API client for Next.js API routes
// All routes are now served from /api/* endpoints
const BASE_URL = '/api';

export interface Repository {
  id: string;
  userId: string;
  url: string;
  owner: string;
  name: string;
  status: 'processing' | 'ready' | 'error';
  error?: string;
  chunkCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Chat {
  id: string;
  repoId: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  chatId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

async function fetchApi(
  endpoint: string, 
  options: RequestInit = {},
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _token?: string // Token parameter kept for backward compatibility but not used (auth via cookies)
) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  
  // Do NOT send Authorization header to avoid 431 errors
  // Supabase SSR automatically sets cookies on authentication, and the server
  // (verifyUser function) reads from cookies first. This prevents header size issues.
  // Cookies are handled separately by the browser and don't contribute to header size limits.
  // The token parameter is kept for backward compatibility but is not used.
  
  console.log(`API Request: ${endpoint}`, { method: options.method || 'GET' });
  
  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers,
      // Ensure cookies are sent with the request (required for cookie-based auth)
      credentials: 'include',
    });
    
    // Handle 431 (Request Header Fields Too Large) before parsing
    if (response.status === 431) {
      console.error(`API Error 431: Request headers too large for ${endpoint}`);
      throw new Error('Request headers are too large. Please try clearing your browser cookies or signing out and signing back in.');
    }
    
    // Check if response is JSON before parsing
    const contentType = response.headers.get('content-type');
    const isJson = contentType?.includes('application/json');
    
    let data;
    if (!isJson) {
      // If not JSON, try to get text for better error message
      const text = await response.text();
      console.error(`API Error: Expected JSON but got ${contentType || 'unknown type'}`);
      console.error(`Response body: ${text.substring(0, 200)}`);
      throw new Error(`API endpoint returned non-JSON response. Status: ${response.status}. This usually means the endpoint doesn't exist or returned an error page.`);
    } else {
      data = await response.json();
    }
    
    if (!response.ok) {
      console.error(`API Error ${response.status}:`, data);
      throw new Error(data.error || `Request failed with status ${response.status}`);
    }
    
    console.log(`API Response: ${endpoint}`, data);
    return data;
  } catch (error: any) {
    console.error(`API Fetch Error for ${endpoint}:`, error);
    // Preserve the original error message if it's already user-friendly
    if (error.message && error.message.includes('Request headers are too large')) {
      throw error;
    }
    throw new Error(error.message || 'Network request failed');
  }
}

// Auth API
export async function signup(email: string, password: string, name: string) {
  return fetchApi('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password, name }),
  });
}

// Repository API
// Token parameter is optional - authentication is handled via cookies to avoid 431 errors
export async function createRepository(url: string, token?: string): Promise<{ repository: Repository }> {
  return fetchApi('/repositories', {
    method: 'POST',
    body: JSON.stringify({ url }),
  }, token);
}

export async function getRepositories(token?: string): Promise<{ repositories: Repository[] }> {
  return fetchApi('/repositories', {
    method: 'GET',
  }, token);
}

export async function getRepository(repoId: string, token?: string): Promise<{ repository: Repository }> {
  return fetchApi(`/repositories/${encodeURIComponent(repoId)}`, {
    method: 'GET',
  }, token);
}

export async function deleteRepository(repoId: string, token?: string): Promise<{ message: string }> {
  return fetchApi(`/repositories/${encodeURIComponent(repoId)}`, {
    method: 'DELETE',
  }, token);
}

// Chat API
export async function createChat(repoId: string, title: string, token?: string): Promise<{ chat: Chat }> {
  return fetchApi('/chats', {
    method: 'POST',
    body: JSON.stringify({ repoId, title }),
  }, token);
}

export async function getChats(repoId: string, token?: string): Promise<{ chats: Chat[] }> {
  return fetchApi(`/chats/${encodeURIComponent(repoId)}`, {
    method: 'GET',
  }, token);
}

// Message API
export async function sendMessage(
  chatId: string, 
  content: string, 
  token?: string
): Promise<{ userMessage: Message; assistantMessage: Message }> {
  return fetchApi('/messages', {
    method: 'POST',
    body: JSON.stringify({ chatId, content }),
  }, token);
}

export async function getMessages(chatId: string, token?: string): Promise<{ messages: Message[] }> {
  return fetchApi(`/messages/${chatId}`, {
    method: 'GET',
  }, token);
}