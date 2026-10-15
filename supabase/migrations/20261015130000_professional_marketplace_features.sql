alter table public.listings
  add column if not exists price_per_week numeric(12, 2),
  add column if not exists price_per_month numeric(12, 2),
  add column if not exists delivery_available boolean not null default false,
  add column if not exists delivery_fee_dzd numeric(12, 2) not null default 0,
  add column if not exists addons jsonb not null default '[]'::jsonb;
alter table public.profiles
  add column if not exists is_pro_store boolean not null default false,
  add column if not exists store_name text,
  add column if not exists store_slug text,
  add column if not exists store_bio text,
  add column if not exists store_wilaya text,
  add column if not exists business_hours jsonb not null default '{}'::jsonb,
  add column if not exists map_location text,
  add column if not exists pro_until timestamptz,
  add constraint profiles_store_slug_format check (store_slug is null or store_slug ~ '^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$'),
  add constraint profiles_business_hours_object check (jsonb_typeof(business_hours) = 'object');

alter table public.listings
  add constraint listings_week_price_positive check (price_per_week is null or price_per_week > 0),
  add constraint listings_month_price_positive check (price_per_month is null or price_per_month > 0),
  add constraint listings_delivery_fee_nonnegative check (delivery_fee_dzd >= 0),
  add constraint listings_addons_array check (jsonb_typeof(addons) = 'array');
create or replace function public.validate_listing_rental_options()
returns trigger language plpgsql set search_path = '' as $$
declare
  addon jsonb;
  addon_names text[] := array[]::text[];
  addon_name text;
  addon_price numeric;
begin
  if new.price_per_week is not null and new.price_per_week > new.price_per_day * 7 then
    raise exception 'Weekly price must be discounted against the daily rate';
  end if;
  if new.price_per_month is not null and new.price_per_month > new.price_per_day * 30 then
    raise exception 'Monthly price must be discounted against the daily rate';
  end if;
  if not new.delivery_available and new.delivery_fee_dzd <> 0 then
    raise exception 'Delivery fee requires delivery to be enabled';
  end if;
  if jsonb_typeof(new.addons) is distinct from 'array' then raise exception 'Listing add-ons must be an array'; end if;
  if jsonb_array_length(new.addons) > 20 then raise exception 'A listing can have at most twenty add-ons'; end if;
  for addon in select value from jsonb_array_elements(new.addons)
  loop
    addon_name := trim(coalesce(addon->>'name',''));
    if jsonb_typeof(addon) <> 'object' or length(addon_name) not between 2 and 80
       or coalesce(addon->>'price_per_day_dzd','') !~ '^[0-9]+([.][0-9]{1,2})?$' then
      raise exception 'Invalid listing add-on';
    end if;
    addon_price := (addon->>'price_per_day_dzd')::numeric;
    if addon_price < 0 or addon_price > 100000000 or addon_name = any(addon_names) then
      raise exception 'Add-on prices must be valid and names unique';
    end if;
    addon_names := array_append(addon_names, addon_name);
  end loop;
  return new;
end;
$$;
create trigger listings_validate_rental_options
before insert or update of price_per_day, price_per_week, price_per_month, delivery_available, delivery_fee_dzd, addons
on public.listings for each row execute function public.validate_listing_rental_options();

create unique index if not exists profiles_store_slug_unique
  on public.profiles (store_slug)
  where store_slug is not null;
alter table public.rental_requests
  add column if not exists delivery_method text not null default 'pickup',
  add column if not exists delivery_fee_dzd numeric(12, 2) not null default 0,
  add column if not exists selected_addons jsonb not null default '[]'::jsonb,
  add column if not exists pricing_breakdown jsonb not null default '{}'::jsonb;

alter table public.rental_requests
  add constraint rental_requests_delivery_method_valid check (delivery_method in ('pickup', 'delivery')),
  add constraint rental_requests_delivery_fee_nonnegative check (delivery_fee_dzd >= 0),
  add constraint rental_requests_selected_addons_array check (jsonb_typeof(selected_addons) = 'array'),
  add constraint rental_requests_pricing_breakdown_object check (jsonb_typeof(pricing_breakdown) = 'object');

create or replace function public.prepare_rental_request()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  listing_record record;
  rental_days integer;
  monthly_blocks integer;
  weekly_blocks integer;
  daily_blocks integer;
  base_total numeric(12,2);
  addons_total numeric(12,2) := 0;
  addon jsonb;
  allowed_addon jsonb;
