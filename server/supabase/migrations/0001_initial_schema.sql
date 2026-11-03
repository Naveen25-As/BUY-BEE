-- BUY BEE: Supabase PostgreSQL schema (replaces the MongoDB/Mongoose models)
-- Run in the Supabase SQL editor or with `supabase db push`. Safe to run once on an empty project.
-- The Express backend talks to these tables with the service role key; browsers never access them directly.


-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.immutable_array_to_string(arr text[], sep text)
returns text
language sql
immutable
parallel safe
set search_path = public
as $$ select array_to_string(arr, sep) $$;

-- ---------------------------------------------------------------------------
-- profiles (application users; auth is handled by Express with JWT + bcrypt)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null check (char_length(btrim(name)) between 1 and 80),
  email                 text not null unique check (email = lower(btrim(email)) and position('@' in email) > 1),
  phone                 text,
  password_hash         text not null,
  role                  text not null default 'customer' check (role in ('customer', 'admin')),
  is_active             boolean not null default true,
  reset_password_token  text,
  reset_password_expire timestamptz,
  legacy_mongo_id       text unique,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index profiles_role_idx on public.profiles (role);
create index profiles_reset_token_idx on public.profiles (reset_password_token) where reset_password_token is not null;
create index profiles_created_at_idx on public.profiles (created_at desc);

-- ---------------------------------------------------------------------------
-- addresses (was User.addresses[])
-- ---------------------------------------------------------------------------
create table public.addresses (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles (id) on delete cascade,
  full_name       text not null check (char_length(btrim(full_name)) > 0),
  phone           text not null check (char_length(btrim(phone)) > 0),
  address_line    text not null check (char_length(btrim(address_line)) > 0),
  city            text not null check (char_length(btrim(city)) > 0),
  state           text not null check (char_length(btrim(state)) > 0),
  postal_code     text not null check (char_length(btrim(postal_code)) > 0),
  country         text not null default 'India' check (char_length(btrim(country)) > 0),
  address_type    text not null default 'home' check (address_type in ('home', 'work', 'other')),
  is_default      boolean not null default false,
  legacy_mongo_id text unique,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index addresses_user_idx on public.addresses (user_id, created_at);
create unique index addresses_one_default_per_user on public.addresses (user_id) where is_default;

-- Setting an address as default clears the flag on the user's other addresses (single atomic statement).
create or replace function public.addresses_single_default()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.is_default then
    update public.addresses
       set is_default = false
     where user_id = new.user_id
       and id <> new.id
       and is_default;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------
create table public.categories (
  id              uuid primary key default gen_random_uuid(),
  name            text not null unique check (char_length(btrim(name)) > 0),
  slug            text not null unique check (slug = lower(slug) and char_length(slug) > 0),
  description     text,
  image           text,
  is_active       boolean not null default true,
  legacy_mongo_id text unique,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------
create table public.products (
  id               uuid primary key default gen_random_uuid(),
  name             text not null check (char_length(btrim(name)) > 0),
  description      text not null check (char_length(btrim(description)) > 0),
  price            numeric(12, 2) not null check (price >= 0),
  original_price   numeric(12, 2) check (original_price >= 0),
  discount_percent integer not null default 0 check (discount_percent between 0 and 100),
  category_id      uuid not null references public.categories (id) on delete restrict,
  brand            text not null check (char_length(btrim(brand)) > 0),
  images           text[] not null default '{}',
  stock            integer not null default 0 check (stock >= 0),
  sku              text not null unique check (sku = upper(btrim(sku)) and char_length(sku) > 0),
  specifications   json not null default '{}'::json check (json_typeof(specifications) = 'object'), -- json keeps key order
  tags             text[] not null default '{}',
  rating           numeric(2, 1) not null default 0 check (rating between 0 and 5),
  num_reviews      integer not null default 0 check (num_reviews >= 0),
  is_featured      boolean not null default false,
  is_active        boolean not null default true,
  sales_count      integer not null default 0 check (sales_count >= 0),
  legacy_mongo_id  text unique,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  search_vector    tsvector generated always as (
    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(brand, '')), 'A') ||
    setweight(to_tsvector('english', public.immutable_array_to_string(tags, ' ')), 'B') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'C')
  ) stored
);
create index products_category_price_idx on public.products (category_id, price);
create index products_active_created_idx on public.products (is_active, created_at desc);
create index products_featured_idx on public.products (is_featured) where is_featured;
create index products_brand_idx on public.products (lower(brand));
create index products_sales_idx on public.products (sales_count desc);
create index products_stock_idx on public.products (stock);
create index products_search_idx on public.products using gin (search_vector);

