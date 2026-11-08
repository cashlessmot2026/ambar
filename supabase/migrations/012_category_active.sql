-- Categorías suspendibles: una categoría suspendida (active = false) desaparece de la carta, del Mesero IA
-- y no se puede pedir ni pre-ordenar en reservas, sin borrar sus productos.

alter table categories add column if not exists active boolean not null default true;

-- Producto que se puede pedir: activo y en una categoría activa de un menú activo.
create or replace function _orderable_product(p_id uuid) returns products
language plpgsql stable security definer set search_path = public as $$
declare p products;
begin
  select pr.* into p from products pr
    join categories c on c.id = pr.category_id
    join menus m on m.id = c.menu_id
   where pr.id = p_id and pr.active and c.active and m.active;
  if not found then raise exception 'product_unavailable'; end if;
  return p;
end $$;

create or replace function get_public_data() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'settings', (select data from settings where id = 1),
    'menus', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id, 'slug', m.slug, 'name', m.name, 'subtitle', m.subtitle, 'i18n', m.i18n,
        'start_time', to_char(m.start_time, 'HH24:MI'), 'end_time', to_char(m.end_time, 'HH24:MI'), 'sort', m.sort,
        'categories', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', c.id, 'name', c.name, 'image', c.image, 'sort', c.sort, 'i18n', c.i18n,
            'products', coalesce((
              select jsonb_agg(jsonb_build_object(
                'id', p.id, 'name', p.name, 'description', p.description, 'price', p.price, 'i18n', p.i18n,
                'images', to_jsonb(p.images), 'featured', p.featured, 'sort', p.sort) order by p.sort, p.name)
              from products p where p.category_id = c.id and p.active), '[]'::jsonb)
          ) order by c.sort, c.name)
          from categories c where c.menu_id = m.id and c.active), '[]'::jsonb)
      ) order by m.sort)
      from menus m where m.active), '[]'::jsonb),
    'rewards', coalesce((
      select jsonb_agg(jsonb_build_object('id', r.id, 'name', r.name, 'description', r.description, 'i18n', r.i18n,
        'stars_required', r.stars_required, 'image', r.image) order by r.stars_required, r.sort)
      from rewards r where r.active), '[]'::jsonb)
  )
$$;

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
    p := _orderable_product((it->>'product_id')::uuid);
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

create or replace function reservation_set_dishes(p_id uuid, p_key text, p_items jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  r reservations;
  it jsonb;
  p products;
  v_qty int;
  v_items jsonb := '[]'::jsonb;
  v_total int := 0;
begin
  select * into r from reservations where id = p_id and access_hash = _hash_token(p_key) for update;
  if not found or p_key is null or length(p_key) < 32 then raise exception 'invalid_token'; end if;
  if r.status not in ('pendiente', 'confirmada') then raise exception 'reservation_closed'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'empty_order'; end if;
  if jsonb_array_length(p_items) > 60 then raise exception 'too_many_items'; end if;
  for it in select * from jsonb_array_elements(p_items) loop
    v_qty := (it->>'qty')::int;
    if v_qty is null or v_qty < 1 or v_qty > 50 then raise exception 'invalid_qty'; end if;
    p := _orderable_product((it->>'product_id')::uuid);
    v_items := v_items || jsonb_build_object('product_id', p.id, 'name', p.name, 'qty', v_qty, 'price', p.price);
    v_total := v_total + p.price * v_qty;
  end loop;
  update reservations set dishes = v_items, dishes_total = v_total, updated_at = now() where id = r.id returning * into r;
  return _reservation_json(r);
end $$;

-- admin_upsert: las categorías nuevas nacen activas (la columna es NOT NULL).
create or replace function admin_upsert(p_token text, p_table text, p_row jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_defaults jsonb;
  v_existing jsonb;
  v_merged jsonb;
  v_cols text;
  v_result jsonb;
  v_i18n jsonb;
begin
  perform _admin_check(p_token);
  v_defaults := case p_table
    when 'menus' then '{"start_time":"00:00","end_time":"23:59","sort":0,"active":true,"i18n":{}}'::jsonb
    when 'categories' then '{"sort":0,"active":true,"i18n":{}}'::jsonb
    when 'products' then '{"images":[],"active":true,"featured":false,"sort":0,"i18n":{}}'::jsonb
    when 'rewards' then '{"active":true,"sort":0,"i18n":{}}'::jsonb
  end;
  if v_defaults is null then raise exception 'invalid_table'; end if;

  if p_row ? 'id' and p_row->>'id' is not null then
    execute format('select to_jsonb(t) from public.%I t where id = $1', p_table) into v_existing using (p_row->>'id')::uuid;
  end if;

  if v_existing is null then
    v_merged := v_defaults || jsonb_build_object('id', coalesce(p_row->>'id', gen_random_uuid()::text)) || (p_row - 'id');
    if p_table = 'menus' and coalesce(v_merged->>'slug', '') = '' then
      v_merged := v_merged || jsonb_build_object('slug', 'menu-' || left(md5(random()::text), 8));
    end if;
    execute format('insert into public.%I select * from jsonb_populate_record(null::public.%I, $1) returning to_jsonb(%I.*)',
                   p_table, p_table, p_table) into v_result using v_merged;
  else
    v_merged := v_existing || (p_row - 'id');
    if p_row ? 'i18n' and jsonb_typeof(p_row->'i18n') = 'object' then
      select coalesce(jsonb_object_agg(k,
               coalesce(v_existing->'i18n'->k, '{}'::jsonb) || coalesce(p_row->'i18n'->k, '{}'::jsonb)), '{}'::jsonb)
        into v_i18n
        from (select jsonb_object_keys(coalesce(v_existing->'i18n', '{}'::jsonb) || (p_row->'i18n')) as k) s;
      v_merged := v_merged || jsonb_build_object('i18n', v_i18n);
    end if;
    select string_agg(format('%I = r.%I', column_name, column_name), ', ') into v_cols
    from information_schema.columns
    where table_schema = 'public' and table_name = p_table and column_name <> 'id';
    execute format('update public.%I t set %s from jsonb_populate_record(null::public.%I, $1) r where t.id = r.id returning to_jsonb(t.*)',
                   p_table, v_cols, p_table) into v_result using v_merged;
  end if;
  return v_result;
end $$;

revoke execute on function _orderable_product(uuid) from public, anon, authenticated;
grant execute on function
  get_public_data(), place_order(text, jsonb, text, double precision, double precision),
  reservation_set_dishes(uuid, text, jsonb), admin_upsert(text, text, jsonb)
to anon, authenticated;
grant execute on function get_public_data() to service_role;
