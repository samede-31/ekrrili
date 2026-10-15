alter table public.platform_settings
  add column if not exists bybit_uid text not null default '',
  add column if not exists bybit_pay_qr_url text not null default '',
  add column if not exists usdt_wallet_address text not null default '';

update public.platform_settings settings
set promotion_plans = (
  select jsonb_agg(jsonb_build_object(
    'id', case plan->>'id' when '15_days' then 'plan_15d' when '30_days' then 'plan_30d' else plan->>'id' end,
    'name', coalesce(nullif(plan->>'name', ''), case when plan->>'id' in ('15_days', 'plan_15d') then 'خطة 15 يوم' else 'خطة شهر كامل' end),
    'duration_days', case when plan->>'id' in ('15_days', 'plan_15d') then 15 else 30 end,
    'amount_dzd', coalesce((plan->>'amount_dzd')::integer, case when plan->>'id' in ('15_days', 'plan_15d') then 600 else 1000 end),
    'amount_usd', coalesce((plan->>'amount_usd')::numeric, case when plan->>'id' in ('15_days', 'plan_15d') then 3 else 5 end),
    'enabled', coalesce((plan->>'enabled')::boolean, true)
  ) order by case when plan->>'id' in ('15_days', 'plan_15d') then 1 else 2 end)
  from jsonb_array_elements(settings.promotion_plans) as plans(plan)
  where plan->>'id' in ('15_days', '30_days', 'plan_15d', 'plan_30d')
)
where id = 'promotion_payments'
  and (select count(*) from jsonb_array_elements(settings.promotion_plans) plans(plan)
       where plan->>'id' in ('15_days', '30_days', 'plan_15d', 'plan_30d')) = 2;

update public.platform_settings
set promotion_plans = '[
  {"id":"plan_15d","name":"خطة 15 يوم","duration_days":15,"amount_dzd":600,"amount_usd":3,"enabled":true},
  {"id":"plan_30d","name":"خطة شهر كامل","duration_days":30,"amount_dzd":1000,"amount_usd":5,"enabled":true}
]'::jsonb
where id = 'promotion_payments' and (
  select count(*) from jsonb_array_elements(promotion_plans) plans(plan)
  where plan->>'id' in ('plan_15d', 'plan_30d')
) <> 2;

create or replace function public.validate_promotion_plan_settings()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  plan jsonb;
  plan_ids text[];
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
  if jsonb_typeof(new.promotion_plans) <> 'array' or jsonb_array_length(new.promotion_plans) <> 2 then
    raise exception 'Exactly two promotion plans are required';
  end if;
  for plan in select value from jsonb_array_elements(new.promotion_plans)
  loop
    if coalesce(plan->>'id', '') not in ('plan_15d', 'plan_30d')
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
  if cardinality(plan_ids) <> 2 or plan_ids @> array['plan_15d'] = false or plan_ids @> array['plan_30d'] = false then
    raise exception 'Both official promotion plans must be configured';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

alter table public.listing_promotions
  alter column receipt_path drop not null,
  add column if not exists currency text not null default 'DZD',
  add column if not exists amount_usd numeric(12, 2);
alter table public.listing_promotions
  drop constraint if exists listing_promotions_payment_method_valid,
  drop constraint if exists listing_promotions_pending_payment_details_required;

update public.listing_promotions
set status = 'rejected',
    reviewed_at = now(),
    rejection_note = 'Legacy promotion plan is no longer available; please resubmit.'
where status = 'pending' and plan_id not in ('15_days', '30_days', 'plan_15d', 'plan_30d');
update public.listing_promotions
set plan_id = case plan_id when '15_days' then 'plan_15d' when '30_days' then 'plan_30d' else plan_id end
where plan_id in ('15_days', '30_days');

alter table public.listing_promotions
  add constraint listing_promotions_payment_method_valid check (payment_method is null or payment_method in ('baridimob', 'ccp', 'bybit')),
  add constraint listing_promotions_currency_valid check (currency in ('DZD', 'USD')),
  add constraint listing_promotions_amount_usd_positive check (amount_usd is null or amount_usd > 0),
  add constraint listing_promotions_pending_payment_details_required check (
    status <> 'pending'
    or (
      plan_id in ('plan_15d', 'plan_30d')
      and duration_days is not null
      and payment_method is not null
      and payment_reference is not null
      and sender_info is not null
      and (
        (currency = 'DZD' and amount_dzd is not null and amount_usd is null and payment_method in ('baridimob', 'ccp') and receipt_image_url is not null)
        or (currency = 'USD' and amount_usd is not null and amount_dzd is null and payment_method = 'bybit')
      )
    )
  );

