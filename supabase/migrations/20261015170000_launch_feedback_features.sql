-- Starter subscriptions and promotional trials for platform advertising only.
-- Rental payments, deposits, and physical handovers remain peer-to-peer.

alter table public.platform_settings
  add column if not exists promo_codes jsonb not null default '[]'::jsonb;

create or replace function public.validate_promotion_plan_settings()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  plan jsonb;
  plan_ids text[];
  plan_count integer := 0;
  distinct_plan_count integer;
begin
  if new.ccp_account_number !~ '^[0-9]{1,30}$' and new.ccp_account_number <> '' then raise exception 'Invalid CCP account number'; end if;
  if new.baridimob_rip !~ '^[0-9]{1,40}$' and new.baridimob_rip <> '' then raise exception 'Invalid BaridiMob RIP'; end if;
  if new.ccp_key !~ '^[0-9]{1,40}$' and new.ccp_key <> '' then raise exception 'Invalid CCP key'; end if;
  if length(new.account_holder_name) > 120 or length(new.support_phone) > 40 or length(new.ccp_key) > 40
     or length(new.bybit_uid) > 80 or length(new.usdt_wallet_address) > 120
     or length(new.bybit_pay_qr_url) > 2048 then
    raise exception 'Payment settings value is too long';
  end if;
  if new.bybit_pay_qr_url <> '' and new.bybit_pay_qr_url !~ '^https://[^[:space:]]+$' then
    raise exception 'Bybit Pay QR URL must use HTTPS';
  end if;
  if jsonb_typeof(new.promotion_plans) is distinct from 'array'
     or jsonb_array_length(new.promotion_plans) not between 2 and 5 then
    raise exception 'Between two and five promotion plans are required';
  end if;
  for plan in select value from jsonb_array_elements(new.promotion_plans)
  loop
    plan_count := plan_count + 1;
    if coalesce(plan->>'id', '') not in ('plan_7d', 'plan_15d', 'plan_30d')
       or coalesce(plan->>'name', '') = '' or length(plan->>'name') > 100
       or coalesce(plan->>'duration_days', '') !~ '^[0-9]+$'
       or (plan->>'duration_days')::integer not between 1 and 365
       or coalesce(plan->>'amount_dzd', '') !~ '^[0-9]+$'
       or (plan->>'amount_dzd')::integer not between 1 and 100000000
       or coalesce(plan->>'amount_usd', '') !~ '^[0-9]+([.][0-9]{1,2})?$'
       or (plan->>'amount_usd')::numeric not between 0.01 and 100000
       or coalesce(plan->>'enabled', 'true') not in ('true', 'false') then
      raise exception 'Invalid promotion plan entry';
    end if;
  end loop;
  select array_agg(value->>'id') into plan_ids from jsonb_array_elements(new.promotion_plans) as plans(value);
  select count(distinct value->>'id') into distinct_plan_count
  from jsonb_array_elements(new.promotion_plans) as plans(value);
  if cardinality(plan_ids) <> plan_count or distinct_plan_count <> plan_count then
    raise exception 'Promotion plan IDs must be unique';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

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
     or jsonb_array_length(new.promotion_plans) <> 3 then
    raise exception 'Exactly three platform subscription plans are required';
  end if;
  for plan in select value from jsonb_array_elements(new.promotion_plans)
  loop
    plan_count := plan_count + 1;
    if (plan->>'id' = 'plan_7d' and ((plan->>'duration_days')::integer <> 7 or plan->>'name' <> 'باقة 7 أيام - أسبوع'))
       or (plan->>'id' = 'plan_15d' and ((plan->>'duration_days')::integer <> 15 or plan->>'name' <> 'خطة 15 يوم'))
       or (plan->>'id' = 'plan_30d' and ((plan->>'duration_days')::integer <> 30 or plan->>'name' <> 'خطة 30 يوم - شهر كامل'))
       or plan->>'id' not in ('plan_7d', 'plan_15d', 'plan_30d') then
      raise exception 'Official plan durations are fixed at 7, 15, and 30 days';
    end if;
  end loop;
  if plan_count <> 3 then raise exception 'Exactly three platform subscription plans are required'; end if;
  return new;
end;
$$;

update public.platform_settings
set promotion_plans = '[
  {"id":"plan_7d","name":"باقة 7 أيام - أسبوع","duration_days":7,"amount_dzd":300,"amount_usd":1.5,"enabled":true},
  {"id":"plan_15d","name":"خطة 15 يوم","duration_days":15,"amount_dzd":600,"amount_usd":3,"enabled":true},
  {"id":"plan_30d","name":"خطة 30 يوم - شهر كامل","duration_days":30,"amount_dzd":1000,"amount_usd":5,"enabled":true}
]'::jsonb
where id = 'promotion_payments'
  and not (
    select count(*) = 3
    from jsonb_array_elements(promotion_plans) as plans(plan)
    where plan->>'id' in ('plan_7d', 'plan_15d', 'plan_30d')
  );

