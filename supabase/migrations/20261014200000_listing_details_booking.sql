create function public.is_listing_available(
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

create function public.get_listing_contact(requested_listing_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  contact_number text;
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in to contact the listing owner';
  end if;

  select p.phone_number into contact_number
  from public.listings l
  join public.profiles p on p.id = l.owner_id
  where l.id = requested_listing_id
    and (l.status = 'active' or l.owner_id = (select auth.uid()));

  if contact_number is null then
    raise exception 'The owner has not provided a contact number';
  end if;

  return contact_number;
end;
$$;

revoke all on function public.get_listing_contact(uuid) from public;
grant execute on function public.get_listing_contact(uuid) to authenticated;
