# Product Requirements Document
## Noi (Nối) — Bilingual Life Admin Assistant
**v0.1 draft · April 2026 · Status: For development**

---

## Table of contents

1. Problem & vision
2. User personas
3. Core features
4. User stories
5. Tech architecture
6. Auth strategy
7. Dual-language storage
8. UI/UX principles
9. Phased build plan
10. Open decisions

---

## 01 · Problem & vision

### Problem

Elderly Vietnamese-speaking parents living in an English-speaking country face daily friction navigating life administration — Medicare, bills, appointments, forms, government letters, insurance, banking — because the tools and support structures are English-first. Adult children want to help but can't always be present, and the current workarounds (phone calls, in-person visits, Google Translate) are slow, error-prone and don't create any shared record.

### Vision

A private, family-shared assistant that speaks Vietnamese, understands life admin, answers questions with actionable steps, and keeps a shared log so the adult child can stay in the loop, contribute, and bridge any gap — without being physically present.

| Field | Detail |
|---|---|
| App name | **Noi** (Nối — Vietnamese for "to connect, to bridge") |
| Platform | Web app (mobile-first responsive) — Phase 2 can add React Native |
| AI backbone | Claude (`claude-sonnet-4`) via Anthropic API |
| Language support | Vietnamese + English — both input and output |

---

## 02 · User personas

### Parent — Bà / Ba (primary user)

65–80 years old. Comfortable with a phone but not confident in English. Asks questions by voice in Vietnamese. Wants simple, clear steps in Vietnamese. Doesn't want to log in or navigate complex UI.

**Primary interaction:** voice or short text input, reads or listens to responses.

Tags: Vietnamese-first · Voice input · Simple UI · Needs step-by-step guidance

---

### Child — Con (co-pilot user)

30–45 years old. Bilingual. Uses the app on desktop or mobile. Reviews their parent's questions and the AI's responses. Can add context, override, or respond directly to their parent. Can initiate tasks on their parent's behalf — app translates to Vietnamese for the parent.

Tags: English-first · Oversight role · Task delegation · Family inbox

---

## 03 · Core features

| ID | Feature | Description |
|---|---|---|
| F-01 | Voice + text input | Parent speaks or types in Vietnamese. Child types in English. Web Speech API handles capture. Language is auto-detected. |
| F-02 | AI response engine | Claude processes the query, returns actionable steps or information. Always responds in the user's preferred language. Parent gets Vietnamese; child gets English. |
| F-03 | Family shared log | All questions and answers are stored in a shared "family space" thread log — visible to both roles. Timestamped, searchable. |
| F-04 | Child co-pilot view | Child sees all parent queries in real time. Can add a comment, add context for Claude to re-answer with, or directly respond to the parent in Vietnamese (app translates). |
| F-05 | Task & checklist engine | AI responses generate a checklist. Items can be marked done by either user. Parent sees Vietnamese; child sees English. Status syncs in real time. |
| F-06 | Child-initiated tasks | Child creates a question or task — app sends it to the parent's view translated into Vietnamese, with AI-generated steps for them to action. |
| F-07 | Text-to-speech output | Parent can tap to hear the AI's response read aloud in Vietnamese. Uses browser TTS (MVP) or ElevenLabs (V2) for natural voice. |
| F-08 | Category tagging | Queries are auto-tagged by the AI: Medicare, tax, banking, appointments, utilities, legal, etc. Filterable in the log. |
| F-09 | Family space (multi-user) | One space shared between parent + child. Linked via magic link invite. Expandable to multiple family members in V2. |

### Feature priority

- **Must have (Phase 1):** F-01, F-02, F-03, F-04, F-05, F-06
- **Nice to have (Phase 1):** F-07 (TTS), F-08 (category tags)
- **V2:** F-09 extended to multiple members, push notifications, document upload

---

## 04 · User stories

**As Bà (parent):**
- I want to ask a question by voice in Vietnamese and get back clear steps I can follow — so I don't have to call my child for every letter I receive.
- I want to hear the AI's answer read aloud in Vietnamese — so I don't need to struggle reading on a small screen.
- I want to see a checklist of steps and tick them off as I do them — so I don't lose track of what I've done.

**As Con (child):**
- I want to see every question my parent asks and the answer they received — so I know what's going on in their life admin without calling them every day.
- I want to add more context to a parent's question and have Claude regenerate a better answer — so the response is more accurate for their specific situation.
- I want to write a task in English and have it appear for my parent in Vietnamese with AI-generated steps — so I can delegate to them remotely without a language barrier.
- I want to reply directly to my parent's query in English and have it translated to Vietnamese in the app — so we can have an async bilingual conversation about their admin tasks.

---

## 05 · Tech architecture

### Recommended stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | Next.js 14 (App Router) + Tailwind CSS | Mobile-first responsive. SSR for fast first load. |
| AI | Anthropic API · `claude-sonnet-4` | Streaming responses. System prompt configures Vietnamese-aware life admin persona. |
| Voice input | Web Speech API (browser-native) | Free, no backend. Set `lang="vi-VN"` for Vietnamese. Graceful text fallback. |
| Voice output | Web Speech Synthesis API (MVP) → ElevenLabs (V2) | Browser TTS supports Vietnamese natively. |
| Database | Supabase (PostgreSQL + Realtime) | Realtime subscriptions for live co-pilot view. Row-level security enforces family space isolation. |
| Auth | Supabase Auth — magic link | Integrated with DB, free tier, no passwords. See section 06. |
| Deployment | Vercel (frontend) + Supabase (backend) | Serverless, no infra to manage. |

