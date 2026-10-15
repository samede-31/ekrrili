-- Monetization is limited to paid platform advertising and Pro Store subscriptions.
-- Rental requests, deposits, handovers, and peer-to-peer payments remain disabled.

insert into public.platform_settings (id)
values ('promotion_payments')
on conflict (id) do nothing;

update public.platform_settings
set promotion_plans = '[
  {"id":"plan_15d","name":"خطة 15 يوم","duration_days":15,"amount_dzd":600,"amount_usd":3,"enabled":true},
  {"id":"plan_30d","name":"خطة 30 يوم - شهر كامل","duration_days":30,"amount_dzd":1000,"amount_usd":5,"enabled":true}
]'::jsonb
where id = 'promotion_payments'
  and (
    select count(*) from jsonb_array_elements(promotion_plans) as plans(plan)
    where plan->>'id' in ('plan_15d', 'plan_30d')
  ) <> 2;

update public.platform_settings settings
set promotion_plans = (
  select jsonb_agg(
    jsonb_set(plan, '{name}', to_jsonb(case plan->>'id'
      when 'plan_15d' then 'خطة 15 يوم'
      else 'خطة 30 يوم - شهر كامل'
    end))
    order by case plan->>'id' when 'plan_15d' then 1 else 2 end
  )
  from jsonb_array_elements(settings.promotion_plans) as plans(plan)
  where plan->>'id' in ('plan_15d', 'plan_30d')
)
where id = 'promotion_payments'
  and (select count(*) from jsonb_array_elements(settings.promotion_plans) as plans(plan)
       where plan->>'id' in ('plan_15d', 'plan_30d')) = 2;

drop policy if exists "Authenticated users read promotion payment settings" on public.platform_settings;
drop policy if exists "Admins manage promotion payment settings" on public.platform_settings;
create policy "Authenticated users read promotion payment settings"
on public.platform_settings for select to authenticated
using (true);
create policy "Admins manage promotion payment settings"
on public.platform_settings for all to authenticated
using (public.is_admin())
with check (public.is_admin());
grant select, insert, update on public.platform_settings to authenticated;
revoke delete on public.platform_settings from authenticated;
alter table public.profiles
  add column if not exists pro_expiration_notified_at timestamptz;

create or replace function public.validate_fixed_subscription_plan_durations()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  plan jsonb;
  plan_count integer := 0;
begin
  if jsonb_typeof(new.promotion_plans) is distinct from 'array'
     or jsonb_array_length(new.promotion_plans) <> 2 then
    raise exception 'Exactly two platform subscription plans are required';
  end if;
  for plan in select value from jsonb_array_elements(new.promotion_plans)
  loop
    plan_count := plan_count + 1;
    if (plan->>'id' = 'plan_15d' and ((plan->>'duration_days')::integer <> 15 or plan->>'name' <> 'خطة 15 يوم'))
       or (plan->>'id' = 'plan_30d' and ((plan->>'duration_days')::integer <> 30 or plan->>'name' <> 'خطة 30 يوم - شهر كامل'))
       or plan->>'id' not in ('plan_15d', 'plan_30d') then
      raise exception 'The official plan durations are fixed at 15 and 30 days';
    end if;
  end loop;
  return new;
end;
$$;
drop trigger if exists platform_settings_fixed_plan_durations on public.platform_settings;
create trigger platform_settings_fixed_plan_durations
before insert or update of promotion_plans on public.platform_settings
for each row execute function public.validate_fixed_subscription_plan_durations();

drop policy if exists "Owners and admins read promotion requests" on public.listing_promotions;
drop policy if exists "Owners submit promotion requests for own listings" on public.listing_promotions;
drop policy if exists "Admins review promotion requests" on public.listing_promotions;
create policy "Owners and admins read promotion requests"
on public.listing_promotions for select to authenticated
using (owner_id = (select auth.uid()) or public.is_admin());
create policy "Owners submit promotion requests for own listings"
on public.listing_promotions for insert to authenticated
with check (
  owner_id = (select auth.uid())
  and status = 'pending'
  and exists (
    select 1 from public.listings listing
    where listing.id = listing_id and listing.owner_id = (select auth.uid())
  )
);
create policy "Admins review promotion requests"
on public.listing_promotions for update to authenticated
using (public.is_admin())
with check (public.is_admin());
grant select on public.listing_promotions to authenticated;
revoke insert, update, delete on public.listing_promotions from authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listing-promotion-receipts', 'listing-promotion-receipts', false, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "Owners upload their promotion receipts" on storage.objects;
drop policy if exists "Owners and admins read promotion receipts" on storage.objects;
create policy "Owners upload their promotion receipts"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'listing-promotion-receipts'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (select 1 from public.profiles profile where profile.id = (select auth.uid()) and profile.is_suspended is false)
);
create policy "Owners and admins read promotion receipts"
on storage.objects for select to authenticated
using (
  bucket_id = 'listing-promotion-receipts'
  and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_admin())
);

