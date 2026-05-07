# Claude Code — Build Prompt for Noi
# Paste this entire prompt to kick off the build session

---

## Project: Noi (Nối)

Build a bilingual life administration assistant web app called **Noi** (Vietnamese for "to connect/bridge"). The app helps elderly Vietnamese-speaking parents navigate Australian life administration, with their adult child as a co-pilot who can view all activity, add context, and delegate tasks.

---

## Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 14 (App Router) | Use React Server Components where possible |
| Styling | Tailwind CSS | Mobile-first. No component library — custom components only. |
| Database | Supabase (PostgreSQL + Realtime) | Realtime subscriptions for live co-pilot view |
| Auth | Supabase Auth | Magic link (passwordless email) only — no passwords |
| AI | Anthropic API | `claude-sonnet-4-20250514` — streaming responses |
| Voice input | Web Speech API | Browser-native, set `lang="vi-VN"` for Vietnamese mode |
| Voice output | Web Speech Synthesis API | Browser TTS, Vietnamese voice. Wrap in a utility so it's easy to swap to ElevenLabs later. |
| Deployment | Vercel + Supabase | Standard Next.js/Vercel deployment |

---

## Environment variables required

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
```

---

## Database schema

Run these in the Supabase SQL editor to set up the schema.

```sql
-- Family spaces (one per family)
create table family_spaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text unique not null default upper(substring(gen_random_uuid()::text, 1, 6)),
  created_at timestamptz default now()
);

-- Users (linked to a family space)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  family_space_id uuid references family_spaces(id),
  display_name text,
  role text check (role in ('parent', 'child')) not null default 'child',
  language_preference text check (language_preference in ('vi', 'en')) not null default 'vi',
  created_at timestamptz default now()
);

-- Conversation threads (one per question/task)
create table threads (
  id uuid primary key default gen_random_uuid(),
  family_space_id uuid references family_spaces(id) not null,
  created_by uuid references profiles(id),
  initiated_by_role text check (initiated_by_role in ('parent', 'child')),
  category_tag text, -- 'medicare', 'tax', 'banking', 'utilities', 'appointments', 'legal', 'other'
  status text check (status in ('open', 'resolved')) default 'open',
  title_vi text,    -- AI-generated short title in Vietnamese
  title_en text,    -- AI-generated short title in English
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Messages within threads
create table messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid references threads(id) on delete cascade not null,
  sender_id uuid references profiles(id),
  sender_role text check (sender_role in ('parent', 'child', 'assistant')),
  -- Dual language storage: both versions generated at write time
  content_vi text,       -- Vietnamese version
  content_en text,       -- English version
  input_language text,   -- language the user typed/spoke in ('vi' or 'en')
  message_type text check (message_type in ('query', 'response', 'copilot_comment', 'copilot_task')) default 'query',
  created_at timestamptz default now()
);

-- Checklist items (generated from AI responses)
create table checklist_items (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid references threads(id) on delete cascade not null,
  message_id uuid references messages(id),
  text_vi text not null,
  text_en text not null,
  is_completed boolean default false,
  completed_by uuid references profiles(id),
  completed_at timestamptz,
  sort_order int default 0,
  created_at timestamptz default now()
);

-- Row Level Security
alter table family_spaces enable row level security;
alter table profiles enable row level security;
alter table threads enable row level security;
alter table messages enable row level security;
alter table checklist_items enable row level security;

-- Policies: users can only see data from their own family space
create policy "Family space access" on family_spaces
  for all using (
    id in (select family_space_id from profiles where id = auth.uid())
  );

create policy "Profile access" on profiles
  for all using (
    family_space_id in (select family_space_id from profiles where id = auth.uid())
  );

create policy "Thread access" on threads
  for all using (
    family_space_id in (select family_space_id from profiles where id = auth.uid())
  );

create policy "Message access" on messages
  for all using (
    thread_id in (
      select id from threads where
      family_space_id in (select family_space_id from profiles where id = auth.uid())
    )
  );

create policy "Checklist access" on checklist_items
  for all using (
    thread_id in (
      select id from threads where
      family_space_id in (select family_space_id from profiles where id = auth.uid())
    )
  );
