# RepoChat AI

> Chat with your GitHub repositories using AI-powered semantic search and analysis

RepoChat AI is a Next.js application that allows you to have intelligent conversations about any GitHub repository. It uses vector embeddings and retrieval-augmented generation (RAG) to provide accurate, context-aware answers about code structure, functionality, and implementation details.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Next.js](https://img.shields.io/badge/Next.js-15.0-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![Supabase](https://img.shields.io/badge/Supabase-Postgres-green)

## ✨ Features

- 🔍 **Semantic Code Search** - Ask questions in natural language and get relevant code snippets
- 📁 **Repository Analysis** - Automatic analysis of repository structure, file tree, and languages
- 💬 **Multi-Chat Support** - Create multiple conversations per repository
- 🎨 **Modern UI** - Clean, responsive interface with dark mode support
- 🔒 **Secure & Private** - Row-level security ensures users only access their own data
- ⚡ **Real-time Processing** - Live updates as repositories are analyzed
- 📝 **Markdown Formatting** - Rich formatting for code blocks, syntax highlighting, and more

## 🏗️ Architecture

### Tech Stack

- **Frontend**: Next.js 15, React, TypeScript, TailwindCSS
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL + pgvector)
- **AI Models**:
  - Google Gemini 2.5 Flash (text generation)
  - Hugging Face Sentence Transformers (embeddings)
- **Authentication**: Supabase Auth
- **Vector Search**: pgvector with HNSW indexing

### How It Works

1. **Repository Ingestion**: User adds a GitHub repository URL
2. **Content Fetching**: System fetches up to 50 relevant files from the repository
3. **Chunking**: Content is split into manageable chunks (2000 characters with 400 character overlap)
4. **Embedding**: Each chunk is converted to a 384-dimensional vector using `sentence-transformers/all-MiniLM-L6-v2`
5. **Storage**: Vectors are stored in Supabase with pgvector for efficient similarity search
6. **Query Processing**: User questions are embedded and matched against stored vectors
7. **Context Building**: Most relevant chunks are retrieved and formatted with repository metadata
8. **AI Response**: Gemini generates comprehensive answers using the retrieved context

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn/pnpm
- Supabase account
- Google AI API key (for Gemini)
- Hugging Face API token (optional, for embeddings)
- GitHub personal access token (optional, for higher rate limits)

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/yourusername/repochat-ai.git
   cd repochat-ai
   ```

2. **Install dependencies**

   ```bash
   npm install
   # or
   yarn install
   # or
   pnpm install
   ```

3. **Set up Supabase**

   Create a new Supabase project and run the migration:

   ```bash
   # In Supabase SQL Editor, run:
   src/supabase/migrations/001_create_tables.sql
   ```

4. **Configure environment variables**

   Create a `.env.local` file in the root directory:

   ```env
   # Supabase Configuration
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

   # AI API Keys
   GOOGLE_AI_API_KEY=your-gemini-api-key
   HF_TOKEN=your-huggingface-token

   # GitHub (Optional - for higher rate limits)
   GITHUB_TOKEN=your-github-personal-access-token
   ```

5. **Run the development server**

   ```bash
   npm run dev
   # or
   yarn dev
   # or
   pnpm dev
   ```

6. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 📖 Usage

### Adding a Repository

1. Sign up or sign in to your account
2. Click "Add Repository" on the dashboard
3. Enter a GitHub repository URL (e.g., `https://github.com/owner/repo`)
4. Wait for the analysis to complete (status will change from "Analyzing..." to "Available")

### Chatting with a Repository

1. Click on an available repository
2. Create a new chat or select an existing one
3. Ask questions about the codebase:
   - "How does authentication work?"
   - "Explain the database schema"
   - "Show me the API route structure"
   - "What libraries are used for styling?"

### Example Questions

- **Architecture**: "What's the overall structure of this application?"
- **File Navigation**: "Where is the user authentication logic?"
- **Code Explanation**: "How does the RAG pipeline work?"
- **Debugging**: "Are there any potential security issues?"
- **Learning**: "Explain the database migration strategy"

## 🗂️ Project Structure