drop policy if exists "Owners and admins read pro store applications" on public.pro_store_applications;
drop policy if exists "Owners apply for pro stores" on public.pro_store_applications;
drop policy if exists "Admins review pro store applications" on public.pro_store_applications;
create policy "Owners and admins read pro store applications"
on public.pro_store_applications for select to authenticated
using (owner_id = (select auth.uid()) or public.is_admin());
create policy "Admins review pro store applications"
on public.pro_store_applications for update to authenticated
using (public.is_admin())
with check (public.is_admin());
grant select, update on public.pro_store_applications to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pro-store-receipts', 'pro-store-receipts', false, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "Owners upload pro store receipts" on storage.objects;
drop policy if exists "Owners and admins read pro store receipts" on storage.objects;
create policy "Owners upload pro store receipts"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'pro-store-receipts'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (select 1 from public.profiles profile where profile.id = (select auth.uid()) and profile.is_suspended is false)
);
create policy "Owners and admins read pro store receipts"
on storage.objects for select to authenticated
using (
  bucket_id = 'pro-store-receipts'
  and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_admin())
);

create or replace function public.guard_subscription_payment_submission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  suspended boolean;
begin
  if auth.uid() is null or new.owner_id is distinct from auth.uid() then
    raise exception 'Authenticated owner submission required';
  end if;
  select profile.is_suspended into suspended
  from public.profiles profile
  where profile.id = new.owner_id;
  if coalesce(suspended, true) then raise exception 'Suspended accounts cannot submit platform subscriptions'; end if;
  if new.status <> 'pending' then raise exception 'Subscription applications must start pending'; end if;
  return new;
end;
$$;
drop trigger if exists listing_promotions_submission_guard on public.listing_promotions;
create trigger listing_promotions_submission_guard
before insert on public.listing_promotions
for each row execute function public.guard_subscription_payment_submission();
drop trigger if exists pro_store_applications_submission_guard on public.pro_store_applications;
create trigger pro_store_applications_submission_guard
before insert on public.pro_store_applications
for each row execute function public.guard_subscription_payment_submission();

create or replace function public.prevent_classified_only_privileged_field_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null
     and not public.is_admin()
     and coalesce(current_setting('ekrrili.platform_subscription_update', true), '') <> 'on' then
    if tg_table_name = 'listings' then
      if new.is_featured is distinct from old.is_featured
         or new.featured_until is distinct from old.featured_until then
        raise exception 'Only verified payments or administrators can change featured status';
      end if;
    elsif tg_table_name = 'profiles' then
      if new.is_pro_store is distinct from old.is_pro_store
         or new.pro_until is distinct from old.pro_until
         or new.store_name is distinct from old.store_name
         or new.store_slug is distinct from old.store_slug
         or new.store_bio is distinct from old.store_bio
         or new.store_wilaya is distinct from old.store_wilaya
         or new.business_hours is distinct from old.business_hours
         or new.map_location is distinct from old.map_location then
        raise exception 'Only verified payments or administrators can change Pro Store status';
      end if;
    end if;
  end if;
  return new;
end;
$$;

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
  promotion public.listing_promotions%rowtype;
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  if decision not in ('approved', 'rejected') then raise exception 'Invalid promotion review decision'; end if;
  select * into promotion
  from public.listing_promotions
  where id = promotion_id and status = 'pending'
  for update;
  if not found then raise exception 'Pending promotion request not found'; end if;
  update public.listing_promotions
  set status = decision,
      reviewed_at = now(),
      rejection_note = case when decision = 'rejected' then nullif(trim(note), '') end
  where id = promotion_id;
  if decision = 'approved' then
    perform set_config('ekrrili.platform_subscription_update', 'on', true);
    update public.listings
    set is_featured = true,
        featured_until = now() + make_interval(days => promotion.duration_days),
        featured_expiration_notified_at = null
    where id = promotion.listing_id;
  end if;
