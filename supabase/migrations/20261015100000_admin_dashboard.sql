alter table public.profiles
  add column role text not null default 'user'
    check (role in ('user', 'admin')),
  add column is_suspended boolean not null default false;

alter table public.listings
  add column is_featured boolean not null default false;

alter table public.identity_documents
  add column rejection_note text;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'admin'
      and not p.is_suspended
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create or replace function public.guard_profile_trust_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null
     and not public.is_admin()
     and (new.identity_verified is distinct from old.identity_verified
          or new.rating is distinct from old.rating) then
    raise exception 'Identity verification and rating are system-managed fields';
  end if;
  return new;
end;
$$;

create or replace function public.guard_profile_admin_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null
     and not public.is_admin()
     and (new.role is distinct from old.role
          or new.is_suspended is distinct from old.is_suspended) then
    raise exception 'Role and suspension changes require an administrator';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_admin_fields
before update on public.profiles
for each row execute function public.guard_profile_admin_fields();

drop policy "Users create their own profile" on public.profiles;
create policy "Users create ordinary profiles"
on public.profiles for insert
to authenticated
with check (
  id = (select auth.uid())
  and identity_verified = false
  and rating = 0
  and role = 'user'
  and is_suspended = false
);

drop policy "Users read their own profile" on public.profiles;
create policy "Users and admins read profiles"
on public.profiles for select
to authenticated
using (id = (select auth.uid()) or public.is_admin());

drop policy "Users update their own profile" on public.profiles;
create policy "Users update own profile; admins manage all profiles"
on public.profiles for update
to authenticated
using (id = (select auth.uid()) or public.is_admin())
with check (id = (select auth.uid()) or public.is_admin());

create policy "Admins read all listings"
on public.listings for select
to authenticated
using (public.is_admin());

create policy "Admins manage listings"
on public.listings for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Admins delete listings"
on public.listings for delete
to authenticated
using (public.is_admin());

grant update, delete on public.listings to authenticated;

create policy "Admins read all rental requests"
on public.rental_requests for select
to authenticated
using (public.is_admin());

create policy "Admins read all identity documents"
on public.identity_documents for select
to authenticated
using (public.is_admin());

create policy "Admins review identity documents"
on public.identity_documents for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

grant update on public.identity_documents to authenticated;

create or replace function public.admin_review_identity_document(
  document_id uuid,
  decision text,
  note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_user_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Administrator access required';
  end if;
  if decision not in ('approved', 'rejected') then
    raise exception 'Invalid identity review decision';
  end if;

  update public.identity_documents
  set status = decision,
      rejection_note = case when decision = 'rejected' then nullif(trim(note), '') else null end,
      reviewed_at = now()
  where id = document_id
    and status = 'pending'
  returning user_id into target_user_id;

  if target_user_id is null then
    raise exception 'Pending identity submission not found';
  end if;

  update public.profiles
  set identity_verified = (decision = 'approved')
  where id = target_user_id;
end;
$$;

revoke all on function public.admin_review_identity_document(uuid, text, text) from public;
grant execute on function public.admin_review_identity_document(uuid, text, text) to authenticated;

create policy "Admins read private identity files"
on storage.objects for select
to authenticated
using (
  bucket_id = 'ekrrili-identity-documents'
  and public.is_admin()
);

create policy "Admins manage categories"
on public.categories for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Admins delete categories"
on public.categories for delete
to authenticated
using (public.is_admin());

grant update, delete on public.categories to authenticated;

-- Bootstrap the first administrator manually after registering:
-- update public.profiles set role = 'admin' where id = (select id from auth.users where email = 'owner@example.com');