```
src/
├── app/
│   ├── api/                 # Next.js API routes
│   │   ├── auth/           # Authentication endpoints
│   │   ├── repositories/   # Repository management
│   │   ├── chats/          # Chat management
│   │   ├── messages/       # Message handling
│   │   └── health/         # Health check
│   ├── auth/               # Auth pages (sign in/up)
│   ├── dashboard/          # Main dashboard
│   ├── repository/         # Repository chat interface
│   └── layout.tsx          # Root layout
├── components/
│   ├── ui/                 # Reusable UI components
│   ├── chat-input.tsx      # Message input component
│   ├── chat-message.tsx    # Message display component
│   ├── repository-card.tsx # Repository card component
│   └── sidebar.tsx         # Navigation sidebar
├── lib/
│   ├── ai/                 # AI client (Gemini)
│   ├── auth/               # Authentication utilities
│   ├── db/                 # Database operations
│   ├── rag/                # RAG pipeline modules
│   │   ├── embeddings.ts   # HuggingFace embeddings
│   │   ├── github.ts       # GitHub API integration
│   │   ├── vector-search.ts # pgvector search
│   │   └── query.ts        # RAG orchestration
│   ├── supabase/           # Supabase clients
│   └── utils/              # Utility functions
├── styles/
│   └── globals.css         # Global styles
├── supabase/
│   └── migrations/         # Database migrations
└── utils/
    ├── api.tsx             # API client functions
    ├── markdown.ts         # Markdown processing
    └── theme-provider.tsx  # Theme management
```

## 🔐 Security

### Authentication & Authorization

- **Supabase Auth** for secure user authentication
- **Row-Level Security (RLS)** policies enforce data isolation
- **JWT-based API authentication** for all protected routes
- **Service role key** used only in server-side operations

### Data Privacy

- Users can only access their own repositories, chats, and messages
- Repository data is deleted cascade-style when repositories are removed
- No third-party analytics or tracking

## 🎨 Customization

### Styling

The application uses TailwindCSS with a custom design system. Modify theme colors in:

- `src/app/globals.css` - CSS variables for light/dark mode
- `tailwind.config.ts` - Tailwind configuration

### Crow Integration

This project includes Crow widget integration and MCP (Model Context Protocol) access to Crow documentation. For details on using the Crow MCP server to search Crow documentation, see [`docs/CROW_MCP_USAGE.md`](docs/CROW_MCP_USAGE.md).

### AI Model Configuration

Adjust AI behavior in `src/lib/rag/query.ts`:

```typescript
const MAX_CONTEXT_TOKENS = 16000; // Maximum context size
const MAX_RESPONSE_TOKENS = 2048; // Maximum response length
const CHUNK_SIZE = 2000; // Text chunk size
const CHUNK_OVERLAP = 400; // Overlap between chunks
const TOP_K_CHUNKS = 10; // Number of chunks to retrieve
```

### Repository Limits

Modify file fetching limits in `src/lib/rag/github.ts`:

```typescript
const MAX_FILES = 50; // Maximum files to analyze per repository
```

## 📊 Database Schema

### Tables

- **repositories** - GitHub repository metadata and status
- **embeddings** - Vector embeddings with pgvector support
- **chats** - Chat sessions for repositories
- **messages** - Individual messages within chats

### Key Features

- **pgvector extension** for efficient similarity search
- **HNSW indexing** for fast approximate nearest neighbor search
- **Cascade deletion** for data consistency
- **Automatic timestamps** with triggers

## 🛠️ API Routes

| Endpoint                 | Method | Description                    |
| ------------------------ | ------ | ------------------------------ |
| `/api/auth/signup`       | POST   | Create new user account        |
| `/api/repositories`      | GET    | List user's repositories       |
| `/api/repositories`      | POST   | Add new repository             |
| `/api/repositories/[id]` | GET    | Get repository details         |
| `/api/repositories/[id]` | DELETE | Delete repository              |
| `/api/chats`             | POST   | Create new chat                |
| `/api/chats/[repoId]`    | GET    | List repository chats          |
| `/api/messages`          | POST   | Send message & get AI response |
| `/api/messages/[chatId]` | GET    | Get chat messages              |
| `/api/health`            | GET    | Health check                   |

## 🐛 Troubleshooting

### Common Issues

**Repository stuck in "Analyzing..." state**

- Check Supabase logs for embedding errors
- Verify GOOGLE_AI_API_KEY and HF_TOKEN are set correctly
- Ensure repository is public or GITHUB_TOKEN has access

**Vector search returns no results**

- Verify `match_embeddings` function exists in Supabase
- Check if embeddings were successfully stored
- Ensure embedding dimensions match (384)

**Authentication errors**

- Verify Supabase environment variables are correct
- Check if Supabase Auth is enabled in your project
- Ensure email confirmation is disabled or handled

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Supabase** for the excellent Postgres + Auth platform
- **Google Gemini** for powerful AI text generation
- **Hugging Face** for embedding models
- **Vercel** for Next.js and hosting
- **shadcn/ui** for beautiful UI components

---

Built with ❤️ using Next.js, Supabase, and AI
