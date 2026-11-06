-- Ámbar PWA: traducciones del contenido (columnas i18n) y modo solo menú (settings.data.ordering).
-- Las traducciones del menú se cargan aparte con 007_i18n_data.sql (generado por scripts/build_i18n_sql.mjs).

alter table menus add column if not exists i18n jsonb not null default '{}'::jsonb;
alter table categories add column if not exists i18n jsonb not null default '{}'::jsonb;
alter table products add column if not exists i18n jsonb not null default '{}'::jsonb;
alter table rewards add column if not exists i18n jsonb not null default '{}'::jsonb;

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
          from categories c where c.menu_id = m.id), '[]'::jsonb)
      ) order by m.sort)
      from menus m where m.active), '[]'::jsonb),
    'rewards', coalesce((
      select jsonb_agg(jsonb_build_object('id', r.id, 'name', r.name, 'description', r.description, 'i18n', r.i18n,
        'stars_required', r.stars_required, 'image', r.image) order by r.stars_required, r.sort)
      from rewards r where r.active), '[]'::jsonb)
  )
$$;

create or replace function _ordering_enabled() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select (data->'ordering'->>'enabled')::boolean from settings where id = 1), true)
$$;

create or replace function place_order(p_token text, p_items jsonb, p_notes text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  c customers := _customer(p_token);
  it jsonb;
  p products;
  v_qty int;
  v_items jsonb := '[]'::jsonb;
  v_total int := 0;
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
  insert into orders (customer_id, items, total, notes, customer_name, customer_address, customer_phone)
  values (c.id, v_items, v_total, nullif(left(btrim(coalesce(p_notes, '')), 500), ''), c.name, c.address, c.phone)
  returning * into o;
  return jsonb_build_object('id', o.id, 'number', o.number, 'total', o.total, 'items', o.items,
                            'notes', o.notes, 'created_at', o.created_at);
end $$;

create or replace function admin_set_ordering(p_token text, p_enabled boolean) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare v jsonb;
begin
  perform _admin_check(p_token);
  update settings
     set data = jsonb_set(data, '{ordering}', jsonb_build_object('enabled', coalesce(p_enabled, true)), true), updated_at = now()
   where id = 1
  returning data into v;
  return v;
end $$;

-- admin_upsert: valores por defecto incluyen i18n (columna NOT NULL nueva).
create or replace function admin_upsert(p_token text, p_table text, p_row jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_defaults jsonb;
  v_existing jsonb;
  v_merged jsonb;
  v_cols text;
  v_result jsonb;
begin
  perform _admin_check(p_token);
  v_defaults := case p_table
    when 'menus' then '{"start_time":"00:00","end_time":"23:59","sort":0,"active":true,"i18n":{}}'::jsonb
    when 'categories' then '{"sort":0,"i18n":{}}'::jsonb
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
    select string_agg(format('%I = r.%I', column_name, column_name), ', ') into v_cols
    from information_schema.columns
    where table_schema = 'public' and table_name = p_table and column_name <> 'id';
    execute format('update public.%I t set %s from jsonb_populate_record(null::public.%I, $1) r where t.id = r.id returning to_jsonb(t.*)',
                   p_table, v_cols, p_table) into v_result using v_merged;
  end if;
  return v_result;
end $$;

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  get_public_data(), register_customer(text, text, text, boolean), get_my_card(text),
  place_order(text, jsonb, text), arm_redeem(text, uuid), claim_star(text, text),
  admin_session_valid(text), admin_login(text), admin_logout(text), admin_get(text),
  admin_orders(text, int), admin_set_order_status(text, uuid, text), admin_customers(text),
  admin_adjust_stars(text, uuid, int), admin_upsert(text, text, jsonb), admin_delete(text, text, uuid),
  admin_save_settings(text, jsonb), admin_change_password(text, text, text), admin_set_ordering(text, boolean)
to anon, authenticated;