```

---

## Dual-language storage — important implementation detail

Every AI response must be stored in **both** Vietnamese and English simultaneously at write time. This avoids re-calling the API for translation on every language toggle.

When calling the Anthropic API for an AI response:
1. Make one API call with the user's query
2. The response will be in the user's language (detected from input)
3. Immediately make a second API call to translate the response to the other language
4. Store both in `content_vi` and `content_en` on the messages row

For checklist items: also store both `text_vi` and `text_en` for every item.

For thread titles: generate a short title in both languages (5–8 words) and store in `title_vi` / `title_en`.

The UI layer should simply read the correct column based on `profiles.language_preference` — no runtime translation needed.

---

## AI integration

### System prompt

The system prompt is stored in `/lib/system-prompt.ts` as a string constant. Use the full text of the `noi-system-prompt.md` file provided alongside this build prompt.

### API route

Create a streaming API route at `app/api/chat/route.ts`:

```typescript
// Accepts: { threadId, message, language, additionalContext? }
// Streams: Claude response chunks
// On completion: saves both language versions to DB, extracts checklist items, generates thread title
```

### Checklist extraction

After receiving the full response, run a second (non-streaming) Claude call to extract checklist items:

```
Extract any checklist items from this response as JSON.
Return: { items: [{ text_vi: string, text_en: string }] }
If there are no checklist items, return { items: [] }.
Response: [INSERT FULL RESPONSE HERE]
```

### Language detection

Before sending to Claude, detect language of the user's input:
- If input is predominantly Vietnamese characters → set `input_language = 'vi'`
- If input is English → set `input_language = 'en'`
- Pass this as context to Claude so it knows which language to respond in

Use a simple heuristic: if the string contains Vietnamese diacritical characters (àáảãạăắặẵẳẹẻẽếềệ...) → Vietnamese.

---

## App structure

```
app/
  (auth)/
    login/page.tsx          -- Magic link email entry
    verify/page.tsx         -- "Check your email" confirmation screen
    setup/page.tsx          -- First-time: create family space, set role + name
    join/page.tsx           -- Join existing space with invite code (alternative to magic link)
  (app)/
    layout.tsx              -- Auth guard + profile context
    page.tsx                -- Role-based redirect: /parent or /child
    parent/
      page.tsx              -- Parent home: mic button + recent threads
      thread/[id]/page.tsx  -- Parent thread view: Vietnamese responses + checklist
    child/
      page.tsx              -- Child dashboard: activity feed of all parent threads
      thread/[id]/page.tsx  -- Child thread view: English + co-pilot controls
      new-task/page.tsx     -- Child creates task for parent
    settings/page.tsx       -- Language toggle, display name, invite code display

components/
  VoiceInput.tsx            -- Mic button + Web Speech API
  MessageBubble.tsx         -- Single message, language-aware
  ChecklistPanel.tsx        -- Checklist with tick-off functionality
  ThreadCard.tsx            -- Summary card for thread list
  LanguageToggle.tsx        -- Tap to see alternate language of a message
  CopilotPanel.tsx          -- Child's context-adding sidebar
  StreamingResponse.tsx     -- Handles streaming AI response display

lib/
  supabase/
    client.ts               -- Supabase browser client
    server.ts               -- Supabase server client (for Server Components)
  anthropic.ts              -- Anthropic client + streaming helper
  system-prompt.ts          -- The Noi system prompt as a constant
  language-detect.ts        -- Vietnamese vs English detection utility
  tts.ts                    -- Web Speech Synthesis wrapper

hooks/
  useVoiceInput.ts          -- Web Speech API hook
  useThread.ts              -- Real-time thread subscription
  useProfile.ts             -- Current user profile
```

---

## UI requirements

### General

- Mobile-first. The parent will primarily use a phone.
- Clean, warm, minimal. No sidebar navigation on mobile.
- Font size base: **18px** for the parent view (larger than standard — elderly users need bigger text)
- Font size base: **16px** for the child view
- Color palette: warm off-white background (`#FAFAF8`), dark charcoal text (`#1C1C1A`), one accent color — a soft teal (`#1D9E75`)
- Use `DM Sans` from Google Fonts as the primary typeface — friendly, legible, modern
- Rounded corners throughout (`border-radius: 12px` for cards, `24px` for bubbles)
- No dark mode required for MVP

