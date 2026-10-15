-- Participants can still read the listing attached to their own rental request,
-- even if the owner pauses it after the request was submitted.
create function public.is_renter_for_listing(listing_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.rental_requests rr
    where rr.listing_id = $1
      and rr.renter_id = (select auth.uid())
  );
$$;

revoke all on function public.is_renter_for_listing(uuid) from public;
grant execute on function public.is_renter_for_listing(uuid) to authenticated;

create policy "Renters can read requested listings"
on public.listings for select
to authenticated
using (public.is_renter_for_listing(listings.id));

create function public.prevent_listing_delete_with_requests()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.rental_requests rr where rr.listing_id = old.id
  ) then
    raise exception 'Listings with rental history cannot be deleted';
  end if;
  return old;
end;
$$;

create trigger listings_prevent_delete_with_requests
before delete on public.listings
for each row execute function public.prevent_listing_delete_with_requests();

create table public.identity_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  storage_path text not null unique,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  constraint identity_documents_path_belongs_to_user
    check (storage_path like user_id::text || '/%')
);

alter table public.identity_documents enable row level security;
grant select, insert on public.identity_documents to authenticated;

create policy "Users read their own identity submissions"
on public.identity_documents for select
to authenticated
using (user_id = (select auth.uid()));

create policy "Users submit identity documents for themselves"
on public.identity_documents for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and status = 'pending'
  and reviewed_at is null
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ekrrili-identity-documents',
  'ekrrili-identity-documents',
  false,
  8388608,
  array['image/jpeg', 'image/png', 'application/pdf']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Users upload their own identity documents"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'ekrrili-identity-documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Users read their own identity documents"
on storage.objects for select
to authenticated
using (
  bucket_id = 'ekrrili-identity-documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Users remove their own identity documents"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'ekrrili-identity-documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

-- Exposes only the contract fields to a confirmed booking participant.
create function public.get_rental_agreement(request_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'contractId', 'EKR-' || upper(substr(rr.id::text, 1, 12)),
    'generatedAt', now(),
    'status', rr.status,
    'owner', jsonb_build_object(
      'fullName', owner_profile.full_name,
      'phoneNumber', coalesce(owner_profile.phone_number, 'غير مسجل')
    ),
    'renter', jsonb_build_object(
      'fullName', renter_profile.full_name,
      'phoneNumber', coalesce(renter_profile.phone_number, 'غير مسجل')
    ),
    'item', jsonb_build_object(
      'title', l.title,
      'condition', l.item_condition,
      'accessories', case
        when jsonb_typeof(l.metadata -> 'accessories') = 'array'
          then l.metadata -> 'accessories'
        else '[]'::jsonb
      end
    ),
    'caution', jsonb_build_object(
      'amountDzd', rr.caution_deposit_amount,
      'type', rr.caution_type,
      'reimbursementTerms', rr.caution_reimbursement_terms
    ),
    'rental', jsonb_build_object(
      'pickupAt', rr.pickup_at,
      'returnAt', rr.return_at,
      'totalCostDzd', rr.total_price,
      'damageTerms', rr.damage_terms,
      'lateReturnTerms', rr.late_return_terms
    )
  )
  into result
  from public.rental_requests rr
  join public.listings l on l.id = rr.listing_id
  join public.profiles owner_profile on owner_profile.id = l.owner_id
  join public.profiles renter_profile on renter_profile.id = rr.renter_id
  where rr.id = request_id
    and rr.status in ('approved', 'active', 'completed')
    and (rr.renter_id = (select auth.uid()) or l.owner_id = (select auth.uid()));

  if result is null then
    raise exception 'Confirmed rental agreement not found or access denied';
  end if;

  return result;
end;
$$;

revoke all on function public.get_rental_agreement(uuid) from public;
grant execute on function public.get_rental_agreement(uuid) to authenticated;
