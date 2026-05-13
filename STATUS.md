# Noi — project status

Last updated: 2026-05-14

## Where we are

Phase 1 complete and **shipped to production** at `https://noi-app.com`. Custom domain configured with Resend SMTP (verified domain — magic links can go to any recipient). Both parent and child accounts tested end-to-end on real devices with real emails. Several post-launch UX improvements landed: tappable phone numbers, TTS on every message with slower Vietnamese rate, broader TTS coverage, tightened translation prompts, parent language preference toggle, child unified composer (Parent/Noi destination toggle), voice input for child, and image attachments with Claude vision integration.

### What's verified working

- ✅ Magic link auth (send → email → click → callback → setup)
- ✅ Family space creation + invite code join
- ✅ Parent home (mic + text input + recent threads list)
- ✅ Streaming AI responses (`/api/chat` route with dual-language save + checklist extraction + title generation)
- ✅ Vietnamese TTS speaker button on assistant messages
- ✅ Checklist extraction and tap-to-complete
- ✅ RLS policies (using `SECURITY DEFINER` helper function — see "Gotchas" below)

### Built but awaiting end-to-end test

- ⬜ Child dashboard with realtime thread list
- ⬜ Child thread view (message bubbles, language toggle, category selector, mark-resolved)
- ⬜ Child adds context → AI re-streams response
- ⬜ Child reply → translated to Vietnamese → appears in parent's thread
- ⬜ Child new-task flow (compose → preview → submit → parent sees highlighted thread)
- ⬜ Settings page (display name, language toggle, family code)
- ⬜ Realtime updates (parent home, parent thread, child home, child thread)

### Phase 1 ship checklist

1. ~~Rotate the three leaked credentials~~ — ✅ done.
2. ~~Set an Anthropic spending cap~~ — ✅ done.
3. ~~Configure custom SMTP (Resend)~~ — ✅ done.
4. ~~Initialise git + push to GitHub~~ — ✅ at https://github.com/ttluu2-1807/Noi.
5. ~~Deploy to Vercel~~ — ✅ live at https://noi-app.com.
6. ~~Custom domain + verified Resend sender~~ — ✅ `noi@noi-app.com`.
7. ~~Run a two-account walkthrough~~ — ✅ both parent + child verified on real devices.

### Backlog — current sprint (Phase 2)

Three waves of ~2-3 hours each. Tackled in order. Each wave is independently shippable.

**Wave 1 — Responsiveness + polish**

| Item | Detail | Status |
|---|---|---|
| A | Optimistic UI + tap feedback on every button/form action | ⬜ |
| F | Replace header pill row with avatar/menu sheet (mobile-friendly) | ⬜ |
| B.1 | Restyle thread cards: message preview snippet, image thumb, better time format, hover lift | ⬜ |

**Wave 2 — Organization at scale**

| Item | Detail | Status |
|---|---|---|
| C | Multi-tag system (drop single category_tag, allow custom tags from both roles) | ⬜ |
| D | Open / Done tabs on dashboard with counts | ⬜ |
| E | Mark-resolved affordance on parent thread view (currently child-only) | ⬜ |
| G | Inside-thread tabs: Conversation vs Action items | ⬜ |

**Wave 3 — Trust + warmth for elderly users**

| Item | Detail | Status |
|---|---|---|
| H | First-run 3-screen onboarding tour for parent | ⬜ |
| I | In-app unread indicator on threads with new content from other role | ⬜ |
| J | Suggested-question prompts in empty states | ⬜ |
| K | Warm localised error states (no raw errors to parent) | ⬜ |
| M | Auto-TTS toggle on assistant responses (settings opt-in) | ⬜ |

### Killer features — Phase 2 strategic bets

Heavier (week-plus each) but the biggest retention drivers.

| Item | Detail | Status |
|---|---|---|
| KILLER-1 | Reminders / nudges — parent commits to "call Centrelink Friday", app reminds them Friday morning. Needs scheduled jobs, push or email, calendar export. | ⬜ |
| KILLER-2 | Family member presence — "Mai is viewing this thread", "Mai is typing". Realtime broadcast over Supabase Presence channels. Strong family-warmth signal. | ⬜ |
| KILLER-3 | Voice mode end-to-end for parent — instead of read-typed-text, AI speaks the response, parent can voice-reply. Needs server-side STT (Whisper) for reliable Vietnamese on iPhone, plus optional ElevenLabs TTS. | ⬜ |

### Smaller backlog (revisit when relevant)

| Item | Detail | Status |
|---|---|---|
| 1 | Iterative AI refinement on new-task (back-and-forth before submit) | ⬜ |
| 2 | Delete past tasks (soft delete) | ⬜ |
| 4 | AI presents visuals to user (design still unclear — revisit with concrete use case) | ⬜ |
| L | Search across threads | ⬜ |
| O | A−/A+ font size escalation for accessibility | ⬜ |
| — | Onboarding for child role (currently parent-only planned) | ⬜ |

### Already-shipped post-launch work (for reference)

