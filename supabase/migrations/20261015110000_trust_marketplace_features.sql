create table public.listing_blackout_dates (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  blocked_date date not null,
  created_at timestamptz not null default now(),
  unique (listing_id, blocked_date)
);

alter table public.listing_blackout_dates enable row level security;
grant select on public.listing_blackout_dates to anon, authenticated;
grant insert, delete on public.listing_blackout_dates to authenticated;

create policy "Blackout dates are publicly readable"
on public.listing_blackout_dates for select
to anon, authenticated
using (true);

create policy "Owners create their own blackout dates"
on public.listing_blackout_dates for insert
to authenticated
with check (
  owner_id = (select auth.uid())
  and exists (
    select 1 from public.listings l
    where l.id = listing_id and l.owner_id = (select auth.uid())
  )
);

create policy "Owners remove their own blackout dates"
on public.listing_blackout_dates for delete
to authenticated
using (owner_id = (select auth.uid()));

create or replace function public.get_listing_unavailable_dates(
  requested_listing_id uuid,
  requested_start date,
  requested_end date
)
returns table (unavailable_date date, reason text)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct dates.unavailable_date, dates.reason
  from (
    select generated.day::date as unavailable_date, 'booked'::text as reason
    from public.rental_requests rr
    cross join lateral generate_series(
      greatest(rr.start_date, requested_start)::timestamp,
      least(rr.end_date - 1, requested_end - 1)::timestamp,
      interval '1 day'
    ) generated(day)
    where rr.listing_id = requested_listing_id
      and rr.status in ('approved', 'active')
      and daterange(rr.start_date, rr.end_date, '[)')
          && daterange(requested_start, requested_end, '[)')
    union all
    select blocked.blocked_date, 'blocked'::text
    from public.listing_blackout_dates blocked
    where blocked.listing_id = requested_listing_id
      and blocked.blocked_date >= requested_start
      and blocked.blocked_date < requested_end
  ) dates
  order by dates.unavailable_date;
$$;

revoke all on function public.get_listing_unavailable_dates(uuid, date, date) from public;
grant execute on function public.get_listing_unavailable_dates(uuid, date, date) to anon, authenticated;