drop function if exists public.submit_listing_promotion(uuid, text, text, integer, integer, text, text, text);
create function public.submit_listing_promotion(
  requested_listing_id uuid,
  requested_receipt_path text,
  requested_plan_id text,
  requested_duration_days integer,
  requested_currency text,
  requested_amount numeric,
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
  if actor_id is null then raise exception 'Authentication required'; end if;
  if requested_currency is null or requested_currency not in ('DZD', 'USD')
     or requested_payment_method is null
     or requested_amount is null or requested_amount <= 0
     or requested_duration_days is null
     or (requested_currency = 'DZD' and requested_payment_method not in ('baridimob', 'ccp'))
     or (requested_currency = 'USD' and requested_payment_method <> 'bybit')
     or (requested_currency = 'DZD' and requested_receipt_path is null)
     or requested_receipt_path is not null and requested_receipt_path not like actor_id::text || '/%'
     or length(trim(coalesce(requested_payment_reference, ''))) not between 4 and 100
     or length(trim(coalesce(requested_sender_info, ''))) not between 2 and 120 then
    raise exception 'Invalid promotion payment details';
  end if;
  select plans.plan into selected_plan
  from public.platform_settings settings,
       lateral jsonb_array_elements(settings.promotion_plans) as plans(plan)
  where settings.id = 'promotion_payments'
    and plans.plan->>'id' = requested_plan_id
    and coalesce((plans.plan->>'enabled')::boolean, false);
  if selected_plan is null then raise exception 'Selected promotion plan is unavailable'; end if;
  if requested_duration_days is distinct from (selected_plan->>'duration_days')::integer
     or (requested_currency = 'DZD' and requested_amount is distinct from (selected_plan->>'amount_dzd')::numeric)
     or (requested_currency = 'USD' and requested_amount is distinct from (selected_plan->>'amount_usd')::numeric) then
    raise exception 'Selected promotion plan price or duration has changed';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(lower(trim(requested_payment_reference)), 0));
  if exists (
    select 1 from public.pro_store_applications a
    where lower(trim(a.payment_reference)) = lower(trim(requested_payment_reference))
  ) then
    raise exception 'Payment reference has already been submitted';
  end if;
  select l.is_featured and l.featured_until > now() into listing_featured
  from public.listings l where l.id = requested_listing_id and l.owner_id = actor_id for update;
  if not found then raise exception 'Listing not found or not owned by the current user'; end if;
  if listing_featured then raise exception 'Listing already has an active promotion'; end if;
  if exists (select 1 from public.listing_promotions p where p.listing_id = requested_listing_id and p.status = 'pending') then
    raise exception 'A promotion request is already pending for this listing';
  end if;
  insert into public.listing_promotions (
    listing_id, owner_id, receipt_path, receipt_image_url, plan_id, duration_days,
    amount_dzd, amount_usd, currency, payment_method, payment_reference, sender_info
  ) values (
    requested_listing_id, actor_id, requested_receipt_path, requested_receipt_path, requested_plan_id,
    (selected_plan->>'duration_days')::integer,
    case when requested_currency = 'DZD' then requested_amount::integer end,
    case when requested_currency = 'USD' then requested_amount end,
    requested_currency, requested_payment_method, trim(requested_payment_reference), trim(requested_sender_info)
  ) returning id into promotion_id;
  return promotion_id;
end;
$$;
revoke all on function public.submit_listing_promotion(uuid, text, text, integer, text, numeric, text, text, text) from public;
grant execute on function public.submit_listing_promotion(uuid, text, text, integer, text, numeric, text, text, text) to authenticated;

alter table public.pro_store_applications
  alter column receipt_path drop not null,
  add column if not exists plan_id text,
  add column if not exists currency text not null default 'DZD',
  add column if not exists amount_dzd integer,
  add column if not exists amount_usd numeric(12, 2),
  add column if not exists payment_method text,
  add column if not exists sender_info text;
alter table public.pro_store_applications
  drop constraint if exists pro_store_applications_pro_days_check,
  add constraint pro_store_applications_pro_days_check check (pro_days between 1 and 365);
