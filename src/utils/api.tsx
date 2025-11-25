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
  token?: string
) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  
  // Add Authorization header if token is provided
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  console.log(`API Request: ${endpoint}`, { method: options.method || 'GET' });
  
  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });
    
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
export async function createRepository(url: string, token: string): Promise<{ repository: Repository }> {
  return fetchApi('/repositories', {
    method: 'POST',
    body: JSON.stringify({ url }),
  }, token);
}

export async function getRepositories(token: string): Promise<{ repositories: Repository[] }> {
  return fetchApi('/repositories', {
    method: 'GET',
  }, token);
}

export async function getRepository(repoId: string, token: string): Promise<{ repository: Repository }> {
  return fetchApi(`/repositories/${encodeURIComponent(repoId)}`, {
    method: 'GET',
  }, token);
}

// Chat API
export async function createChat(repoId: string, title: string, token: string): Promise<{ chat: Chat }> {
  return fetchApi('/chats', {
    method: 'POST',
    body: JSON.stringify({ repoId, title }),
  }, token);
}

export async function getChats(repoId: string, token: string): Promise<{ chats: Chat[] }> {
  return fetchApi(`/chats/${encodeURIComponent(repoId)}`, {
    method: 'GET',
  }, token);
}

// Message API
export async function sendMessage(
  chatId: string, 
  content: string, 
  token: string
): Promise<{ userMessage: Message; assistantMessage: Message }> {
  return fetchApi('/messages', {
    method: 'POST',
    body: JSON.stringify({ chatId, content }),
  }, token);
}

export async function getMessages(chatId: string, token: string): Promise<{ messages: Message[] }> {
  return fetchApi(`/messages/${chatId}`, {
    method: 'GET',
  }, token);
}