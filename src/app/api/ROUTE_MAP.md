# Next.js API Routes - Route Map

This document outlines all the migrated API routes from Supabase Edge Functions (Hono) to Next.js API routes.

## Base URL

All routes are accessible at: `/api/*`

## Routes

### Authentication

#### POST `/api/auth/signup`
- **Description**: Create a new user account
- **Authentication**: None (public endpoint)
- **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "securepassword",
    "name": "User Name"
  }
  ```
- **Response** (201):
  ```json
  {
    "user": {
      "id": "user-uuid",
      "email": "user@example.com",
      "user_metadata": { "name": "User Name" }
    }
  }
  ```
- **Error Responses**:
  - `400`: Missing required fields or invalid input
  - `500`: Internal server error

### Repositories

#### POST `/api/repositories`
- **Description**: Create a new repository
- **Authentication**: Required (JWT Bearer token)
- **Request Body**:
  ```json
  {
    "url": "https://github.com/owner/repo"
  }
  ```
- **Response** (201):
  ```json
  {
    "repository": {
      "id": "repo_1234567890_abc123",
      "userId": "user-uuid",
      "url": "https://github.com/owner/repo",
      "owner": "owner",
      "name": "repo",
      "status": "processing",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  }
  ```
- **Error Responses**:
  - `401`: Unauthorized (missing or invalid token)
  - `400`: Invalid GitHub URL or repository already exists
  - `500`: Internal server error
- **Background Processing**: Repository embedding is triggered asynchronously after creation

#### GET `/api/repositories`
- **Description**: Get all repositories for the authenticated user
- **Authentication**: Required (JWT Bearer token)
- **Response** (200):
  ```json
  {
    "repositories": [
      {
        "id": "repo_1234567890_abc123",
        "userId": "user-uuid",
        "url": "https://github.com/owner/repo",
        "owner": "owner",
        "name": "repo",
        "status": "ready",
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z"
      }
    ]
  }
  ```
- **Error Responses**:
  - `401`: Unauthorized
  - `500`: Internal server error

#### GET `/api/repositories/[id]`
- **Description**: Get a specific repository by ID
- **Authentication**: Required (JWT Bearer token)
- **Response** (200):
  ```json
  {
    "repository": {
      "id": "repo_1234567890_abc123",
      "userId": "user-uuid",
      "url": "https://github.com/owner/repo",
      "owner": "owner",
      "name": "repo",
      "status": "ready",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  }
  ```
- **Error Responses**:
  - `401`: Unauthorized
  - `404`: Repository not found or not owned by user
  - `500`: Internal server error

#### DELETE `/api/repositories/[id]`
- **Description**: Delete a repository and all associated data
- **Authentication**: Required (JWT Bearer token)
- **Response** (200):
  ```json
  {
    "message": "Repository deleted successfully"
  }
  ```
- **Error Responses**:
  - `401`: Unauthorized
  - `404`: Repository not found or not owned by user
  - `500`: Internal server error
- **Note**: Also deletes all chats, messages, and embeddings for the repository

### Chats

#### POST `/api/chats`
- **Description**: Create a new chat for a repository
- **Authentication**: Required (JWT Bearer token)
- **Request Body**:
  ```json
  {
    "repoId": "repo_1234567890_abc123",
    "title": "My Chat" // Optional, defaults to "New Chat"
  }
  ```
- **Response** (201):
  ```json
  {
    "chat": {
      "id": "repo_1234567890_abc123:1234567890",
      "repoId": "repo_1234567890_abc123",
      "userId": "user-uuid",
      "title": "My Chat",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  }
  ```
- **Error Responses**:
  - `401`: Unauthorized
  - `404`: Repository not found or not owned by user
  - `500`: Internal server error

#### GET `/api/chats/[repoId]`
- **Description**: Get all chats for a repository
- **Authentication**: Required (JWT Bearer token)
- **Response** (200):
  ```json
  {
    "chats": [
      {
        "id": "repo_1234567890_abc123:1234567890",
        "repoId": "repo_1234567890_abc123",
        "userId": "user-uuid",
        "title": "My Chat",
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z"
      }
    ]
  }
  ```
- **Error Responses**:
  - `401`: Unauthorized
  - `404`: Repository not found or not owned by user
  - `500`: Internal server error

### Messages

#### POST `/api/messages`
- **Description**: Send a message and get AI response using RAG
- **Authentication**: Required (JWT Bearer token)
- **Request Body**:
  ```json
  {
    "chatId": "repo_1234567890_abc123:1234567890",
    "content": "What is this repository about?"
  }
  ```
- **Response** (201):
  ```json
  {
    "userMessage": {
      "id": "repo_1234567890_abc123:1234567890:msg:1234567890",
      "chatId": "repo_1234567890_abc123:1234567890",
      "role": "user",
      "content": "What is this repository about?",
      "createdAt": "2024-01-01T00:00:00.000Z"
    },
    "assistantMessage": {
      "id": "repo_1234567890_abc123:1234567890:msg:1234567891",
      "chatId": "repo_1234567890_abc123:1234567890",
      "role": "assistant",
      "content": "This repository is about...",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  }
  ```
- **Error Responses**:
  - `401`: Unauthorized
  - `400`: Missing content or repository still processing
  - `404`: Chat not found or not owned by user
  - `500`: Internal server error
- **Note**: Uses RAG (Retrieval-Augmented Generation) to generate context-aware responses

#### GET `/api/messages/[chatId]`
- **Description**: Get all messages for a chat
- **Authentication**: Required (JWT Bearer token)
- **Response** (200):
  ```json
  {
    "messages": [
      {
        "id": "repo_1234567890_abc123:1234567890:msg:1234567890",
        "chatId": "repo_1234567890_abc123:1234567890",
        "role": "user",
        "content": "What is this repository about?",
        "createdAt": "2024-01-01T00:00:00.000Z"
      },
      {
        "id": "repo_1234567890_abc123:1234567890:msg:1234567891",
        "chatId": "repo_1234567890_abc123:1234567890",
        "role": "assistant",
        "content": "This repository is about...",
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    ]
  }
  ```
- **Error Responses**:
  - `401`: Unauthorized
  - `404`: Chat not found or not owned by user
  - `500`: Internal server error

### Health

#### GET `/api/health`
- **Description**: Health check endpoint
- **Authentication**: None (public endpoint)
- **Response** (200):
  ```json
  {
    "status": "healthy"
  }
  ```

## Security Validation Notes

### JWT-Based Authentication
- All protected routes require a valid JWT token in the `Authorization` header
- Format: `Authorization: Bearer <token>`
- Token verification is performed using Supabase's `getUser()` method
- Invalid or missing tokens result in `401 Unauthorized` responses

### RLS-Safe User Checks
- All data access operations verify that the authenticated user owns the resource
- Repository access: Checks `repository.userId === user.id`
- Chat access: Checks `chat.userId === user.id`
- Message access: Checks `chat.userId === user.id` (via chat ownership)
- Users can only access their own data, enforcing Row-Level Security (RLS) principles

### Background Processing
- Repository embedding is triggered asynchronously after repository creation
- The embedding process runs in the background and does not block the API response
- Repository status is updated from `processing` to `ready` or `error` upon completion
- Errors in background processing are logged but do not affect the initial API response

### Input Validation
- GitHub URLs are validated using regex pattern matching
- Required fields are checked before processing
- Invalid inputs return `400 Bad Request` with descriptive error messages

### Error Handling
- All routes include comprehensive error handling
- Errors are logged for debugging purposes
- User-facing error messages do not expose sensitive information
- Standard HTTP status codes are used consistently

## Migration Notes

- All routes have been migrated from Hono-based Supabase Edge Functions to Next.js Route Handlers
- The KV store operations remain the same, using the `kv_store_7700f9fa` table
- RAG functionality has been preserved and adapted for Node.js environment
- Background embedding processing is now handled asynchronously using Promise-based execution



