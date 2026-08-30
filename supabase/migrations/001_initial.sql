-- Activer l'extension UUID
create extension if not exists "uuid-ossp";

-- Table de synchronisation des documents
create table documents_sync (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  device_id text not null,
  document_id text not null,
  encrypted_metadata jsonb not null,
  encrypted_page_refs jsonb not null,
  updated_at timestamptz default now() not null,
  unique(user_id, document_id)
);

-- Index pour perf
create index idx_docs_sync_user on documents_sync(user_id);
create index idx_docs_sync_updated on documents_sync(updated_at);

-- Activer RLS
alter table documents_sync enable row level security;

create policy "Users can only access their own docs"
  on documents_sync for all
  using (auth.uid() = user_id);

-- Bucket storage pour images chiffrées
insert into storage.buckets (id, name, public) 
values ('scana-images', 'scana-images', false);

-- RLS storage
create policy "Users can upload their own images"
  on storage.objects for insert
  with check (bucket_id = 'scana-images' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can read their own images"
  on storage.objects for select
  using (bucket_id = 'scana-images' and auth.uid()::text = (storage.foldername(name))[1]);
