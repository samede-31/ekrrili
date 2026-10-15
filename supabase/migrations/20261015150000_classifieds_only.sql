-- Ekrrili is a classifieds publisher, not a payment, rental, or handover intermediary.
-- Preserve historical records, but disable new platform-mediated transaction activity.

drop policy if exists "Users request active listings as renters" on public.rental_requests;
drop policy if exists "Listing owners update rental request status" on public.rental_requests;
drop policy if exists "Renters cancel their own pending or approved requests" on public.rental_requests;
revoke insert, update, delete on public.rental_requests from authenticated;

drop policy if exists "Participants review completed rentals" on public.reviews;
revoke insert on public.reviews from authenticated;

drop policy if exists "Participants write their own handover logs" on public.rental_handover_logs;
revoke insert, update, delete on public.rental_handover_logs from authenticated;
drop policy if exists "Participants upload handover photos" on storage.objects;

drop policy if exists "Owners apply for pro stores" on public.pro_store_applications;
revoke insert, update, delete on public.pro_store_applications from authenticated;
revoke all on function public.submit_pro_store_application(text,text,text,jsonb,text,text,text,text,text,text,text,numeric,text) from public, authenticated;
revoke all on function public.review_pro_store_application(uuid,text,text) from public, authenticated;
drop policy if exists "Owners upload pro store receipts" on storage.objects;
drop policy if exists "Owners and admins read pro store receipts" on storage.objects;
revoke insert, update, delete on public.listing_promotions from authenticated;
revoke all on function public.submit_listing_promotion(uuid, text, text, integer, text, numeric, text, text, text) from public, authenticated;
revoke all on function public.review_listing_promotion(uuid, text, text) from public, authenticated;
drop policy if exists "Owners upload their promotion receipts" on storage.objects;
drop policy if exists "Owners and admins read promotion receipts" on storage.objects;

drop policy if exists "Admins manage promotion payment settings" on public.platform_settings;
drop policy if exists "Authenticated users read promotion payment settings" on public.platform_settings;
revoke select, insert, update, delete on public.platform_settings from authenticated;
update public.platform_settings
set ccp_account_number = '',
    ccp_key = '',
    baridimob_rip = '',
    account_holder_name = '',
    bybit_uid = '',
    bybit_pay_qr_url = '',
    usdt_wallet_address = ''
where id = 'promotion_payments';

drop policy if exists "Owners create their own blackout dates" on public.listing_blackout_dates;
drop policy if exists "Owners remove their own blackout dates" on public.listing_blackout_dates;
revoke insert, update, delete on public.listing_blackout_dates from authenticated;
revoke all on function public.get_listing_unavailable_dates(uuid, date, date) from public, anon, authenticated;
revoke all on function public.is_listing_available(uuid, date, date) from public, anon, authenticated;
revoke all on function public.get_rental_agreement(uuid) from public, anon, authenticated;
revoke all on function public.verify_rental_contract(uuid) from public, anon, authenticated;

update public.profiles
set is_pro_store = false,
    pro_until = null;

create or replace function public.prevent_classified_only_privileged_field_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if tg_table_name = 'listings' then
      if new.is_featured is distinct from old.is_featured
         or new.featured_until is distinct from old.featured_until then
        raise exception 'Only administrators can change featured listing status';
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
        raise exception 'Pro Store subscriptions are not available';
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_owner_featured_listing_changes on public.listings;
create trigger prevent_owner_featured_listing_changes
before update on public.listings
for each row execute function public.prevent_classified_only_privileged_field_changes();

drop trigger if exists prevent_user_pro_store_changes on public.profiles;
create trigger prevent_user_pro_store_changes
before update on public.profiles
for each row execute function public.prevent_classified_only_privileged_field_changes();

comment on table public.rental_requests is
  'Legacy rental-request records retained for reference; classified-only mode disables new requests and status changes.';
comment on table public.listing_promotions is
  'Legacy promotion-payment records retained for reference; classified-only mode disables paid promotions.';
comment on table public.pro_store_applications is
  'Legacy Pro Store subscription records retained for reference; classified-only mode disables paid applications.';
