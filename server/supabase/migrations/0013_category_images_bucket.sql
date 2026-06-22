-- Dedicated public storage bucket for category cover images.
-- Uploads are performed server-side with the service-role key (bypasses RLS);
-- the bucket is public so the app can read cover images directly.
insert into storage.buckets (id, name, public)
values ('category-images', 'category-images', true)
on conflict (id) do update set public = excluded.public;
