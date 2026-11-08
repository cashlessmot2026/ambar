-- Cada pedido por la app (web o Mesero IA) suma 1 estrella a la Tarjeta Ámbar.
-- Si el admin cancela o elimina el pedido, la estrella se descuenta; si lo reactiva, se devuelve.
-- orders.star_awarded: NULL = pedido anterior a esta regla (no participa), true/false = estrella dada o retirada.

alter table orders add column if not exists star_awarded boolean;

-- Da (p_on = true) o quita (false) la estrella de un pedido. No hace nada si ya está en ese estado.
create or replace function _order_star(p_id uuid, p_on boolean) returns void
language plpgsql security definer set search_path = public as $$
declare v_customer uuid;
begin
  update orders set star_awarded = p_on
   where id = p_id and star_awarded is not null and star_awarded <> p_on
  returning customer_id into v_customer;
  if v_customer is null then return; end if;
  if p_on then
    insert into star_events (customer_id, kind, delta) values (v_customer, 'earn', 1);
    update customers set stars = stars + 1 where id = v_customer;
  else
    insert into star_events (customer_id, kind, delta) values (v_customer, 'adjust', -1);
    update customers set stars = greatest(0, stars - 1) where id = v_customer;
  end if;
end $$;

create or replace function place_order(
  p_token text, p_items jsonb, p_notes text, p_lat double precision default null, p_lng double precision default null
) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  c customers := _customer(p_token);
  v_gps boolean := _check_coords(p_lat, p_lng);
  it jsonb;
  p products;
  v_qty int;
  v_items jsonb := '[]'::jsonb;
  v_total int := 0;
  v_stars int;
  o orders;
begin
  if not _ordering_enabled() then raise exception 'ordering_disabled'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'empty_order'; end if;
  if jsonb_array_length(p_items) > 60 then raise exception 'too_many_items'; end if;
  for it in select * from jsonb_array_elements(p_items) loop
    v_qty := (it->>'qty')::int;
    if v_qty is null or v_qty < 1 or v_qty > 50 then raise exception 'invalid_qty'; end if;
    select * into p from products where id = (it->>'product_id')::uuid and active;
    if not found then raise exception 'product_unavailable'; end if;
    v_items := v_items || jsonb_build_object('product_id', p.id, 'name', p.name, 'qty', v_qty, 'price', p.price);
    v_total := v_total + p.price * v_qty;
  end loop;
  insert into orders (customer_id, items, total, notes, customer_name, customer_address, customer_phone, lat, lng, star_awarded)
  values (c.id, v_items, v_total, nullif(left(btrim(coalesce(p_notes, '')), 500), ''), c.name, c.address, c.phone,
          case when v_gps then p_lat end, case when v_gps then p_lng end, true)
  returning * into o;
  insert into star_events (customer_id, kind, delta) values (c.id, 'earn', 1);
  update customers set stars = stars + 1 where id = c.id returning stars into v_stars;
  return _order_json(o) || jsonb_build_object('star_awarded', true, 'stars', v_stars);
end $$;

create or replace function admin_set_order_status(p_token text, p_id uuid, p_status text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform _admin_check(p_token);
  if p_status not in ('nuevo', 'preparando', 'en_camino', 'entregado', 'cancelado') then raise exception 'invalid_status'; end if;
  update orders set status = p_status, updated_at = now() where id = p_id;
  perform _order_star(p_id, p_status <> 'cancelado');
end $$;

create or replace function admin_delete_order(p_token text, p_id uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform _admin_check(p_token);
  perform _order_star(p_id, false);
  delete from orders where id = p_id;
end $$;

revoke execute on function _order_star(uuid, boolean) from public, anon, authenticated;
grant execute on function
  place_order(text, jsonb, text, double precision, double precision),
  admin_set_order_status(text, uuid, text), admin_delete_order(text, uuid)
to anon, authenticated;