### Data model

```
family_spaces     — id, name, invite_code
profiles          — id, family_space_id, role (parent | child), language_preference
threads           — id, family_space_id, created_by, category_tag, status, title_vi, title_en
messages          — id, thread_id, sender_role, content_vi, content_en, input_language, message_type
checklist_items   — id, thread_id, text_vi, text_en, is_completed, completed_by, completed_at
```

---

## 06 · Auth strategy

**Recommendation: magic link email auth (Option B)**

Users enter their email and receive a one-click login link. No password ever. The child creates the family space and invites the parent via an emailed link. Supabase Auth handles this out of the box.

**Why this over alternatives:**

- Near-zero friction — parent just taps a link in their email once
- Persistent sessions — parent stays logged in on their device indefinitely
- Child controls who joins via invitation
- Supabase Row Level Security ties all data to the family space automatically
- Easy to extend with Google OAuth later without changing the data model

**Option A (invite code only, no email):** simpler but no recovery if device is lost — not recommended beyond a personal prototype.

**Option C (full OAuth):** only worthwhile if opening to users beyond the family — V2+.

---

## 07 · Dual-language storage *(architectural decision)*

Every AI response must be stored in **both** Vietnamese and English at write time. This is a first-class architectural pattern, not an afterthought.

**Why:** Avoids re-calling the API every time a user taps the language toggle. The UI simply reads the correct column (`content_vi` or `content_en`) based on `profiles.language_preference`. No runtime translation, no API cost on toggle, no latency.

**Implementation flow:**

1. User submits a query (Vietnamese or English — auto-detected)
2. First API call to Claude → response in the user's language (streamed to screen)
3. On stream completion → second API call to translate to the other language (non-streaming, fast)
4. Write both to the `messages` row simultaneously: `content_vi` and `content_en`
5. For checklist items: store `text_vi` and `text_en` for every item
6. For thread titles: generate a short title (5–8 words) in both languages → store in `title_vi` / `title_en`

**This applies to:**
- All AI assistant responses
- Checklist items extracted from responses
- Thread titles
- Child-authored messages sent to the parent (child writes in English → translate to Vietnamese)
- Parent-authored messages shown to the child (parent writes in Vietnamese → translate to English)

---

## 08 · UI/UX principles

### Parent view — maximum simplicity

- One large circular microphone button (primary action — centred and prominent)
- Text input as alternative below the mic
- Large readable Vietnamese text (base font size 18px — larger than standard for elderly users)
- Speaker icon to read any response aloud
- Checklist with large tap targets
- No UI controls the parent doesn't need

### Child view — co-pilot dashboard

- Activity feed of all parent threads (Vietnamese + English title, category tag, timestamp, status)
- Unread threads highlighted with accent border
- Thread view: parent's query + AI response, language toggle on each message
- "Add context" panel to re-prompt Claude with additional information
- "Reply to parent" — child writes in English, shown to parent in Vietnamese
- Checklist panel synced in real time

### Design direction

| Token | Value |
|---|---|
| Background | Warm off-white `#FAFAF8` |
| Text | Dark charcoal `#1C1C1A` |
| Accent | Soft teal `#1D9E75` |
| Typeface | DM Sans (Google Fonts) |
| Corner radius | 12px cards, 24px bubbles |
| Parent base size | 18px |
| Child base size | 16px |

### AI response format (enforced via system prompt)

1. One-sentence summary
2. Numbered steps (max 6 per response)
3. Optional tip or note

Checklist format used whenever the query is actionable. Never walls of text.

### Tone

Warm, patient, formal Vietnamese register. Uses "quý vị" (not "bạn") for the parent. Uses "Dạ" as respectful affirmation. No jargon.

---

## 09 · Phased build plan

### Phase 1 — MVP

Voice/text input (Vietnamese + English) → Claude streaming response → shared log visible to both roles. Magic link auth. Dual-language storage. Checklist generation + tick-off. Child co-pilot view + context re-prompting. Child-initiated tasks. Language toggle on messages.

### Phase 2

Text-to-speech output (Vietnamese). Category tags + filtering. Push/email notifications when parent asks a new question. Multiple family members per space. ElevenLabs integration for higher quality voice.

### Phase 3

Document/photo upload — parent photographs a letter, Claude interprets it. React Native app wrapper. Configurable regional context (beyond Australia).

---

## 10 · Open decisions

| Decision | Status | Notes |
|---|---|---|
| System prompt | Drafted separately | See `noi-system-prompt.md` — treat as a separate design artifact, iterate independently of the codebase |
| Australian service anchoring | Confirmed for MVP | Medicare, ATO, Centrelink, myGov, councils. Flag if regional configurability is needed later. |
| Email notifications | Deferred to Phase 2 | Visual indicator on parent home screen is the Phase 1 solution |
| TTS voice quality | Browser TTS for MVP | ElevenLabs for V2 — wrapper designed to be swappable |
| Data retention policy | Not decided | Decide before any non-personal launch |
| App name | **Noi (Nối)** | Confirmed |
