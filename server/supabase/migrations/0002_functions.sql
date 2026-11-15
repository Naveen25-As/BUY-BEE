-- BUY BEE: transactional business operations.
-- Each function runs inside a single transaction, so multi-step writes either fully succeed or fully roll back.
-- Business errors are raised with SQLSTATE P0001 and the intended HTTP status in HINT; the API maps them to responses.

create or replace function public.order_can_transition(p_from text, p_to text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select case
    when p_to = 'cancelled' then p_from in ('pending', 'confirmed', 'processing')
    else coalesce(
      array_position(array['pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered'], p_to) =
      array_position(array['pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered'], p_from) + 1,
      false)
  end
$$;

-- Validates a coupon for a subtotal and returns the discount amount (raises on invalid coupon).
create or replace function public.coupon_discount(c public.coupons, p_subtotal numeric)
returns numeric
language plpgsql
stable
set search_path = public
as $$
declare
  v_amount numeric;
begin
  if not c.is_active then
    raise exception using message = 'Coupon is inactive', errcode = 'P0001', hint = '400';
  end if;
  if c.expires_at < now() then
    raise exception using message = 'Coupon expired', errcode = 'P0001', hint = '400';
  end if;
  if c.usage_limit is not null and c.used_count >= c.usage_limit then
    raise exception using message = 'Coupon usage limit reached', errcode = 'P0001', hint = '400';
  end if;
  if p_subtotal < c.min_order_amount then
    raise exception using message = format('Minimum order amount is ₹%s', trim_scale(c.min_order_amount)), errcode = 'P0001', hint = '400';
  end if;

  if c.discount_type = 'percent' then
    v_amount := (p_subtotal * c.discount_value) / 100;
    if c.max_discount is not null then
      v_amount := least(v_amount, c.max_discount);
    end if;
  else
    v_amount := c.discount_value;
  end if;
  return round(least(v_amount, p_subtotal), 2);
end;
$$;

create or replace function public.validate_coupon(p_code text, p_subtotal numeric)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_coupon public.coupons%rowtype;
  v_discount numeric;
begin
  select * into v_coupon from public.coupons where code = upper(btrim(coalesce(p_code, '')));
  if not found then
    raise exception using message = 'Invalid coupon', errcode = 'P0001', hint = '400';
  end if;
  v_discount := public.coupon_discount(v_coupon, greatest(coalesce(p_subtotal, 0), 0));
  return jsonb_build_object('code', v_coupon.code, 'discount', v_discount, 'description', v_coupon.description);
end;
$$;

-- Adds (or increments) a product in the user's cart with a stock check.
create or replace function public.add_to_cart(p_user_id uuid, p_product_id uuid, p_quantity integer)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_product public.products%rowtype;
  v_cart_id uuid;
  v_existing integer;
  v_new_qty integer;
begin
  if p_quantity is null or p_quantity < 1 then
    raise exception using message = 'Quantity must be at least 1', errcode = 'P0001', hint = '400';
  end if;

  select * into v_product from public.products where id = p_product_id;
  if not found or not v_product.is_active then
    raise exception using message = 'Product not found', errcode = 'P0001', hint = '404';
  end if;

  insert into public.carts (user_id) values (p_user_id) on conflict (user_id) do nothing;
  select id into v_cart_id from public.carts where user_id = p_user_id;

  select quantity into v_existing
    from public.cart_items
   where cart_id = v_cart_id and product_id = p_product_id
     for update;

  v_new_qty := coalesce(v_existing, 0) + p_quantity;
  if v_new_qty > v_product.stock then
    raise exception using message = format('Only %s items in stock', v_product.stock), errcode = 'P0001', hint = '400';
  end if;

  insert into public.cart_items (cart_id, product_id, quantity, price)
  values (v_cart_id, p_product_id, v_new_qty, v_product.price)
  on conflict (cart_id, product_id)
  do update set quantity = excluded.quantity, price = excluded.price;
end;
$$;

create or replace function public.move_wishlist_item_to_cart(p_user_id uuid, p_product_id uuid)
returns void
language plpgsql
set search_path = public
as $$
begin
  perform public.add_to_cart(p_user_id, p_product_id, 1);
  delete from public.wishlist_items wi
   using public.wishlists w
   where wi.wishlist_id = w.id
     and w.user_id = p_user_id
     and wi.product_id = p_product_id;
end;
$$;

-- Creates an order from the user's cart: validates stock/coupon, snapshots items and address,
-- decrements stock, increments coupon usage and empties the cart -- all atomically.
create or replace function public.place_order(
  p_user_id uuid,
  p_address_id uuid,
  p_payment_method text,
  p_coupon_code text,
  p_order_number text
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_addr public.addresses%rowtype;
  v_coupon public.coupons%rowtype;
  v_has_coupon boolean := false;
  v_cart_id uuid;
  v_item record;
  v_count integer := 0;
  v_subtotal numeric := 0;
  v_discount numeric := 0;
  v_taxable numeric;
  v_shipping numeric;
  v_tax numeric;
  v_total numeric;
  v_order_id uuid;
begin
  if p_payment_method is null or p_payment_method not in ('cod', 'online') then
    raise exception using message = 'Invalid payment method', errcode = 'P0001', hint = '400';
  end if;

  select * into v_addr from public.addresses where id = p_address_id and user_id = p_user_id;
  if not found then
    raise exception using message = 'Shipping address not found', errcode = 'P0001', hint = '400';
  end if;

  select id into v_cart_id from public.carts where user_id = p_user_id;

  -- Lock the products being purchased (stable order avoids deadlocks between concurrent checkouts).
  perform 1
     from public.products p
    where p.id in (select ci.product_id from public.cart_items ci where ci.cart_id = v_cart_id)
    order by p.id
      for update;

  for v_item in
    select ci.quantity, p.name, p.price, p.stock, p.is_active
      from public.cart_items ci
      join public.products p on p.id = ci.product_id
     where ci.cart_id = v_cart_id
     order by ci.created_at, ci.id
  loop
    v_count := v_count + 1;
    if not v_item.is_active then
      raise exception using message = format('Product unavailable: %s', v_item.name), errcode = 'P0001', hint = '400';
    end if;
    if v_item.quantity > v_item.stock then
      raise exception using message = format('Insufficient stock for %s', v_item.name), errcode = 'P0001', hint = '400';
    end if;
    v_subtotal := v_subtotal + v_item.price * v_item.quantity;
  end loop;

  if v_count = 0 then
    raise exception using message = 'Cart is empty', errcode = 'P0001', hint = '400';
  end if;

  if coalesce(btrim(p_coupon_code), '') <> '' then
    select * into v_coupon from public.coupons where code = upper(btrim(p_coupon_code)) for update;
    if not found then
      raise exception using message = 'Invalid coupon', errcode = 'P0001', hint = '400';
    end if;
    v_discount := public.coupon_discount(v_coupon, v_subtotal);
    v_has_coupon := true;
  end if;

  v_shipping := case when v_subtotal >= 999 then 0 when v_subtotal > 0 then 49 else 0 end;
  v_taxable := greatest(v_subtotal - v_discount, 0);
  v_tax := round(v_taxable * 0.18, 2);
  v_total := round(v_taxable + v_shipping + v_tax, 2);

  insert into public.orders (
    user_id, order_number, shipping_address, payment_method, payment_status, order_status,
    subtotal, discount, shipping, tax, total, coupon_id, coupon_code
  ) values (
    p_user_id,
    p_order_number,
    jsonb_build_object(
      'fullName', v_addr.full_name,
      'phone', v_addr.phone,
      'addressLine', v_addr.address_line,
      'city', v_addr.city,
      'state', v_addr.state,
      'postalCode', v_addr.postal_code,
      'country', v_addr.country,
      'addressType', v_addr.address_type
    ),
    p_payment_method,
    'pending',
    'pending',
    v_subtotal, v_discount, v_shipping, v_tax, v_total,
    case when v_has_coupon then v_coupon.id end,
    case when v_has_coupon then v_coupon.code end
  )
  returning id into v_order_id;

  insert into public.order_items (order_id, product_id, name, image, quantity, price, position)
  select v_order_id, p.id, p.name, p.images[1], ci.quantity, p.price,
         (row_number() over (order by ci.created_at, ci.id) - 1)::integer
    from public.cart_items ci
    join public.products p on p.id = ci.product_id
   where ci.cart_id = v_cart_id;

  insert into public.order_status_history (order_id, status, note) values (v_order_id, 'pending', 'Order placed');

  update public.products p
     set stock = p.stock - ci.quantity,
         sales_count = p.sales_count + ci.quantity
    from public.cart_items ci
   where ci.cart_id = v_cart_id
     and ci.product_id = p.id;

  if v_has_coupon then
    update public.coupons set used_count = used_count + 1 where id = v_coupon.id;
  end if;

  delete from public.cart_items where cart_id = v_cart_id;

  return v_order_id;
end;
$$;

create or replace function public.restock_order_items(p_order_id uuid)
returns void
language sql
set search_path = public
as $$
  update public.products p
     set stock = p.stock + x.qty,
         sales_count = greatest(p.sales_count - x.qty, 0)
    from (select product_id, sum(quantity)::integer as qty
            from public.order_items
           where order_id = p_order_id
           group by product_id) x
   where p.id = x.product_id;
$$;

-- Customer cancellation: ownership + state check, status history and stock restore in one transaction.
create or replace function public.cancel_order(p_user_id uuid, p_order_id uuid, p_reason text)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_reason text := coalesce(nullif(btrim(p_reason), ''), 'Cancelled by customer');
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception using message = 'Order not found', errcode = 'P0001', hint = '404';
  end if;
  if v_order.user_id <> p_user_id then
    raise exception using message = 'Not authorized', errcode = 'P0001', hint = '403';
  end if;
  if not public.order_can_transition(v_order.order_status, 'cancelled') then
    raise exception using message = 'Order cannot be cancelled at this stage', errcode = 'P0001', hint = '400';
  end if;

  update public.orders
     set order_status = 'cancelled', cancelled_at = now(), cancel_reason = v_reason
   where id = p_order_id;
  insert into public.order_status_history (order_id, status, note) values (p_order_id, 'cancelled', v_reason);
  perform public.restock_order_items(p_order_id);
end;
$$;

-- Admin status update with transition validation.
create or replace function public.update_order_status(p_order_id uuid, p_status text, p_note text)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_cod_delivered boolean;
begin
  if p_status is null or p_status not in ('pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled') then
    raise exception using message = 'Invalid order status', errcode = 'P0001', hint = '400';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception using message = 'Order not found', errcode = 'P0001', hint = '404';
  end if;
  if p_status <> v_order.order_status and not public.order_can_transition(v_order.order_status, p_status) then
    raise exception using message = format('Invalid status transition from %s to %s', v_order.order_status, p_status),
                          errcode = 'P0001', hint = '400';
  end if;

  v_cod_delivered := p_status = 'delivered' and v_order.payment_method = 'cod';

  update public.orders
     set order_status   = p_status,
         delivered_at   = case when p_status = 'delivered' then now() else delivered_at end,
         payment_status = case when v_cod_delivered then 'paid' else payment_status end,
         is_paid        = case when v_cod_delivered then true else is_paid end,
         paid_at        = case when v_cod_delivered then now() else paid_at end,
         cancelled_at   = case when p_status = 'cancelled' and v_order.order_status <> 'cancelled' then now() else cancelled_at end,
         cancel_reason  = case when p_status = 'cancelled' and v_order.order_status <> 'cancelled'
                               then coalesce(nullif(btrim(p_note), ''), 'Cancelled by admin') else cancel_reason end
   where id = p_order_id;

  insert into public.order_status_history (order_id, status, note)
  values (p_order_id, p_status, coalesce(nullif(btrim(p_note), ''), 'Status updated to ' || p_status));

  if p_status = 'cancelled' and v_order.order_status <> 'cancelled' then
    perform public.restock_order_items(p_order_id);
  end if;
end;
$$;

-- Admin dashboard metrics (replaces the Mongo aggregation pipelines).
create or replace function public.admin_dashboard()
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'totalOrders',    (select count(*) from public.orders),
    'totalCustomers', (select count(*) from public.profiles where role = 'customer'),
    'totalProducts',  (select count(*) from public.products where is_active),
    'pendingOrders',  (select count(*) from public.orders where order_status = 'pending'),
    'totalRevenue',   (select coalesce(sum(total), 0) from public.orders where order_status <> 'cancelled'),
    'lowStockProducts', (
      select coalesce(jsonb_agg(jsonb_build_object('_id', id, 'name', name, 'sku', sku, 'stock', stock, 'price', price)
                                order by stock, name), '[]'::jsonb)
        from (select id, name, sku, stock, price
                from public.products
               where is_active and stock <= 5
               order by stock, name
               limit 10) s
    ),
    'ordersOverTime', (
      select coalesce(jsonb_agg(jsonb_build_object('_id', day, 'orders', orders, 'revenue', revenue) order by day), '[]'::jsonb)
        from (select to_char(created_at at time zone 'UTC', 'YYYY-MM-DD') as day,
                     count(*) as orders,
                     sum(total) as revenue
                from public.orders
               where created_at >= now() - interval '30 days'
                 and order_status <> 'cancelled'
               group by 1) d
    ),
    'categoryPerformance', (
      select coalesce(jsonb_agg(jsonb_build_object('_id', category, 'revenue', revenue, 'units', units) order by revenue desc), '[]'::jsonb)
        from (select c.name as category,
                     sum(oi.price * oi.quantity) as revenue,
                     sum(oi.quantity) as units
                from public.order_items oi
                join public.orders o on o.id = oi.order_id
                join public.products p on p.id = oi.product_id
                join public.categories c on c.id = p.category_id
               where o.order_status <> 'cancelled'
               group by c.name) cp
    ),
    'topProducts', (
      select coalesce(jsonb_agg(jsonb_build_object('_id', id, 'name', name, 'salesCount', sales_count, 'price', price)
                                order by sales_count desc, name), '[]'::jsonb)
        from (select id, name, sales_count, price
                from public.products
               where is_active
               order by sales_count desc, name
               limit 8) tp
    )
  );
$$;