- ✅ Tappable phone numbers + URL auto-detection in messages
- ✅ TTS on every message with slower Vietnamese rate
- ✅ Tightened translation prompts (elder-friendly Vietnamese register)
- ✅ Parent English/Vietnamese language toggle
- ✅ Child voice-to-text composer
- ✅ Child unified Parent/Noi destination toggle
- ✅ Image attachments with Claude vision
- ✅ Custom domain `noi-app.com` with verified Resend SMTP

---

## Gotchas learned during this build

### 1. Claude Desktop injects `ANTHROPIC_API_KEY=""` into spawned shells

Claude Desktop exports an empty `ANTHROPIC_API_KEY` into the environment of any terminal it spawns (presumably so its own Claude Code process can own the binding). Next.js's env loader does not override already-set shell vars, so the empty string wins over the real key in `.env.local`, and every call to the Anthropic SDK fails with:

> Could not resolve authentication method. Expected either apiKey or authToken to be set.

**Mitigation in place**: the `dev` script in `package.json` is wrapped in `env -u ANTHROPIC_API_KEY` so the phantom var is stripped before `next dev` runs. This is Unix-only — if you port to Windows, swap in `cross-env` or an equivalent.

### 2. Self-referential RLS policies on `profiles` don't work

The original schema in the spec had `profiles` RLS policies that selected from `profiles` inside the `using` clause. Postgres breaks the recursion by returning an empty set, which means the user can't even read their own row — causing an infinite `/setup` redirect loop. We replaced all policies with ones that call a `SECURITY DEFINER` function (`public.current_user_family_space_id()`) that resolves the user's family without triggering RLS.

The fixed SQL is in [SECURITY-TODO.md](SECURITY-TODO.md) and has already been applied to your Supabase project.

### 3. Supabase PKCE flow needs the modern cookie API

`@supabase/ssr` v0.5+ exposes both a `get/set/remove` cookie contract (deprecated) and a `getAll/setAll` contract (current). The deprecated API can drop the PKCE verifier cookie between "send magic link" and the callback, producing:

> PKCE code verifier not found in storage…

Both `lib/supabase/server.ts` and `lib/supabase/middleware.ts` use the modern contract.

### 4. React 18 StrictMode + "run-once" effects

Dev-mode StrictMode invokes every effect twice. If an effect with a network call uses a `startedRef.current` guard, the first invocation is aborted by cleanup and the second is blocked by the guard — net result: zero requests. The correct pattern is to let both invocations fire and rely on `AbortController` in cleanup. `components/StreamingResponse.tsx` follows this pattern.

### 5. Next.js 14 `<form action={fn}>` requires `Promise<void>`

Server actions bound directly to a form element can't return a result object — the type is strictly `Promise<void>`. Actions used via `startTransition` can return whatever they like. Mixed needs are handled by having two exports, or by making the action `Promise<void>` and managing error state on the client.

### 6. Next.js 14 vs Next.js 16 false positives from hooks

The hook system that validates files as you write them is tuned for Next 16 defaults (`await cookies()`, `await headers()`, `await searchParams`, `middleware.ts → proxy.ts`). Everything in this codebase is Next 14, where those primitives are still synchronous and the middleware filename is still `middleware.ts`. Ignore those specific suggestions unless you upgrade.

---

## Architecture snapshot

```
app/
  (auth)/
    login, verify, setup, setup/invite, join   — magic link flow
  (app)/                                        — auth-guarded routes
    layout.tsx                                  — session + profile guard
    parent/                                     — Vietnamese-first home
      page.tsx, ParentHome.tsx                  — mic + text + threads
      thread/[id]/                              — thread view + follow-up
    child/                                      — English-first dashboard
      page.tsx                                  — realtime thread list
      thread/[id]/                              — view + reply + context + category
      new-task/                                 — compose → preview → submit
    settings/                                   — name + language + invite code
  api/chat/route.ts                             — streaming AI endpoint
  auth/callback/route.ts                        — magic link exchange

components/
  VoiceInput, StreamingResponse, LoadingDots,
  MessageBubble, ChecklistPanel, ThreadCard,
  RealtimeBoundary

hooks/
  useVoiceInput                                 — Web Speech API (vi-VN)
  useRealtimeRefresh                            — Supabase Realtime → router.refresh()

lib/
  supabase/{client,server,middleware}.ts        — SSR-aware clients
  anthropic.ts                                  — SDK singleton (Claude Sonnet 4)
  system-prompt.ts                              — Noi system prompt
  translate.ts                                  — vi ↔ en via Claude
  checklist-extract.ts                          — extract "- [ ]" items
  thread-title.ts                               — 5-8 word dual-language titles
  language-detect.ts                            — diacritic-based heuristic
  tts.ts                                        — Web Speech Synthesis wrapper
```

---

## How to run locally

```bash
npm run dev
```

Dev server on http://localhost:3000. Env vars live in `.env.local` (see `.env.local.example`).

If you run `next dev` directly instead of via npm, you must strip the phantom env var yourself:

```bash
env -u ANTHROPIC_API_KEY next dev
```