begin
  select l.owner_id, l.status, l.price_per_day, l.price_per_week, l.price_per_month,
         l.caution_deposit_amount, l.caution_type, l.delivery_available, l.delivery_fee_dzd, l.addons
  into listing_record
  from public.listings as l
  where l.id = new.listing_id;

  if not found then raise exception 'Listing does not exist'; end if;
  if listing_record.owner_id = new.renter_id then raise exception 'Listing owners cannot rent their own listing'; end if;
  if listing_record.status <> 'active' then raise exception 'Only active listings can be requested'; end if;
  if new.status <> 'pending' then raise exception 'New rental requests must start as pending'; end if;
  rental_days := new.end_date - new.start_date;
  if rental_days < 1 then raise exception 'Rental dates are invalid'; end if;

  monthly_blocks := case when listing_record.price_per_month is not null then rental_days / 30 else 0 end;
  weekly_blocks := case when listing_record.price_per_week is not null then (rental_days - monthly_blocks * 30) / 7 else 0 end;
  daily_blocks := rental_days - monthly_blocks * 30 - weekly_blocks * 7;
  base_total := monthly_blocks * coalesce(listing_record.price_per_month, 0)
    + weekly_blocks * coalesce(listing_record.price_per_week, 0)
    + daily_blocks * listing_record.price_per_day;

  if new.delivery_method = 'delivery' then
    if not listing_record.delivery_available then raise exception 'Delivery is unavailable for this listing'; end if;
    new.delivery_fee_dzd := listing_record.delivery_fee_dzd;
  else
    new.delivery_fee_dzd := 0;
  end if;
  for addon in select value from jsonb_array_elements(new.selected_addons)
  loop
    select value into allowed_addon
    from jsonb_array_elements(listing_record.addons)
    where value->>'name' = addon->>'name'
      and (value->>'price_per_day_dzd')::numeric = (addon->>'price_per_day_dzd')::numeric
    limit 1;
    if allowed_addon is null then raise exception 'Selected add-on is unavailable'; end if;
    addons_total := addons_total + (allowed_addon->>'price_per_day_dzd')::numeric * rental_days;
  end loop;
  if new.total_price <> base_total + addons_total + new.delivery_fee_dzd then
    raise exception 'Total price does not match the listing rates and selected options';
  end if;

  new.pricing_breakdown := jsonb_build_object(
    'rental_days', rental_days,
    'daily_total', listing_record.price_per_day * rental_days,
    'base_total', base_total,
    'addons_total', addons_total,
    'delivery_fee_dzd', new.delivery_fee_dzd
  );

  create policy "Admins read all rental handover logs"
  on public.rental_handover_logs for select to authenticated
  using (public.is_admin());
  create policy "Admins read rental handover photos"
  on storage.objects for select to authenticated
  using (bucket_id = 'rental-handover-photos' and public.is_admin());
  new.caution_deposit_amount := listing_record.caution_deposit_amount;
  new.caution_type := listing_record.caution_type;
  new.caution_status := case when listing_record.caution_deposit_amount = 0 then 'not_required'::public.caution_status else 'pending'::public.caution_status end;
  return new;
end;
$$;

create or replace function public.get_rental_agreement(request_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  select jsonb_build_object(
    'contractId', 'EKR-' || upper(substr(rr.id::text, 1, 12)),
    'generatedAt', now(),
    'status', rr.status,
    'owner', jsonb_build_object('fullName', owner_profile.full_name, 'phoneNumber', coalesce(owner_profile.phone_number, 'غير مسجل')),
    'renter', jsonb_build_object('fullName', renter_profile.full_name, 'phoneNumber', coalesce(renter_profile.phone_number, 'غير مسجل')),
    'item', jsonb_build_object(
      'title', l.title, 'condition', l.item_condition,
      'accessories', case when jsonb_typeof(l.metadata -> 'accessories') = 'array' then l.metadata -> 'accessories' else '[]'::jsonb end
    ),
    'caution', jsonb_build_object(
      'amountDzd', rr.caution_deposit_amount, 'type', rr.caution_type,
      'reimbursementTerms', rr.caution_reimbursement_terms
    ),
    'rental', jsonb_build_object(
      'pickupAt', rr.pickup_at, 'returnAt', rr.return_at, 'totalCostDzd', rr.total_price,
      'damageTerms', rr.damage_terms, 'lateReturnTerms', rr.late_return_terms,
      'deliveryMethod', rr.delivery_method, 'deliveryFeeDzd', rr.delivery_fee_dzd,
      'selectedAddons', rr.selected_addons, 'pricingBreakdown', rr.pricing_breakdown
    )
  ) into result
  from public.rental_requests rr
  join public.listings l on l.id = rr.listing_id
  join public.profiles owner_profile on owner_profile.id = l.owner_id
  join public.profiles renter_profile on renter_profile.id = rr.renter_id
  where rr.id = request_id and rr.status in ('approved','active','completed')
    and (rr.renter_id = (select auth.uid()) or l.owner_id = (select auth.uid()) or public.is_admin());
  if result is null then raise exception 'Confirmed rental agreement not found or access denied'; end if;
  return result;
end;
$$;
revoke all on function public.get_rental_agreement(uuid) from public;
grant execute on function public.get_rental_agreement(uuid) to authenticated;

create or replace view public.public_profiles
with (security_barrier = true)
as
select p.id, p.full_name, p.identity_verified, p.rating, p.avatar_url, p.wilaya, p.created_at,
  p.is_pro_store, p.store_name, p.store_slug, p.store_bio, p.store_wilaya, p.business_hours, p.map_location, p.pro_until,
  case when p.is_pro_store then p.phone_number else null end as store_phone,
  (select count(*) from public.rental_requests rr where rr.renter_id = p.id and rr.status = 'completed')::integer as completed_rentals
from public.profiles p;

create table public.listing_favorites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);
alter table public.listing_favorites enable row level security;
grant select, insert, delete on public.listing_favorites to authenticated;
create policy "Users manage their own listing favorites"
  on public.listing_favorites for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.dispute_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_user_id uuid references public.profiles(id) on delete set null,
  listing_id uuid references public.listings(id) on delete set null,
  rental_request_id uuid references public.rental_requests(id) on delete set null,
  reason text not null check (reason in ('damage','late_return','no_show','fraud','other')),
  details text not null check (length(trim(details)) between 10 and 3000),
  status text not null default 'pending' check (status in ('pending','reviewing','resolved','dismissed')),
  admin_note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create index dispute_reports_queue_idx on public.dispute_reports(status, created_at desc);