-- Mirrors the old Mongoose pre-save hook: derive discount_percent from original_price.
create or replace function public.products_compute_discount()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.original_price is not null and new.original_price > new.price and new.original_price > 0 then
    new.discount_percent = round(((new.original_price - new.price) / new.original_price) * 100);
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- carts / cart_items (was Cart.items[])
-- ---------------------------------------------------------------------------
create table public.carts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null unique references public.profiles (id) on delete cascade,
  legacy_mongo_id text unique,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table public.cart_items (
  id              uuid primary key default gen_random_uuid(),
  cart_id         uuid not null references public.carts (id) on delete cascade,
  product_id      uuid not null references public.products (id) on delete cascade,
  quantity        integer not null default 1 check (quantity >= 1),
  price           numeric(12, 2) not null check (price >= 0),
  legacy_mongo_id text unique,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint cart_items_unique_product unique (cart_id, product_id)
);
create index cart_items_product_idx on public.cart_items (product_id);

-- ---------------------------------------------------------------------------
-- wishlists / wishlist_items (was Wishlist.products[])
-- ---------------------------------------------------------------------------
create table public.wishlists (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null unique references public.profiles (id) on delete cascade,
  legacy_mongo_id text unique,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table public.wishlist_items (
  id          uuid primary key default gen_random_uuid(),
  wishlist_id uuid not null references public.wishlists (id) on delete cascade,
  product_id  uuid not null references public.products (id) on delete cascade,
  created_at  timestamptz not null default now(),
  constraint wishlist_items_unique_product unique (wishlist_id, product_id)
);
create index wishlist_items_product_idx on public.wishlist_items (product_id);

-- ---------------------------------------------------------------------------
-- coupons
-- ---------------------------------------------------------------------------
create table public.coupons (
  id               uuid primary key default gen_random_uuid(),
  code             text not null unique check (code = upper(btrim(code)) and char_length(code) > 0),
  description      text,
  discount_type    text not null check (discount_type in ('percent', 'fixed')),
  discount_value   numeric(12, 2) not null check (discount_value >= 0),
  min_order_amount numeric(12, 2) not null default 0 check (min_order_amount >= 0),
  max_discount     numeric(12, 2) check (max_discount >= 0),
  expires_at       timestamptz not null,
  usage_limit      integer check (usage_limit >= 1),
  used_count       integer not null default 0 check (used_count >= 0),
  is_active        boolean not null default true,
  legacy_mongo_id  text unique,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint coupons_percent_max_100 check (discount_type <> 'percent' or discount_value <= 100)
);

-- ---------------------------------------------------------------------------
-- orders / order_items / order_status_history
-- ---------------------------------------------------------------------------
create table public.orders (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles (id) on delete restrict,
  order_number     text not null unique,
  shipping_address jsonb not null default '{}'::jsonb check (jsonb_typeof(shipping_address) = 'object'),
  payment_method   text not null check (payment_method in ('cod', 'online')),
  payment_status   text not null default 'pending' check (payment_status in ('pending', 'paid', 'failed', 'refunded')),
  order_status     text not null default 'pending'
                   check (order_status in ('pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled')),
  subtotal         numeric(12, 2) not null check (subtotal >= 0),
  discount         numeric(12, 2) not null default 0 check (discount >= 0),
  shipping         numeric(12, 2) not null default 0 check (shipping >= 0),
  tax              numeric(12, 2) not null default 0 check (tax >= 0),
  total            numeric(12, 2) not null check (total >= 0),
  coupon_id        uuid references public.coupons (id) on delete set null,
  coupon_code      text,
  is_paid          boolean not null default false,
  paid_at          timestamptz,
  delivered_at     timestamptz,
  cancelled_at     timestamptz,
  cancel_reason    text,
  legacy_mongo_id  text unique,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index orders_user_created_idx on public.orders (user_id, created_at desc);
create index orders_status_idx on public.orders (order_status);
create index orders_created_idx on public.orders (created_at desc);
create index orders_coupon_idx on public.orders (coupon_id);

create table public.order_items (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.orders (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete restrict,
  name       text,
  image      text,
  quantity   integer not null check (quantity >= 1),
  price      numeric(12, 2) not null check (price >= 0),
  position   integer not null default 0,
  created_at timestamptz not null default now()
);
create index order_items_order_idx on public.order_items (order_id, position);
create index order_items_product_idx on public.order_items (product_id);

create table public.order_status_history (
  id       uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  status   text not null
           check (status in ('pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled')),
  note     text,
  at       timestamptz not null default now()
);
create index order_status_history_order_idx on public.order_status_history (order_id, at);

-- ---------------------------------------------------------------------------
-- reviews
-- ---------------------------------------------------------------------------
create table public.reviews (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles (id) on delete cascade,
  product_id      uuid not null references public.products (id) on delete cascade,
  order_id        uuid not null references public.orders (id) on delete cascade,
  rating          integer not null check (rating between 1 and 5),
  comment         text not null check (char_length(btrim(comment)) between 1 and 2000),
  is_approved     boolean not null default true,
  legacy_mongo_id text unique,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint reviews_one_per_user_product unique (product_id, user_id)
);
create index reviews_product_approved_idx on public.reviews (product_id, is_approved, created_at desc);
create index reviews_user_idx on public.reviews (user_id);
create index reviews_order_idx on public.reviews (order_id);
create index reviews_created_idx on public.reviews (created_at desc);

-- Keeps products.rating / num_reviews in sync (replaces utils/updateProductRating.js).
create or replace function public.refresh_product_rating(p_product_id uuid)
returns void
language sql
set search_path = public
as $$
  update public.products p
     set rating = coalesce((select round(avg(r.rating)::numeric, 1)
                              from public.reviews r
                             where r.product_id = p_product_id and r.is_approved), 0),
         num_reviews = (select count(*)
                          from public.reviews r
                         where r.product_id = p_product_id and r.is_approved)
   where p.id = p_product_id;
$$;

create or replace function public.reviews_sync_product_rating()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.refresh_product_rating(old.product_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') and (tg_op = 'INSERT' or new.product_id <> old.product_id or new.is_approved <> old.is_approved or new.rating <> old.rating) then
    perform public.refresh_product_rating(new.product_id);
  end if;
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
create trigger profiles_updated_at  before update on public.profiles  for each row execute function public.set_updated_at();
create trigger addresses_updated_at before update on public.addresses for each row execute function public.set_updated_at();
create trigger categories_updated_at before update on public.categories for each row execute function public.set_updated_at();
create trigger products_updated_at  before update on public.products  for each row execute function public.set_updated_at();
create trigger carts_updated_at     before update on public.carts     for each row execute function public.set_updated_at();
create trigger cart_items_updated_at before update on public.cart_items for each row execute function public.set_updated_at();
create trigger wishlists_updated_at before update on public.wishlists for each row execute function public.set_updated_at();
create trigger coupons_updated_at   before update on public.coupons   for each row execute function public.set_updated_at();
create trigger orders_updated_at    before update on public.orders    for each row execute function public.set_updated_at();
create trigger reviews_updated_at   before update on public.reviews   for each row execute function public.set_updated_at();

create trigger addresses_single_default
  before insert or update of is_default on public.addresses
  for each row when (new.is_default) execute function public.addresses_single_default();

create trigger products_compute_discount
  before insert or update of price, original_price on public.products
  for each row execute function public.products_compute_discount();

create trigger reviews_sync_product_rating
  after insert or update or delete on public.reviews
  for each row execute function public.reviews_sync_product_rating();