alter table public.listing_promotions
  drop constraint if exists listing_promotions_pending_payment_details_required,
  add constraint listing_promotions_pending_payment_details_required check (
    status <> 'pending'
    or (
      plan_id in ('plan_7d', 'plan_15d', 'plan_30d')
      and duration_days in (7, 15, 30)
      and payment_method is not null
      and payment_reference is not null
      and sender_info is not null
      and (
        (currency = 'DZD' and amount_dzd is not null and amount_usd is null and payment_method in ('baridimob', 'ccp') and receipt_image_url is not null)
        or (currency = 'USD' and amount_usd is not null and amount_dzd is null and payment_method = 'bybit')
      )
    )
  );

alter table public.pro_store_applications
  drop constraint if exists pro_store_applications_checkout_plan,
  add constraint pro_store_applications_checkout_plan check (
    plan_id is null or plan_id in ('plan_7d', 'plan_15d', 'plan_30d')
  );

create table if not exists public.promotion_promo_redemptions (
  code text not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  primary key (code, user_id)
);

alter table public.promotion_promo_redemptions enable row level security;
revoke all on public.promotion_promo_redemptions from public, anon, authenticated;
drop policy if exists "Admins read promotional code redemptions" on public.promotion_promo_redemptions;
create policy "Admins read promotional code redemptions"
on public.promotion_promo_redemptions for select to authenticated
using (public.is_admin());
grant select on public.promotion_promo_redemptions to authenticated;

create or replace function public.redeem_featured_promo_code(
  requested_listing_id uuid,
  requested_code text
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  settings_row public.platform_settings%rowtype;
  promo jsonb;
  promo_index bigint;
  use_limit integer;
  uses_so_far integer;
  trial_days integer;
  expiration timestamptz;
  listing_owner uuid;
  listing_status text;
  currently_featured boolean;
begin
  if actor_id is null then raise exception 'Authentication required'; end if;
  if coalesce(trim(requested_code), '') !~ '^[A-Za-z0-9_-]{3,32}$' then
    raise exception 'Invalid promotional code';
  end if;

  select * into settings_row
  from public.platform_settings
  where id = 'promotion_payments'
  for update;
  if not found then raise exception 'Promotion settings are unavailable'; end if;

  select entry.value, entry.ordinality
    into promo, promo_index
  from jsonb_array_elements(settings_row.promo_codes) with ordinality as entry(value, ordinality)
  where upper(entry.value->>'code') = upper(trim(requested_code))
    and coalesce((entry.value->>'active')::boolean, false)
  limit 1;
  if promo is null then raise exception 'Promotional code is invalid or inactive'; end if;

  trial_days := (promo->>'duration_days')::integer;
  use_limit := nullif(promo->>'max_uses', '')::integer;
  select count(*)::integer into uses_so_far
  from public.promotion_promo_redemptions
  where code = upper(trim(requested_code));
  if trial_days not in (7, 14) then raise exception 'Invalid promotional code duration'; end if;
  if use_limit is not null and uses_so_far >= use_limit then raise exception 'Promotional code has reached its usage limit'; end if;
  if exists (
    select 1 from public.promotion_promo_redemptions
    where code = upper(trim(requested_code)) and user_id = actor_id
  ) then raise exception 'Promotional code has already been used by this account'; end if;

  select listing.owner_id, listing.status,
         listing.is_featured and listing.featured_until > now()
    into listing_owner, listing_status, currently_featured
  from public.listings as listing
  where listing.id = requested_listing_id
  for update;
  if not found or listing_owner is distinct from actor_id then
    raise exception 'Listing not found or not owned by the current user';
  end if;
  if listing_status <> 'active' then raise exception 'Only active listings can use a promotional code'; end if;
  if currently_featured then raise exception 'Listing already has an active promotion'; end if;
  if exists (select 1 from public.profiles where id = actor_id and is_suspended is true) then
    raise exception 'Suspended accounts cannot redeem promotional codes';
  end if;

  insert into public.promotion_promo_redemptions (code, user_id, listing_id)
  values (upper(trim(requested_code)), actor_id, requested_listing_id);
  update public.platform_settings
  set promo_codes = (
    select jsonb_agg(
      case when entry.ordinality = promo_index then
        jsonb_set(
          entry.value,
          '{redeemed_count}',
          to_jsonb(uses_so_far + 1),
          true
        )
      else entry.value end
      order by entry.ordinality
    )
    from jsonb_array_elements(promo_codes) with ordinality as entry(value, ordinality)
  )
  where id = 'promotion_payments';

  expiration := now() + make_interval(days => trial_days);
  perform set_config('ekrrili.platform_subscription_update', 'on', true);
  update public.listings
  set is_featured = true,
      featured_until = expiration,
      featured_expiration_notified_at = null
  where id = requested_listing_id;
  insert into public.notifications (user_id, event_type, title, body, entity_id)
  values (
    actor_id,
    'promotion_status',
    'تم تفعيل التمييز المجاني',
    'تم تفعيل تمييز إعلانك لمدة ' || trial_days || ' أيام باستخدام رمز ترويجي.',
    requested_listing_id
  );
  return expiration;
end;
$$;

revoke all on function public.redeem_featured_promo_code(uuid, text) from public, anon;
grant execute on function public.redeem_featured_promo_code(uuid, text) to authenticated;