create or replace function public.is_listing_available(
  requested_listing_id uuid,
  requested_start date,
  requested_end date
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select requested_start < requested_end
    and exists (
      select 1
      from public.listings l
      where l.id = requested_listing_id
        and l.status = 'active'
        and not exists (
          select 1
          from public.rental_requests rr
          where rr.listing_id = l.id
            and rr.status in ('approved', 'active')
            and daterange(rr.start_date, rr.end_date, '[)')
                && daterange(requested_start, requested_end, '[)')
        )
        and not exists (
          select 1
          from public.listing_blackout_dates blocked
          where blocked.listing_id = l.id
            and blocked.blocked_date >= requested_start
            and blocked.blocked_date < requested_end
        )
    );
$$;

revoke all on function public.is_listing_available(uuid, date, date) from public;
grant execute on function public.is_listing_available(uuid, date, date) to anon, authenticated;

create or replace function public.prepare_rental_request()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  listing_record record;
begin
  select l.owner_id, l.status, l.price_per_day,
         l.caution_deposit_amount, l.caution_type
  into listing_record
  from public.listings as l
  where l.id = new.listing_id
  for key share;

  if not found then
    raise exception 'Listing does not exist';
  end if;
  if listing_record.owner_id = new.renter_id then
    raise exception 'Listing owners cannot rent their own listing';
  end if;
  if listing_record.status <> 'active' then
    raise exception 'Only active listings can be requested';
  end if;
  if new.status <> 'pending' then
    raise exception 'New rental requests must start as pending';
  end if;
  if new.total_price <> listing_record.price_per_day * (new.end_date - new.start_date) then
    raise exception 'Total price does not match the listing daily rate and rental dates';
  end if;
  if exists (
    select 1
    from public.rental_requests rr
    where rr.listing_id = new.listing_id
      and rr.status in ('approved', 'active')
      and daterange(rr.start_date, rr.end_date, '[)')
          && daterange(new.start_date, new.end_date, '[)')
  ) or exists (
    select 1
    from public.listing_blackout_dates blocked
    where blocked.listing_id = new.listing_id
      and blocked.blocked_date >= new.start_date
      and blocked.blocked_date < new.end_date
  ) then
    raise exception 'Rental dates are unavailable';
  end if;

  new.caution_deposit_amount := listing_record.caution_deposit_amount;
  new.caution_type := listing_record.caution_type;
  new.caution_status := case
    when listing_record.caution_deposit_amount = 0 then 'not_required'::public.caution_status
    else 'pending'::public.caution_status
  end;
  return new;
end;
$$;

create table public.rental_handover_logs (
  id uuid primary key default gen_random_uuid(),
  rental_request_id uuid not null references public.rental_requests (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  phase text not null check (phase in ('check_in', 'check_out')),
  condition_notes text not null check (length(trim(condition_notes)) between 3 and 2000),
  photo_paths text[] not null default array[]::text[],
  created_at timestamptz not null default now(),
  unique (rental_request_id, user_id, phase)
);

alter table public.rental_handover_logs enable row level security;
grant select, insert on public.rental_handover_logs to authenticated;

create policy "Rental participants read handover logs"
on public.rental_handover_logs for select
to authenticated
using (
  exists (
    select 1
    from public.rental_requests rr
    join public.listings l on l.id = rr.listing_id
    where rr.id = rental_request_id
      and (rr.renter_id = (select auth.uid()) or l.owner_id = (select auth.uid()))
  )
);

create policy "Participants write their own handover logs"
on public.rental_handover_logs for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.rental_requests rr
    join public.listings l on l.id = rr.listing_id
    where rr.id = rental_request_id
      and (rr.renter_id = (select auth.uid()) or l.owner_id = (select auth.uid()))
      and (
        (phase = 'check_in' and rr.status in ('approved', 'active'))
        or (phase = 'check_out' and rr.status in ('active', 'completed'))
      )
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('rental-handover-photos', 'rental-handover-photos', false, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "Participants upload handover photos"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'rental-handover-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Participants read handover photos"
on storage.objects for select
to authenticated
using (
  bucket_id = 'rental-handover-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Rental participants read each other's handover photos"
on storage.objects for select
to authenticated
using (
  bucket_id = 'rental-handover-photos'
  and exists (
    select 1
    from public.rental_handover_logs logs
    join public.rental_requests rr on rr.id = logs.rental_request_id
    join public.listings l on l.id = rr.listing_id
    where name = any(logs.photo_paths)
      and (rr.renter_id = (select auth.uid()) or l.owner_id = (select auth.uid()))
  )
);

alter table public.reviews
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.refresh_profile_rating()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles p
  set rating = coalesce((
    select round(avg(r.rating)::numeric, 2)
    from public.reviews r
    where r.reviewee_id = new.reviewee_id
  ), 0)
  where p.id = new.reviewee_id;
  return new;
end;
$$;

create or replace function public.guard_profile_trust_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null
     and not public.is_admin()
     and (
       new.identity_verified is distinct from old.identity_verified
       or (new.rating is distinct from old.rating and pg_trigger_depth() <= 1)
     ) then
    raise exception 'Identity verification and rating are system-managed fields';
  end if;
  return new;
end;
$$;

create trigger reviews_refresh_profile_rating
after insert on public.reviews
for each row execute function public.refresh_profile_rating();

create table public.listing_promotions (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  receipt_path text not null unique,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  rejection_note text
);

create index listing_promotions_status_submitted_idx on public.listing_promotions (status, submitted_at desc);
alter table public.listing_promotions enable row level security;
grant select, insert on public.listing_promotions to authenticated;
grant update on public.listing_promotions to authenticated;

create policy "Owners and admins read promotion requests"
on public.listing_promotions for select
to authenticated
using (owner_id = (select auth.uid()) or public.is_admin());

create policy "Owners submit promotion requests for own listings"
on public.listing_promotions for insert
to authenticated
with check (
  owner_id = (select auth.uid())
  and status = 'pending'
  and exists (
    select 1 from public.listings l
    where l.id = listing_id and l.owner_id = (select auth.uid())
  )
  and receipt_path like owner_id::text || '/%'
);

create policy "Admins review promotion requests"
on public.listing_promotions for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listing-promotion-receipts', 'listing-promotion-receipts', false, 8388608, array['image/jpeg', 'image/png', 'application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "Owners upload their promotion receipts"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'listing-promotion-receipts'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Owners and admins read promotion receipts"
on storage.objects for select
to authenticated
using (
  bucket_id = 'listing-promotion-receipts'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or public.is_admin()
  )
);

create or replace function public.review_listing_promotion(
  promotion_id uuid,
  decision text,
  note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_listing_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Administrator access required';
  end if;
  if decision not in ('approved', 'rejected') then
    raise exception 'Invalid promotion review decision';
  end if;

  update public.listing_promotions p
  set status = decision,
      reviewed_at = now(),
      rejection_note = case when decision = 'rejected' then nullif(trim(note), '') else null end
  where p.id = promotion_id
    and p.status = 'pending'
  returning p.listing_id into target_listing_id;

  if target_listing_id is null then
    raise exception 'Pending promotion request not found';
  end if;

  if decision = 'approved' then
    update public.listings set is_featured = true where id = target_listing_id;
  end if;
end;
$$;

revoke all on function public.review_listing_promotion(uuid, text, text) from public;
grant execute on function public.review_listing_promotion(uuid, text, text) to authenticated;

create or replace function public.guard_caution_release_handover()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  owner_id uuid;
  renter_id uuid;
  log_count integer;
begin
  if new.caution_status = 'refunded' and old.caution_status is distinct from new.caution_status then
    select l.owner_id, rr.renter_id
    into owner_id, renter_id
    from public.rental_requests rr
    join public.listings l on l.id = rr.listing_id
    where rr.id = old.id;

    select count(distinct user_id) into log_count
    from public.rental_handover_logs
    where rental_request_id = old.id and phase = 'check_out'
      and user_id in (owner_id, renter_id);

    if log_count < 2 then
      raise exception 'Both rental participants must complete the return handover before refunding the caution';
    end if;
  end if;
  return new;
end;
$$;

create trigger rental_requests_guard_caution_release
before update of caution_status on public.rental_requests
for each row execute function public.guard_caution_release_handover();

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  event_type text not null check (event_type in ('rental_request', 'rental_status', 'identity_verified', 'promotion_status')),
  title text not null,
  body text not null default '',
  entity_id uuid,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index notifications_user_unread_idx on public.notifications (user_id, created_at desc) where read_at is null;
alter table public.notifications enable row level security;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

create policy "Users read their own notifications"
on public.notifications for select
to authenticated
using (user_id = (select auth.uid()));

create policy "Users mark their own notifications read"
on public.notifications for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create or replace function public.notify_rental_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  listing_owner uuid;
  listing_title text;
begin
  select l.owner_id, l.title into listing_owner, listing_title
  from public.listings l where l.id = new.listing_id;

  if tg_op = 'INSERT' then
    insert into public.notifications (user_id, event_type, title, body, entity_id)
    values (listing_owner, 'rental_request', 'طلب كراء جديد', 'لديك طلب جديد لإعلان ' || listing_title, new.id);
  elsif new.status is distinct from old.status then
    if new.status = 'approved' then
      insert into public.notifications (user_id, event_type, title, body, entity_id)
      values (new.renter_id, 'rental_status', 'تم قبول طلب الكراء', 'وافق المالك على طلب ' || listing_title, new.id);
    elsif new.status = 'cancelled' then
      insert into public.notifications (user_id, event_type, title, body, entity_id)
      values (new.renter_id, 'rental_status', 'تم تحديث طلب الكراء', 'تم إلغاء طلب ' || listing_title, new.id);
    end if;
  end if;
  return new;
end;
$$;

create trigger rental_requests_notify_insert
after insert on public.rental_requests
for each row execute function public.notify_rental_event();

create trigger rental_requests_notify_status
after update of status on public.rental_requests
for each row execute function public.notify_rental_event();

create or replace function public.notify_identity_verified()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.identity_verified is true and old.identity_verified is distinct from new.identity_verified then
    insert into public.notifications (user_id, event_type, title, body)
    values (new.id, 'identity_verified', 'تم توثيق هويتك', 'تمت مراجعة وثيقة الهوية ومنحك شارة التوثيق.');
  end if;
  return new;
end;
$$;

create trigger profiles_notify_identity_verified
after update of identity_verified on public.profiles
for each row execute function public.notify_identity_verified();

create or replace function public.notify_promotion_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status and new.status in ('approved', 'rejected') then
    insert into public.notifications (user_id, event_type, title, body, entity_id)
    values (
      new.owner_id,
      'promotion_status',
      case when new.status = 'approved' then 'تم تمييز إعلانك' else 'تم رفض طلب الترقية' end,
      case when new.status = 'approved' then 'أصبح إعلانك مميزاً على المنصة.' else coalesce(new.rejection_note, 'راجع الإيصال وأعد تقديم الطلب.') end,
      new.listing_id
    );
  end if;
  return new;
end;
$$;

create trigger listing_promotions_notify_review
after update of status on public.listing_promotions
for each row execute function public.notify_promotion_review();

create or replace function public.verify_rental_contract(request_id uuid)
returns table (contract_id text, status text, listing_title text, start_date date, end_date date)
language sql
stable
security definer
set search_path = ''
as $$
  select 'EKR-' || upper(substr(rr.id::text, 1, 12)),
         rr.status::text,
         l.title,
         rr.start_date,
         rr.end_date
  from public.rental_requests rr
  join public.listings l on l.id = rr.listing_id
  where rr.id = request_id
    and rr.status in ('approved', 'active', 'completed');
$$;

revoke all on function public.verify_rental_contract(uuid) from public;
grant execute on function public.verify_rental_contract(uuid) to anon, authenticated;