end;
$$;
revoke all on function public.review_listing_promotion(uuid, text, text) from public, anon;
grant execute on function public.review_listing_promotion(uuid, text, text) to authenticated;
grant execute on function public.submit_listing_promotion(uuid, text, text, integer, text, numeric, text, text, text) to authenticated;

create or replace function public.review_pro_store_application(
  application_id uuid,
  decision text,
  rejection_message text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  application public.pro_store_applications%rowtype;
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  if decision not in ('approved', 'rejected') then raise exception 'Invalid review decision'; end if;
  select * into application
  from public.pro_store_applications
  where id = application_id and status = 'pending'
  for update;
  if not found then raise exception 'Pending Pro Store application not found'; end if;
  if decision = 'approved' and exists (
    select 1 from public.profiles
    where store_slug = application.store_slug and id <> application.owner_id
  ) then raise exception 'Store URL is already in use'; end if;
  update public.pro_store_applications
  set status = decision,
      rejection_note = case when decision = 'rejected' then nullif(trim(rejection_message), '') end,
      reviewed_at = now()
  where id = application_id;
  if decision = 'approved' then
    perform set_config('ekrrili.platform_subscription_update', 'on', true);
    update public.profiles as profile
    set is_pro_store = true,
        store_name = application.store_name,
        store_slug = application.store_slug,
        store_bio = application.store_bio,
        store_wilaya = application.wilaya,
        business_hours = application.business_hours,
        map_location = application.map_location,
        pro_until = greatest(coalesce(profile.pro_until, now()), now()) + make_interval(days => application.pro_days),
        pro_expiration_notified_at = null
    where id = application.owner_id;
  end if;
  insert into public.notifications (user_id, event_type, title, body, entity_id)
  values (
    application.owner_id,
    'promotion_status',
    case when decision = 'approved' then 'تم تفعيل متجر PRO' else 'تم رفض طلب متجر PRO' end,
    case when decision = 'approved'
      then 'تم تأكيد الدفع وتفعيل متجر ' || application.store_name || ' لمدة ' || application.pro_days || ' يوماً.'
      else coalesce(nullif(trim(rejection_message), ''), 'راجع بيانات التحويل ثم أعد تقديم الطلب.')
    end,
    application.id
  );
end;
$$;
revoke all on function public.review_pro_store_application(uuid, text, text) from public, anon;
grant execute on function public.review_pro_store_application(uuid, text, text) to authenticated;
grant execute on function public.submit_pro_store_application(text, text, text, jsonb, text, text, text, text, text, text, text, numeric, text) to authenticated;

create or replace function public.expire_pro_stores()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  expired_count integer := 0;
  expired_store record;
begin
  perform set_config('ekrrili.platform_subscription_update', 'on', true);
  for expired_store in
    update public.profiles
    set is_pro_store = false,
        pro_expiration_notified_at = now()
    where is_pro_store is true
      and pro_until is not null
      and pro_until <= now()
      and pro_expiration_notified_at is null
    returning id, store_name
  loop
    insert into public.notifications (user_id, event_type, title, body)
    values (
      expired_store.id,
      'promotion_status',
      'انتهى اشتراك متجر PRO',
      'انتهت مدة اشتراك متجر ' || coalesce(expired_store.store_name, 'PRO') || ' وأصبح غير ظاهر في دليل المتاجر.'
    );
    expired_count := expired_count + 1;
  end loop;
  return expired_count;
end;
$$;
revoke all on function public.expire_pro_stores() from public, anon;
grant execute on function public.expire_pro_stores() to authenticated;

create or replace view public.active_pro_stores
with (security_barrier = true)
as
select
  id as owner_id,
  store_name,
  store_slug,
  store_bio,
  store_wilaya,
  business_hours,
  map_location,
  phone_number,
  pro_until
from public.profiles
where is_pro_store is true
  and pro_until > now();
revoke all on public.active_pro_stores from public;
grant select on public.active_pro_stores to anon, authenticated;

comment on table public.listing_promotions is
  'Paid platform advertising placement requests. Rental payments and deposits remain peer-to-peer and off-platform.';
comment on table public.pro_store_applications is
  'Paid subscriptions for platform Pro Store storefront services; unrelated to rental payments.';