create index dispute_reports_request_idx on public.dispute_reports(rental_request_id) where rental_request_id is not null;
alter table public.dispute_reports enable row level security;
grant select, insert, update on public.dispute_reports to authenticated;
create policy "Users read reports they submitted"
  on public.dispute_reports for select to authenticated using (reporter_id = auth.uid() or public.is_admin());
create policy "Participants can submit reports"
  on public.dispute_reports for insert to authenticated
  with check (
    reporter_id = auth.uid()
    and (
      (rental_request_id is not null and exists (
        select 1 from public.rental_requests r
        join public.listings l on l.id = r.listing_id
        where r.id = rental_request_id and (r.renter_id = auth.uid() or l.owner_id = auth.uid())
      ))
      or (listing_id is not null and exists (select 1 from public.listings l where l.id = listing_id and (l.owner_id = auth.uid() or l.status = 'active')))
    )
    and (
      target_user_id is null
      or (rental_request_id is not null and exists (
        select 1 from public.rental_requests r join public.listings l on l.id = r.listing_id
        where r.id = rental_request_id and target_user_id in (r.renter_id, l.owner_id)
      ))
      or (listing_id is not null and exists (
        select 1 from public.listings l where l.id = listing_id and target_user_id = l.owner_id
      ))
    )
  );
create policy "Admins manage dispute reports"
  on public.dispute_reports for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create table public.pro_store_applications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  store_name text not null check (length(trim(store_name)) between 2 and 120),
  store_slug text not null check (store_slug ~ '^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$'),
  store_bio text not null default '' check (length(store_bio) <= 2000),
  business_hours jsonb not null default '{}'::jsonb check (jsonb_typeof(business_hours) = 'object'),
  map_location text,
  receipt_path text not null,
  payment_reference text not null check (length(trim(payment_reference)) between 4 and 100),
  pro_days integer not null check (pro_days between 30 and 365),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  rejection_note text,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create unique index pro_store_application_reference_unique on public.pro_store_applications(lower(trim(payment_reference)));
create index pro_store_applications_queue_idx on public.pro_store_applications(status, submitted_at desc);
alter table public.pro_store_applications enable row level security;
grant select, insert, update on public.pro_store_applications to authenticated;
create policy "Owners and admins read pro store applications"
  on public.pro_store_applications for select to authenticated using (owner_id = auth.uid() or public.is_admin());
create policy "Owners apply for pro stores"
  on public.pro_store_applications for insert to authenticated with check (owner_id = auth.uid());
create policy "Admins review pro store applications"
  on public.pro_store_applications for update to authenticated using (public.is_admin()) with check (public.is_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pro-store-receipts','pro-store-receipts',false,8388608,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
create policy "Owners upload pro store receipts"
on storage.objects for insert to authenticated
with check (bucket_id = 'pro-store-receipts' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Owners and admins read pro store receipts"
on storage.objects for select to authenticated using (
  bucket_id = 'pro-store-receipts'
  and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
);

create or replace function public.review_pro_store_application(application_id uuid, decision text, rejection_message text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  application public.pro_store_applications%rowtype;
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  if decision not in ('approved','rejected') then raise exception 'Invalid review decision'; end if;
  select * into application from public.pro_store_applications where id = application_id and status = 'pending' for update;
  if not found then raise exception 'Pending application not found'; end if;
  if decision = 'approved' and exists(select 1 from public.profiles where store_slug = application.store_slug and id <> application.owner_id) then
    raise exception 'Store URL is already in use';
  end if;
  update public.pro_store_applications set status = decision, rejection_note = case when decision = 'rejected' then nullif(trim(rejection_message),'') end, reviewed_at = now() where id = application_id;
  if decision = 'approved' then
    update public.profiles set is_pro_store = true, store_name = application.store_name, store_slug = application.store_slug,
      store_bio = application.store_bio, store_wilaya = application.wilaya, business_hours = application.business_hours, map_location = application.map_location,
      pro_until = now() + make_interval(days => application.pro_days)
    where id = application.owner_id;
  end if;
end;
$$;
revoke all on function public.review_pro_store_application(uuid,text,text) from public;
grant execute on function public.review_pro_store_application(uuid,text,text) to authenticated;
