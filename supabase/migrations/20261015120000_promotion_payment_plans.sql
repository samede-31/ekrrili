alter table public.listings
  add column if not exists featured_until timestamptz,
  add column if not exists featured_expiration_notified_at timestamptz;

update public.listings
set is_featured = false
where is_featured is true
  and featured_until is null;

alter table public.listings
  add constraint listings_featured_requires_expiry
  check (is_featured is false or featured_until is not null);

alter table public.listing_promotions
  add column if not exists plan_id text,
  add column if not exists duration_days integer,
  add column if not exists amount_dzd integer,
  add column if not exists payment_method text,
  add column if not exists payment_reference text,
  add column if not exists sender_info text,
  add column if not exists receipt_image_url text;

alter table public.listing_promotions
  add constraint listing_promotions_plan_duration_positive
    check (duration_days is null or duration_days between 1 and 365),
  add constraint listing_promotions_amount_nonnegative
    check (amount_dzd is null or amount_dzd > 0),
  add constraint listing_promotions_payment_method_valid
    check (payment_method is null or payment_method in ('baridimob', 'ccp')),
  add constraint listing_promotions_payment_reference_valid
    check (payment_reference is null or length(trim(payment_reference)) between 4 and 100),
  add constraint listing_promotions_sender_info_valid
    check (sender_info is null or length(trim(sender_info)) between 2 and 120);

update public.listing_promotions
set status = 'rejected',
    reviewed_at = now(),
    rejection_note = 'Legacy promotion request requires resubmission with payment details.'
where status = 'pending'
  and (plan_id is null or duration_days is null or amount_dzd is null
    or payment_method is null or payment_reference is null or sender_info is null
    or receipt_image_url is null);

alter table public.listing_promotions
  add constraint listing_promotions_pending_payment_details_required
  check (
    status <> 'pending'
    or (
      plan_id is not null
      and duration_days is not null
      and amount_dzd is not null
      and payment_method is not null
      and payment_reference is not null
      and sender_info is not null
      and receipt_image_url is not null
    )
  );

create unique index if not exists listing_promotions_payment_reference_unique
  on public.listing_promotions (lower(trim(payment_reference)))
  where payment_reference is not null;

create index if not exists listings_featured_until_idx
  on public.listings (featured_until)
  where is_featured is true;

create table public.platform_settings (
  id text primary key check (id = 'promotion_payments'),
  ccp_account_number text not null default '',
  ccp_key text not null default '',
  baridimob_rip text not null default '',
  account_holder_name text not null default '',
  support_phone text not null default '',
  promotion_plans jsonb not null default '[
    {"id":"15_days","name":"باقة 15 يوماً","duration_days":15,"amount_dzd":600,"enabled":true},
    {"id":"30_days","name":"باقة 30 يوماً (شهر)","duration_days":30,"amount_dzd":1000,"enabled":true},
    {"id":"90_days","name":"باقة 90 يوماً (3 أشهر)","duration_days":90,"amount_dzd":2500,"enabled":true}
  ]'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

alter table public.platform_settings enable row level security;
grant select on public.platform_settings to authenticated;
grant insert, update on public.platform_settings to authenticated;

create policy "Authenticated users read promotion payment settings"
on public.platform_settings for select
to authenticated
using (true);

create policy "Admins manage promotion payment settings"
on public.platform_settings for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

insert into public.platform_settings (id)
values ('promotion_payments')
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listing-promotion-receipts', 'listing-promotion-receipts', false, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.validate_promotion_plan_settings()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  plan jsonb;
  plan_ids text[];
begin
  if new.ccp_account_number !~ '^[0-9]{1,30}$' and new.ccp_account_number <> '' then
    raise exception 'Invalid CCP account number';
  end if;
  if new.baridimob_rip !~ '^[0-9]{1,40}$' and new.baridimob_rip <> '' then
    raise exception 'Invalid BaridiMob RIP';
  end if;
  if new.ccp_key !~ '^[0-9]{1,40}$' and new.ccp_key <> '' then
    raise exception 'Invalid CCP key';
  end if;
  if length(new.account_holder_name) > 120 or length(new.support_phone) > 40 or length(new.ccp_key) > 40 then
    raise exception 'Payment settings value is too long';
  end if;
  if jsonb_typeof(new.promotion_plans) <> 'array'
     or jsonb_array_length(new.promotion_plans) not between 2 and 10 then
    raise exception 'Promotion plans must contain between two and ten entries';
  end if;

  for plan in select value from jsonb_array_elements(new.promotion_plans)
  loop
    if coalesce(plan->>'id', '') !~ '^[a-z0-9_-]{2,40}$'
       or coalesce(plan->>'name', '') = ''
       or length(plan->>'name') > 100
       or coalesce(plan->>'duration_days', '') !~ '^[0-9]+$'
       or (plan->>'duration_days')::integer not between 1 and 365
       or coalesce(plan->>'amount_dzd', '') !~ '^[0-9]+$'
       or (plan->>'amount_dzd')::integer not between 1 and 100000000
       or coalesce(plan->>'enabled', 'true') not in ('true', 'false') then
      raise exception 'Invalid promotion plan entry';
    end if;
  end loop;

  select array_agg(value->>'id')
  into plan_ids
  from jsonb_array_elements(new.promotion_plans) as plans(value);
  if cardinality(plan_ids) <> (
    select count(distinct plan_id)::integer
    from unnest(plan_ids) as ids(plan_id)
  ) then
    raise exception 'Promotion plan IDs must be unique';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger platform_settings_validate_plans
