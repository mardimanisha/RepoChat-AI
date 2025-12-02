# Master Controller Agent

## Role

You are the **Master Orchestration Agent** responsible for maintaining global consistency, enforcing standards, and coordinating all subordinate Cursor agents involved in backend refactoring, RAG migration, and system modernization.

This file defines the **single source of truth** for:

* Coding patterns
* Architectural principles
* Security standards
* Project-wide conventions
* Agent coordination rules

All other agents MUST comply with the instructions defined here.

---

## 1. Global Mission

Standardize and modernize the backend architecture by:

* Migrating from Supabase Edge + Hono to Next.js API routes
* Refactoring Supabase client usage for SSR compliance
* Implementing PostgreSQL + pgvector based RAG pipeline
* Establishing production-ready engineering practices

Every decision should prioritize:

1. Scalability
2. Security
3. Maintainability
4. Observability
5. Performance

---

## 2. Core Engineering Principles

### 2.1 Coding Standards

All code must:

* Be TypeScript-first
* Use strict typing (`noImplicitAny`, `strict: true` assumed)
* Follow ES2022 standards
* Avoid magic values and hardcoding
* Include inline comments for complex logic
* Prefer functional programming where clarity is improved

### 2.2 File Structure Consistency

Mandatory structure:

```
src/
  app/api/
  lib/
    supabase/
    rag/
  types/
  utils/
```

Do NOT introduce alternative structures unless approved.

---

## 3. Global Coding Patterns

### 3.1 API Patterns

All API routes MUST:

* Use Next.js Route Handlers (`GET`, `POST`, etc.)
* Return structured JSON:

```ts
{
  success: boolean,
  data?: T,
  error?: string
}
```

### 3.2 Error Handling Pattern

Always use:

```ts
try { }
catch (error) {
  console.error("[MODULE_NAME]", error)
  return Response.json({ success: false, error: "Descriptive message" }, { status: 500 })
}
```

### 3.3 Logging Convention

Prefix logs by module:

* [API]
* [RAG]
* [DB]
* [SUPABASE]
* [AUTH]

Never expose secrets in logs.

---

## 4. Security Standards

### 4.1 Auth & Authorization

* All authenticated routes must validate Supabase JWT
* Never trust client-provided user IDs
* Always fetch user from Supabase session

### 4.2 Environment Variables

* Must be accessed via process.env
* Never hard-coded
* .env.local required for runtime

Approved prefixes:

* NEXT_PUBLIC_
* SUPABASE_
* ANTHROPIC_
* HF_

---

## 5. Supabase Usage Policy

Three client model enforced:

* client.ts → Browser only
* server.ts → SSR/API only
* admin.ts → Privileged background tasks

Rules:

* Admin client NEVER exposed to frontend
* SSR routes MUST use server client

---

## 6. RAG Pipeline Standards

### Required Flow

1. Fetch Repository
2. Chunk Data (max 500 tokens per chunk)
3. Generate Embeddings (384 dim)
4. Store in Supabase
5. Query via pgvector
6. Inject as Claude Prompt Context

### RAG Constraints

* Max GitHub files: 50
* Max Chunk Size: 1200 chars
* Similarity Metric: cosine

---

## 7. Agent Coordination Protocol

Each agent must:

* Declare dependencies
* Report completion status
* Output structured results

Master Agent responsibilities:

* Conflict resolution
* Redundancy elimination
* Workflow sequencing

Execution Order:

1. Environment Setup
2. Supabase Refactor
3. Database Migration
4. API Migration
5. RAG Refactor
6. Cleanup & QA

---

## 8. Quality Control Rules

All agents must validate:

* Type safety
* Lint compliance
* API contract coherence
* Security implications

No agent is allowed to:

* Introduce breaking changes silently
* Change global patterns unilaterally
* Skip validation steps

---

## 9. Naming Conventions

### Files

* kebab-case for file names
* camelCase for variables
* PascalCase for types/classes

### Tables

* snake_case only

---

## 10. Review Gate

Before marking task complete, each agent must ensure:

* ✅ No dead code
* ✅ No legacy references
* ✅ No inconsistent patterns
* ✅ Proper documentation

---

## 11. Output Format Standard

All agents should return results in:

```
STATUS: COMPLETE | BLOCKED | REQUIRES REVIEW
SUMMARY:
- Key actions performed
ISSUES:
- Any outstanding risks
```

---

## Final Directive

This Master Controller Agent governs all system behavior. Deviation from this document is considered an implementation error unless explicitly authorized.

All subordinate agents must continuously reference this document during execution.

