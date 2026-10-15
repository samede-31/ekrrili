alter table public.listings
  add column item_condition text not null default 'Not provided';

alter table public.rental_requests
  add column pickup_at timestamptz,
  add column return_at timestamptz,
  add column damage_terms text not null default
    'The renter is responsible for damage beyond normal wear and tear and should notify the owner promptly.',
  add column late_return_terms text not null default
    'The renter must return the item at the agreed time. Any extension or additional charge requires agreement between both parties.',
  add column caution_reimbursement_terms text not null default
    'The caution is returned after handover and inspection, less any documented amounts agreed by both parties.';

update public.rental_requests
set pickup_at = start_date::timestamp at time zone 'UTC',
    return_at = end_date::timestamp at time zone 'UTC'
where pickup_at is null or return_at is null;

alter table public.rental_requests
  alter column pickup_at set not null,
  alter column return_at set not null,
  add constraint rental_requests_valid_pickup_return check (pickup_at < return_at);
