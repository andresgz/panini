create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text,
  created_at timestamptz not null default now()
);

create table if not exists public.user_sticker_states (
  user_id uuid not null references public.users(id) on delete cascade,
  sticker_id text not null,
  quantity integer not null default 0 check (quantity >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, sticker_id)
);

create table if not exists public.trade_processes (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.users(id) on delete cascade,
  friend_id uuid not null references public.users(id) on delete cascade,
  requested_sticker_ids text[] not null default '{}',
  offered_sticker_ids text[] not null default '{}',
  status text not null default 'requested' check (status in ('requested', 'accepted', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.users enable row level security;
alter table public.user_sticker_states enable row level security;
alter table public.trade_processes enable row level security;

create policy "Users can read users"
  on public.users for select
  to authenticated
  using (true);

create policy "Anyone can read public user profiles"
  on public.users for select
  to anon
  using (true);

create policy "Users can insert their own profile"
  on public.users for insert
  to authenticated
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.users for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Users can read all sticker states for comparisons"
  on public.user_sticker_states for select
  to authenticated
  using (true);

create policy "Anyone can read public sticker states"
  on public.user_sticker_states for select
  to anon
  using (true);

create policy "Users can insert their own sticker states"
  on public.user_sticker_states for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own sticker states"
  on public.user_sticker_states for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own sticker states"
  on public.user_sticker_states for delete
  to authenticated
  using (auth.uid() = user_id);

create policy "Trade participants can read processes"
  on public.trade_processes for select
  to authenticated
  using (auth.uid() = requester_id or auth.uid() = friend_id);

create policy "Users can request trades"
  on public.trade_processes for insert
  to authenticated
  with check (auth.uid() = requester_id);

create policy "Trade participants can update processes"
  on public.trade_processes for update
  to authenticated
  using (auth.uid() = requester_id or auth.uid() = friend_id)
  with check (auth.uid() = requester_id or auth.uid() = friend_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1), 'Coleccionista'),
    new.email
  )
  on conflict (id) do update set
    name = excluded.name,
    email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
