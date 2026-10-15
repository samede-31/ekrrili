-- Keep payment settings validation aligned with the supported 7/15/30-day plans.
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