### Parent view (`/parent`)

The parent view must be extremely simple. Three things visible on the home screen:
1. A large circular microphone button (centred, prominent — this is the primary action)
2. A text input field below it as an alternative to voice
3. A list of recent threads below that (Vietnamese titles only)

The mic button should:
- Show a pulsing ring animation when recording
- Display the transcribed text in real time as the user speaks
- Auto-submit after 2 seconds of silence (configurable)

When a response is loading, show a simple animated indicator — no spinner, just three soft dots pulsing.

Thread view for parent:
- Large Vietnamese text for the AI response
- A speaker icon to read the response aloud (TTS)
- Checklist below if present — large tap targets for checkboxes
- No UI controls the parent doesn't need (no edit, no delete, no share)

### Child view (`/child`)

The child dashboard is an activity feed:
- Each thread shown as a card: Vietnamese title, English title, category tag, timestamp, status badge
- Unread/new threads highlighted with a teal left border
- Tap a card to open the thread

Thread view for child:
- Shows the parent's original query (Vietnamese) with an English translation toggle
- Shows the AI response in English with a Vietnamese toggle
- "Add context" button: opens a text panel where the child types additional context → this triggers a Claude re-call with the original query + context appended
- "Reply to parent" button: child types in English → translated to Vietnamese → shown to parent as a message in the thread
- Checklist panel: same items the parent sees, ticked status synced via Supabase Realtime
- Category tag selector (child can manually tag if AI didn't)

### New task flow (`/child/new-task`)

Child types a task or question in English.
App sends it to Claude, which generates:
- A Vietnamese version of the question
- Step-by-step Vietnamese instructions for the parent
- English version of both for the child to preview

Child reviews the translation, then submits → creates a new thread and notifies the parent (visual indicator on their home screen).

### Auth screens

Keep auth screens minimal and warm:
- Login: email input + "Send me a login link" button. Below: "Join with a family code" link.
- Verify: friendly message — "We've sent a link to [email]. Tap it to open Noi." with a small resend option.
- Setup (first time): asks for display name, then asks "Are you the parent or a family member helping out?" — two large illustrated cards to choose from. If child: shows invite code to share with parent. If parent: asks for the family code from their child (or creates a new space).

---

## Supabase Realtime

The child's dashboard and thread view must use Supabase Realtime to update without page refresh when:
- Parent submits a new query
- AI response arrives
- Parent ticks a checklist item

Use `supabase.channel()` with `postgres_changes` on the `messages` and `checklist_items` tables, filtered by `family_space_id`.

---

## Error handling

- If the Anthropic API fails mid-stream, show a friendly error in the user's language and offer a retry button. Do not show technical errors to the parent.
- Vietnamese error: "Xin lỗi, có lỗi xảy ra. Vui lòng thử lại."
- English error: "Something went wrong. Please try again."
- If voice input is not supported by the browser, show the text input only — do not show an error.
- If the user's device doesn't support Vietnamese TTS, hide the speaker icon silently.

---

## What NOT to build in Phase 1

Do not build:
- Push notifications (email or mobile)
- Document/photo upload
- Multiple family members (>2 users per space)
- Account settings beyond display name and language preference
- Admin or analytics dashboard
- Any form of payments or subscription

These are Phase 2+. Keep the codebase clean and do not add placeholder UI for these.

---

## Definition of done for Phase 1

- [ ] Magic link auth working end-to-end
- [ ] Family space creation + invite code join flow
- [ ] Parent can speak in Vietnamese → AI responds in Vietnamese → response displayed + readable aloud
- [ ] Parent can type in Vietnamese as alternative to voice
- [ ] Checklist items extracted from response and displayed, tappable
- [ ] All threads and messages stored in Supabase with dual-language columns populated
- [ ] Child can see all parent threads in real time
- [ ] Child can open a thread and see parent's query + AI response in English
- [ ] Child can add context → AI re-responds with better answer
- [ ] Child can write a message in English → translated to Vietnamese → shown to parent in thread
- [ ] Child can create a new task for parent (English → Vietnamese + steps)
- [ ] Language toggle works on individual messages (tap to see other language)
- [ ] Checklist completion syncs in real time between parent and child
- [ ] Deployed to Vercel, connected to Supabase production project
