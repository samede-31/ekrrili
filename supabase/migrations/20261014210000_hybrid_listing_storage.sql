insert into public.categories (name_ar, name_fr, slug, icon, dynamic_schema)
values
  ('كاميرات وتصوير', 'Photo & caméra', 'camera', 'camera', '{"fields":[{"name":"model","type":"text","label":"الطراز"},{"name":"serialNumber","type":"text","label":"الرقم التسلسلي"},{"name":"accessories","type":"checkboxes","label":"الملحقات المتضمنة"}]}'::jsonb),
  ('سيارات ومركبات', 'Véhicules', 'vehicle', 'car-front', '{"fields":[{"name":"transmission","type":"select","label":"ناقل الحركة"},{"name":"fuelType","type":"select","label":"نوع الوقود"},{"name":"mileage","type":"number","label":"المسافة المقطوعة (كم)"}]}'::jsonb),
  ('معدات وآلات ثقيلة', 'Engins & matériel', 'machinery', 'construction', '{"fields":[{"name":"machineType","type":"text","label":"نوع الآلة"},{"name":"operatingHours","type":"number","label":"ساعات التشغيل"},{"name":"powerSource","type":"select","label":"مصدر الطاقة"}]}'::jsonb),
  ('إلكترونيات', 'Électronique', 'electronics', 'laptop', '{"fields":[{"name":"model","type":"text","label":"الطراز"},{"name":"serialNumber","type":"text","label":"الرقم التسلسلي"},{"name":"accessories","type":"checkboxes","label":"الملحقات المتضمنة"}]}'::jsonb),
  ('لوازم المناسبات', 'Événementiel', 'event', 'party-popper', '{"fields":[{"name":"itemType","type":"text","label":"نوع المستلزم"},{"name":"quantity","type":"number","label":"الكمية المتاحة"}]}'::jsonb),
  ('تخييم ورحلات', 'Camping & plein air', 'camping', 'tent-tree', '{"fields":[{"name":"itemType","type":"text","label":"نوع المعدات"},{"name":"capacity","type":"number","label":"السعة (عدد الأشخاص)"}]}'::jsonb),
  ('عقارات', 'Immobilier', 'real-estate', 'house', '{"fields":[{"name":"propertyType","type":"text","label":"نوع العقار"},{"name":"bedrooms","type":"number","label":"عدد الغرف"},{"name":"area","type":"number","label":"المساحة (م²)"}]}'::jsonb)
on conflict (slug) do update set
  name_ar = excluded.name_ar,
  name_fr = excluded.name_fr,
  icon = excluded.icon,
  dynamic_schema = excluded.dynamic_schema;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listing-images', 'listing-images', true, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Listing images are publicly readable" on storage.objects;
create policy "Listing images are publicly readable"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'listing-images');

drop policy if exists "Owners upload listing images to their own folder" on storage.objects;
create policy "Owners upload listing images to their own folder"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'listing-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Owners update listing images in their own folder" on storage.objects;
create policy "Owners update listing images in their own folder"
on storage.objects for update
to authenticated
using (
  bucket_id = 'listing-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'listing-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Owners delete listing images in their own folder" on storage.objects;
create policy "Owners delete listing images in their own folder"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'listing-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1
       from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'listings'
     ) then
    alter publication supabase_realtime add table public.listings;
  end if;
end;
$$;
