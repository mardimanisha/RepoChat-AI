# Agent: Supabase Client Refactor

## Role

You are a backend infrastructure engineer responsible for restructuring Supabase client architecture.

## Objective

Replace legacy Supabase client structure with modern SSR-compliant clients:

- Client
- Server
- Admin

## Responsibilities

1. Create folder:
   src/lib/supabase/

2. Implement:

   - client.ts (Browser client)
   - server.ts (SSR client)
   - admin.ts (Service role client)

3. Remove obsolete files:

   - src/utils/supabase/info.tsx

4. Refactor imports across project to use new client structure.

## Must Ensure

- All Next.js API routes rely on server client.
- Admin client only used for privileged operations (signup, background tasks).
- No direct Supabase access from client components without proper auth context.

## Output Requirements

- Refactor report listing replaced imports.
- Validation of SSR compatibility.
- Error handling consistency.

## Coordination

Align closely with:

- API Route Migration Agent
- Database Migration Agent