alter table public.pro_store_applications
  add constraint pro_store_applications_checkout_plan check (
    plan_id is null or plan_id in ('plan_15d', 'plan_30d')
  ),
  add constraint pro_store_applications_currency_valid check (currency in ('DZD', 'USD')),
  add constraint pro_store_applications_payment_method_valid check (payment_method is null or payment_method in ('baridimob', 'ccp', 'bybit')),
  add constraint pro_store_applications_checkout_amount_valid check (
    plan_id is null or (
      (currency = 'DZD' and amount_dzd > 0 and amount_usd is null and payment_method in ('baridimob', 'ccp') and receipt_path is not null)
      or (currency = 'USD' and amount_usd > 0 and amount_dzd is null and payment_method = 'bybit')
    )
  );

drop policy if exists "Owners apply for pro stores" on public.pro_store_applications;
revoke insert on public.pro_store_applications from authenticated;
create or replace function public.submit_pro_store_application(
  requested_store_name text,
  requested_store_slug text,
  requested_store_bio text,
  requested_business_hours jsonb,
  requested_wilaya text,
  requested_map_location text,
  requested_receipt_path text,
  requested_payment_reference text,
  requested_sender_info text,
  requested_plan_id text,
  requested_currency text,
  requested_amount numeric,
  requested_payment_method text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  selected_plan jsonb;
  application_id uuid;
begin
  if actor_id is null then raise exception 'Authentication required'; end if;
  if length(trim(coalesce(requested_store_name, ''))) not between 2 and 120
     or coalesce(requested_store_slug, '') !~ '^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$'
     or length(coalesce(requested_store_bio, '')) > 2000
     or jsonb_typeof(requested_business_hours) is distinct from 'object'
     or length(trim(coalesce(requested_wilaya, ''))) not between 1 and 100
     or length(trim(coalesce(requested_payment_reference, ''))) not between 4 and 100
     or length(trim(coalesce(requested_sender_info, ''))) not between 2 and 120
     or requested_currency is null or requested_currency not in ('DZD', 'USD')
     or requested_payment_method is null
     or (requested_currency = 'DZD' and requested_payment_method not in ('baridimob', 'ccp'))
     or (requested_currency = 'USD' and requested_payment_method <> 'bybit')
     or (requested_currency = 'DZD' and requested_receipt_path is null)
     or requested_receipt_path is not null and requested_receipt_path not like actor_id::text || '/%' then
    raise exception 'Invalid Pro Store payment details';
  end if;
  select plans.plan into selected_plan
  from public.platform_settings settings,
       lateral jsonb_array_elements(settings.promotion_plans) as plans(plan)
  where settings.id = 'promotion_payments'
    and plans.plan->>'id' = requested_plan_id
    and coalesce((plans.plan->>'enabled')::boolean, false);
  if selected_plan is null
     or requested_amount is distinct from (case when requested_currency = 'DZD'
       then (selected_plan->>'amount_dzd')::numeric else (selected_plan->>'amount_usd')::numeric end) then
    raise exception 'Selected Pro Store plan is unavailable or changed';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(lower(trim(requested_payment_reference)), 0));
  if exists (
    select 1 from public.listing_promotions p
    where lower(trim(p.payment_reference)) = lower(trim(requested_payment_reference))
  ) then
    raise exception 'Payment reference has already been submitted';
  end if;
  if exists (select 1 from public.pro_store_applications a where a.status = 'pending' and a.owner_id = actor_id) then
    raise exception 'A Pro Store application is already pending';
  end if;
  if exists (select 1 from public.profiles p where p.store_slug = requested_store_slug and p.id <> actor_id)
     or exists (select 1 from public.pro_store_applications a where a.store_slug = requested_store_slug and a.status = 'pending') then
    raise exception 'Store URL is already in use';
  end if;
  insert into public.pro_store_applications (
    owner_id, store_name, store_slug, store_bio, business_hours, wilaya, map_location,
    receipt_path, payment_reference, sender_info, plan_id, currency, amount_dzd, amount_usd,
    payment_method, pro_days
  ) values (
    actor_id, trim(requested_store_name), requested_store_slug, coalesce(requested_store_bio, ''),
    requested_business_hours, trim(requested_wilaya), nullif(trim(coalesce(requested_map_location, '')), ''),
    requested_receipt_path, trim(requested_payment_reference), trim(requested_sender_info), requested_plan_id,
    requested_currency,
    case when requested_currency = 'DZD' then requested_amount::integer end,
    case when requested_currency = 'USD' then requested_amount end,
    requested_payment_method, (selected_plan->>'duration_days')::integer
  ) returning id into application_id;
  return application_id;
end;
$$;
revoke all on function public.submit_pro_store_application(text,text,text,jsonb,text,text,text,text,text,text,text,numeric,text) from public;
grant execute on function public.submit_pro_store_application(text,text,text,jsonb,text,text,text,text,text,text,text,numeric,text) to authenticated;
