# GitHub Repository Chat Application

A full-stack RAG (Retrieval-Augmented Generation) application that allows users to chat with GitHub repositories using AI.

## Features

- **User Authentication**: Email/password and Google OAuth sign-in
- **Repository Management**: Add and manage GitHub repositories
- **RAG Pipeline**: Automatic embedding, chunking, and vector storage
- **AI-Powered Chat**: Chat with repositories using Anthropic's Claude
- **Multiple Chats**: Create multiple chat sessions per repository
- **Dark/Light Theme**: Toggle between themes
- **Responsive Design**: ChatGPT-like minimal UI with Montserrat font

## Tech Stack

- **Frontend**: React with React Router
- **Backend**: Next.js API Routes (Route Handlers)
- **Database**: Supabase (PostgreSQL + KV Store)
- **Vector Database**: Stored in KV Store with embeddings
- **AI Models**: 
  - Hugging Face (sentence-transformers/all-MiniLM-L6-v2) for embeddings
  - Anthropic Claude 3.5 Sonnet for chat responses
- **RAG Framework**: LangChain
- **Styling**: Tailwind CSS with custom color scheme
- **Animations**: Motion (Framer Motion)
- **Authentication**: Supabase Auth with SSR support

## Setup Instructions

### 1. Environment Variables

The application requires the following environment variables (some are already configured):

- `SUPABASE_URL` - Already configured
- `SUPABASE_ANON_KEY` - Already configured  
- `SUPABASE_SERVICE_ROLE_KEY` - Already configured
- `HF_TOKEN` - Hugging Face API token (already configured)
- `ANTHROPIC_API_KEY` - Anthropic API key (already configured)

### 2. Google OAuth Setup (Optional)

To enable Google OAuth sign-in, you must complete the setup at:
https://supabase.com/docs/guides/auth/social-login/auth-google

Without this setup, users will see a "provider is not enabled" error when trying to sign in with Google. Email/password authentication works without additional setup.

### 3. GitHub API Rate Limits

The application fetches repository contents from GitHub's public API. Be aware of rate limits:
- Unauthenticated requests: 60 per hour
- For higher limits, you can add a GitHub personal access token to the backend

## User Flow

1. **Homepage** - Landing page with sign-in/sign-up options
2. **Authentication** - Sign up or sign in with email or Google
3. **Dashboard** - View and manage repositories
4. **Repository Chat** - Chat with a specific repository using AI

## How It Works

### Repository Processing

1. User adds a GitHub repository URL
2. Backend validates the URL and creates a repository record
3. Background process fetches repository contents:
   - README file
   - File structure (up to 50 files)
   - Repository metadata
4. Content is split into chunks using RecursiveCharacterTextSplitter
5. Each chunk is embedded using Hugging Face embeddings
6. Embeddings are stored in the KV store
7. Repository status updates to "ready"

### Chat Flow

1. User creates a new chat session for a repository
2. User sends a message
3. Message is embedded using the same model
4. System finds top 3 most similar chunks using cosine similarity
5. Relevant chunks are sent to Claude along with the question
6. Claude generates a response based on the context
7. Response is displayed to the user

## Architecture

```
Frontend (React) 
    ↓
Next.js API Routes (/api/*)
    ↓
├─ Supabase Auth (User Management via SSR)
├─ KV Store (Data Persistence via PostgreSQL)
├─ Hugging Face (Embeddings)
└─ Anthropic (Chat Responses)
```

### API Routes

All backend functionality is handled by Next.js API Route Handlers:
- `/api/auth/signup` - User registration
- `/api/repositories` - Repository CRUD operations
- `/api/chats` - Chat management
- `/api/messages` - Message handling with RAG
- `/api/health` - Health check endpoint

See `src/app/api/ROUTE_MAP.md` for complete API documentation.

## Database Schema (KV Store)

The application uses Supabase's KV store with the following key patterns:

- `repo:{repoId}` - Repository metadata
- `user:{userId}:repos` - User's repository list
- `embeddings:{repoId}` - Repository embeddings
- `repo:{repoId}:chats` - Repository's chat list
- `chat:{chatId}` - Chat metadata
- `chat:{chatId}:messages` - Chat's message list
- `message:{messageId}` - Individual messages

## Limitations

- Demo/prototype environment - not for production use with sensitive data
- Repository processing limited to 50 files
- GitHub API rate limits apply
- Vector search is in-memory (not optimized for large datasets)

## Development Notes

- The application uses React Router's Data mode for routing
- All animations use Motion (Framer Motion)
- Theme is persisted in localStorage
- Sessions are managed by Supabase Auth
- Repository status updates are polled every 5 seconds

## Support

This is a prototype application built with Figma Make. For production use, consider:
- Adding proper error handling and logging
- Implementing rate limiting
- Using a dedicated vector database (e.g., Pinecone, Weaviate)
- Adding GitHub authentication for higher API limits
- Implementing proper user permissions
- Adding tests and monitoring
