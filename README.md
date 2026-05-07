# Noi (Nối)

A bilingual life administration assistant for Vietnamese-speaking elderly Australians and their family members. Parent speaks Vietnamese → AI answers in Vietnamese with step-by-step guidance. Child sees everything in English and can add context, reply, or delegate tasks.

Built with Next.js 14 (App Router), Supabase (Postgres + Auth + Realtime), Tailwind CSS, and the Anthropic API (Claude Sonnet 4).

> **Current status**: Phase 1 feature-complete. Parent vertical verified end-to-end. Child side built and typechecks but awaiting full end-to-end test. Credentials rotated. Ready for first deploy. See [STATUS.md](STATUS.md) for the detailed progress log, known gotchas, and what's left before production.

---

## First-time setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → **New project**.
2. Pick the region closest to your users (for Australia, Sydney).
3. Wait for the project to provision (~2 min).

### 3. Run the schema

Open **SQL Editor** in the Supabase dashboard, paste in the schema from `noi-claude-code-prompt.md` (the `-- Family spaces` section through the end of the RLS policies), and run it.

> **Important**: the RLS policies shipped in that schema are self-referential and break — users can't read their own `profiles` row, causing an infinite setup redirect loop. Replace them with the `SECURITY DEFINER` version documented under "Gotchas" in [STATUS.md](STATUS.md). (Already applied to this project's Supabase instance.)

### 4. Enable magic-link auth

In the Supabase dashboard:
- **Authentication → Providers → Email**: make sure **Enable Email provider** is on.
- **Authentication → URL Configuration**:
  - **Site URL**: `http://localhost:3000` for local dev.
  - **Redirect URLs**: add `http://localhost:3000/**` and your Vercel domain once deployed.

### 5. Environment variables

```bash
cp .env.local.example .env.local
```

Then fill in `.env.local`:

| Variable | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase dashboard → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase dashboard → Settings → API → `anon` `public` key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard → Settings → API → `service_role` key (secret) |
| `ANTHROPIC_API_KEY` | [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys) |

### 6. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

> The `dev` script is wrapped in `env -u ANTHROPIC_API_KEY` because Claude Desktop injects an empty `ANTHROPIC_API_KEY` into the shell, which would otherwise shadow the real one from `.env.local`. If you run `next dev` directly, prefix it the same way. Details in [STATUS.md](STATUS.md).

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start dev server on port 3000 |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | Type check without emitting |

---

## Project structure

```
app/
  (auth)/                        # login, verify, setup, setup/invite, join
  (app)/                         # auth-guarded routes
    layout.tsx                   # session + profile guard
    parent/                      # Vietnamese-first home
      page.tsx, ParentHome.tsx   # mic + text + threads
      thread/[id]/               # thread view + follow-up input
    child/                       # English-first dashboard
      page.tsx                   # realtime thread list
      thread/[id]/               # view + reply + add-context + category + resolve
      new-task/                  # compose → preview → submit
    settings/                    # name + language + invite code
  api/chat/route.ts              # streaming AI endpoint
  auth/callback/route.ts         # magic link code exchange

components/                      # VoiceInput, StreamingResponse, LoadingDots,
                                 # MessageBubble, ChecklistPanel, ThreadCard,
                                 # RealtimeBoundary

hooks/                           # useVoiceInput, useRealtimeRefresh

lib/
  supabase/{client,server,middleware}.ts   # SSR-aware clients
  anthropic.ts                              # SDK singleton + model constant
  system-prompt.ts                          # Noi system prompt
  translate.ts                              # vi ↔ en via Claude
  checklist-extract.ts                      # extract "- [ ]" items
  thread-title.ts                           # dual-language titles
  language-detect.ts                        # diacritic heuristic
  tts.ts                                    # Web Speech Synthesis wrapper

middleware.ts                    # Supabase session refresh on every request
```

See `noi-prd.md` for product requirements and `noi-claude-code-prompt.md` for the full build spec including the SQL schema.

---

## Deployment (Vercel)

Do NOT deploy until the credentials listed in [SECURITY-TODO.md](SECURITY-TODO.md) have been rotated.

1. Rotate the three leaked credentials in Supabase + Anthropic dashboards, update `.env.local`, and delete `SECURITY-TODO.md`.
2. In Supabase Auth → SMTP settings, configure a real provider (e.g. Resend). The default test SMTP is rate-limited to ~4 emails/hour per address and will frustrate real users.
3. Push to GitHub.
4. Import the repo on [vercel.com](https://vercel.com).
5. Add the four env vars from `.env.local` in **Project Settings → Environment Variables**. (No need to reproduce the `env -u` wrapper — Vercel's shell isn't polluted by Claude Desktop.)
6. Deploy.
7. Back in Supabase → Auth → URL Configuration, add your Vercel domain (both the wildcard preview `https://*.vercel.app/**` and your production domain) to **Redirect URLs**.
8. Set an Anthropic spending cap at console.anthropic.com/settings/limits.
