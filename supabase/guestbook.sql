create table if not exists public.guestbook_comments (
  id bigint generated always as identity primary key,
  pseudonym text not null check (char_length(pseudonym) between 2 and 32),
  message text not null check (char_length(message) between 2 and 600),
  created_at timestamptz not null default now()
);

alter table public.guestbook_comments enable row level security;

create policy "Public guestbook comments are readable"
on public.guestbook_comments for select
to anon
using (true);

create policy "Visitors may sign the guestbook"
on public.guestbook_comments for insert
to anon
with check (
  char_length(pseudonym) between 2 and 32
  and char_length(message) between 2 and 600
);