before insert or update on public.platform_settings
for each row execute function public.validate_promotion_plan_settings();

drop policy if exists "Owners submit promotion requests for own listings" on public.listing_promotions;
revoke insert on public.listing_promotions from authenticated;
revoke update on public.listing_promotions from authenticated;
grant select on public.listing_promotions to authenticated;

create or replace function public.submit_listing_promotion(
  requested_listing_id uuid,
  requested_receipt_path text,
  requested_plan_id text,
  requested_duration_days integer,
  requested_amount_dzd integer,
  requested_payment_method text,
  requested_payment_reference text,
  requested_sender_info text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  selected_plan jsonb;
  promotion_id uuid;
  listing_featured boolean;
begin
  if actor_id is null then
    raise exception 'Authentication required';
  end if;
  if requested_payment_method is null
     or requested_receipt_path is null
     or requested_payment_reference is null
     or requested_sender_info is null
     or requested_payment_method not in ('baridimob', 'ccp')
     or length(trim(requested_payment_reference)) not between 4 and 100
     or length(trim(requested_sender_info)) not between 2 and 120
     or requested_receipt_path not like actor_id::text || '/%' then
    raise exception 'Invalid promotion payment details';
  end if;

  select plans.plan into selected_plan
  from public.platform_settings settings,
       lateral jsonb_array_elements(settings.promotion_plans) as plans(plan)
  where settings.id = 'promotion_payments'
    and plans.plan->>'id' = requested_plan_id
    and coalesce((plans.plan->>'enabled')::boolean, false);

  if selected_plan is null then
    raise exception 'Selected promotion plan is unavailable';
  end if;
  if requested_duration_days is distinct from (selected_plan->>'duration_days')::integer
     or requested_amount_dzd is distinct from (selected_plan->>'amount_dzd')::integer then
    raise exception 'Selected promotion plan price or duration has changed';
  end if;

  select l.is_featured and l.featured_until > now()
  into listing_featured
  from public.listings l
  where l.id = requested_listing_id
    and l.owner_id = actor_id
  for update;
  if not found then
    raise exception 'Listing not found or not owned by the current user';
  end if;
  if listing_featured then
    raise exception 'Listing already has an active promotion';
  end if;
  if exists (
    select 1 from public.listing_promotions p
    where p.listing_id = requested_listing_id and p.status = 'pending'
  ) then
    raise exception 'A promotion request is already pending for this listing';
  end if;

  insert into public.listing_promotions (
    listing_id, owner_id, receipt_path, receipt_image_url,
    plan_id, duration_days, amount_dzd, payment_method,
    payment_reference, sender_info
  ) values (
    requested_listing_id, actor_id, requested_receipt_path, requested_receipt_path,
    requested_plan_id, (selected_plan->>'duration_days')::integer,
    (selected_plan->>'amount_dzd')::integer, requested_payment_method,
    trim(requested_payment_reference), trim(requested_sender_info)
  )
  returning id into promotion_id;
  return promotion_id;
end;
$$;

revoke all on function public.submit_listing_promotion(uuid, text, text, integer, integer, text, text, text) from public;
grant execute on function public.submit_listing_promotion(uuid, text, text, integer, integer, text, text, text) to authenticated;

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
  target_duration_days integer;
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
  returning p.listing_id, p.duration_days into target_listing_id, target_duration_days;

  if target_listing_id is null then
    raise exception 'Pending promotion request not found';
  end if;

  if decision = 'approved' then
    update public.listings
    set is_featured = true,
        featured_until = now() + make_interval(days => target_duration_days),
        featured_expiration_notified_at = null
    where id = target_listing_id;
  end if;
end;
$$;

revoke all on function public.review_listing_promotion(uuid, text, text) from public;
grant execute on function public.review_listing_promotion(uuid, text, text) to authenticated;

alter table public.notifications
  drop constraint if exists notifications_event_type_check;
alter table public.notifications
  add constraint notifications_event_type_check
  check (event_type in ('rental_request', 'rental_status', 'identity_verified', 'promotion_status', 'featured_expired'));

create or replace function public.expire_featured_listings()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  expired_count integer;
begin
  with expired as (
    update public.listings l
    set is_featured = false,
        featured_expiration_notified_at = now()
    where l.is_featured is true
      and l.featured_until is not null
      and l.featured_until <= now()
      and l.featured_expiration_notified_at is null
    returning l.id, l.owner_id, l.title, l.featured_until
  ), notifications_created as (
    insert into public.notifications (user_id, event_type, title, body, entity_id)
    select expired.owner_id,
           'featured_expired',
           'انتهت مدة تمييز إعلانك',
           'انتهت باقة تمييز إعلان «' || expired.title || '». يمكنك إرسال طلب ترقية جديد.',
           expired.id
    from expired
    returning id
  )
  select count(*) into expired_count from notifications_created;
  return expired_count;
end;
$$;

revoke all on function public.expire_featured_listings() from public;
grant execute on function public.expire_featured_listings() to anon, authenticated;

-- Hosted projects with pg_cron enabled process expirations hourly. Routes also
-- invoke the idempotent RPC so the fallback works when pg_cron is unavailable.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    execute $job$
      select cron.schedule(
        'ekrrili-expire-featured-listings',
        '5 * * * *',
        'select public.expire_featured_listings()'
      )
      where not exists (
        select 1 from cron.job where jobname = 'ekrrili-expire-featured-listings'
      )
    $job$;
  end if;
end;
$$;
