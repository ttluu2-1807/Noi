# Supabase setup — things the Vercel deploy can't apply itself

Noi doesn't use the Supabase CLI's migrations folder yet. Every feature
that touches Supabase (schema, storage, policies, cron, auth) MUST drop
its SQL here when it ships, with a status line. Apply via the Supabase
SQL editor against production.

Rule of thumb: if the feature breaks on a fresh Supabase project, its
setup belongs in this file (see memory: `feedback-ship-supabase-setup-as-migration`).

---

## Known-pending as of 2026-10-13

### 1. `family_todos.tags` column — tags on to-dos

Shipped in commit `58fbd14` (2026-10-13). The code degrades gracefully
if the column is missing, so this is low-urgency, but tags won't
persist until it's applied.

```sql
alter table public.family_todos
  add column tags text[] not null default '{}';

create index family_todos_tags_gin
  on public.family_todos using gin (tags);
```

Status: **pending** — user to apply.

### 2. `digest-audio` Storage bucket — Your week in a minute

Shipped much earlier (weekly digest audio feature). The bucket was
never created, so the first production tap errored with "bucket not
found". Fixed 2026-10-13 by creating the bucket via dashboard.

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('digest-audio', 'digest-audio', false, 10485760, array['audio/mpeg'])
on conflict (id) do nothing;

-- Family-scoped read policy (objects live at <family_id>/<week>-<lang>.mp3).
create policy "family can read own digests"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'digest-audio'
    and (storage.foldername(name))[1] = (
      select family_space_id::text from public.profiles where id = auth.uid()
    )
  );
```

Status: **applied via dashboard 2026-10-13**. Keep the SQL here so a
fresh Supabase project can be bootstrapped from this file alone.

---

## Historical reference (already applied)

These shipped and are known-live in production. Keep them here so a
fresh project (new dev, disaster recovery) can be rebuilt from this
file in one pass.

- `profiles`, `family_spaces`, `threads`, `messages` — original Phase 1 schema
- `current_user_family_space_id()` `SECURITY DEFINER` helper + RLS policies
- `diary_entries` with `tags text[]`, soft-delete, attachments
- `family_todos` baseline (text_vi, text_en, due_at, recurrence, rollover, owner_id, source_thread_id, deleted_at)
- `weekly_digests` (family_space_id, week_starting, language, script, audio_url) + unique on (family_space_id, week_starting, language)
- `push_subscriptions` (user_id, endpoint, p256dh, auth, user_agent, last_seen_at)
- `calendar_connections` (user_id, provider, access_token, refresh_token, expires_at, email) — Slice A
- Cron entry in `vercel.json` for `/api/cron/daily-digest` at 21:00 UTC

If any of the above is missing from your Supabase project, grep the
repo + git log for the migration SQL — most were pasted into chat
during build. Future features: write the SQL into this file *in the
same commit as the code*, no exceptions.
