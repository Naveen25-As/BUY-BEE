-- BUY BEE: lock down direct access.
-- All data access goes through the Express API using the service role key (which bypasses RLS).
-- RLS is enabled with NO policies for anon/authenticated, so the public anon key cannot read or write anything.

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'addresses', 'categories', 'products', 'carts', 'cart_items',
    'wishlists', 'wishlist_items', 'coupons', 'orders', 'order_items',
    'order_status_history', 'reviews'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on table public.%I to service_role', t);
  end loop;
end;
$$;

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on all functions in schema public to service_role;

-- Make sure PostgREST picks up the new schema immediately.
notify pgrst, 'reload schema';
