-- Ámbar PWA: funciones RPC. Todas SECURITY DEFINER con search_path fijo.

-- ───────────── Helpers internos (no expuestos a anon) ─────────────
create or replace function _hash_token(p_token text) returns bytea
language sql immutable set search_path = public, extensions as $$
  select extensions.digest(coalesce(p_token, ''), 'sha256')
$$;

create or replace function _new_token() returns text
language sql volatile set search_path = public, extensions as $$
  select encode(extensions.gen_random_bytes(32), 'hex')
$$;

create or replace function _customer(p_token text) returns customers
language plpgsql security definer set search_path = public, extensions as $$
declare c customers;
begin
  select * into c from customers where token_hash = _hash_token(p_token);
  if not found or p_token is null or length(p_token) < 32 then
    raise exception 'invalid_token';
  end if;
  return c;
end $$;

create or replace function _card(c customers) returns jsonb
language sql stable set search_path = public as $$
  select jsonb_build_object(
    'id', c.id, 'name', c.name, 'address', c.address, 'phone', c.phone,
    'stars', c.stars, 'pending_reward_id', c.pending_reward_id, 'created_at', c.created_at)
$$;

create or replace function _normalize_phone(p text) returns text
language plpgsql immutable as $$
declare d text := regexp_replace(coalesce(p, ''), '\D', '', 'g');
begin
  if length(d) = 12 and left(d, 2) = '57' then d := substr(d, 3); end if;
  if length(d) <> 10 then raise exception 'invalid_phone'; end if;
  return d;
end $$;

-- ───────────── Públicas ─────────────
create or replace function get_public_data() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'settings', (select data from settings where id = 1),
    'menus', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id, 'slug', m.slug, 'name', m.name, 'subtitle', m.subtitle,
        'start_time', to_char(m.start_time, 'HH24:MI'), 'end_time', to_char(m.end_time, 'HH24:MI'), 'sort', m.sort,
        'categories', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', c.id, 'name', c.name, 'image', c.image, 'sort', c.sort,
            'products', coalesce((
              select jsonb_agg(jsonb_build_object(
                'id', p.id, 'name', p.name, 'description', p.description, 'price', p.price,
                'images', to_jsonb(p.images), 'featured', p.featured, 'sort', p.sort) order by p.sort, p.name)
              from products p where p.category_id = c.id and p.active), '[]'::jsonb)
          ) order by c.sort, c.name)
          from categories c where c.menu_id = m.id), '[]'::jsonb)
      ) order by m.sort)
      from menus m where m.active), '[]'::jsonb),
    'rewards', coalesce((
      select jsonb_agg(jsonb_build_object('id', r.id, 'name', r.name, 'description', r.description,
        'stars_required', r.stars_required, 'image', r.image) order by r.stars_required, r.sort)
      from rewards r where r.active), '[]'::jsonb)
  )
$$;

create or replace function register_customer(p_name text, p_address text, p_phone text, p_consent boolean) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_phone text := _normalize_phone(p_phone);
  v_name text := left(btrim(coalesce(p_name, '')), 80);
  v_address text := left(btrim(coalesce(p_address, '')), 200);
  v_token text := _new_token();
  c customers;
begin
  if p_consent is not true then raise exception 'consent_required'; end if;
  if length(v_name) < 2 then raise exception 'invalid_name'; end if;
  if length(v_address) < 3 then raise exception 'invalid_address'; end if;
  insert into customers (name, address, phone, consent_at, consent_version, token_hash)
  values (v_name, v_address, v_phone, now(), 'v1-2026-11', _hash_token(v_token))
  on conflict (phone) do update
    set name = excluded.name, address = excluded.address, consent_at = excluded.consent_at,
        consent_version = excluded.consent_version, token_hash = excluded.token_hash
  returning * into c;
  return jsonb_build_object('token', v_token, 'customer', _card(c));
end $$;

create or replace function get_my_card(p_token text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
begin
  return _card(_customer(p_token));
end $$;

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
  insert into orders (customer_id, items, total, notes)
  values (c.id, v_items, v_total, nullif(left(btrim(coalesce(p_notes, '')), 500), ''))
  returning * into o;
  return jsonb_build_object('id', o.id, 'number', o.number, 'total', o.total, 'items', o.items,
                            'notes', o.notes, 'created_at', o.created_at);
end $$;

create or replace function arm_redeem(p_token text, p_reward_id uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  c customers := _customer(p_token);
  r rewards;
begin
  if p_reward_id is not null then
    select * into r from rewards where id = p_reward_id and active;
    if not found then raise exception 'reward_unavailable'; end if;
    if c.stars < r.stars_required then raise exception 'not_enough_stars'; end if;
  end if;
  update customers set pending_reward_id = p_reward_id where id = c.id returning * into c;
  return _card(c);
end $$;

create or replace function claim_star(p_token text, p_key text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  c customers := _customer(p_token);
  r rewards;
begin
  if not exists (select 1 from admin_config where id = 1 and business_key = coalesce(p_key, '')) then
    raise exception 'invalid_key';
  end if;
  select * into c from customers where id = c.id for update;
  if c.pending_reward_id is not null then
    select * into r from rewards where id = c.pending_reward_id and active;
    if found and c.stars >= r.stars_required then
      insert into star_events (customer_id, kind, delta, reward_id, reward_name) values (c.id, 'redeem', -c.stars, r.id, r.name);
      update customers set stars = 0, pending_reward_id = null where id = c.id;
      return jsonb_build_object('action', 'redeem', 'stars', 0,
        'reward', jsonb_build_object('id', r.id, 'name', r.name, 'description', r.description));
    end if;
    update customers set pending_reward_id = null where id = c.id;
  end if;
  insert into star_events (customer_id, kind, delta) values (c.id, 'earn', 1);
  update customers set stars = stars + 1 where id = c.id returning * into c;
  return jsonb_build_object('action', 'earn', 'stars', c.stars);
end $$;

-- ───────────── Admin ─────────────
create or replace function admin_session_valid(p_token text) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select p_token is not null and length(p_token) >= 32 and exists (
    select 1 from admin_sessions where token_hash = _hash_token(p_token) and expires_at > now())
$$;

create or replace function _admin_check(p_token text) returns void
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if not admin_session_valid(p_token) then raise exception 'unauthorized'; end if;
end $$;

create or replace function admin_login(p_password text) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare v_token text;
begin
  if not exists (select 1 from admin_config where id = 1 and password_hash = extensions.crypt(coalesce(p_password, ''), password_hash)) then
    perform pg_sleep(1);
    raise exception 'invalid_password';
  end if;
  delete from admin_sessions where expires_at < now();
  v_token := _new_token();
  insert into admin_sessions (token_hash, expires_at) values (_hash_token(v_token), now() + interval '12 hours');
  return v_token;
end $$;

create or replace function admin_logout(p_token text) returns void
language sql security definer set search_path = public, extensions as $$
  delete from admin_sessions where token_hash = _hash_token(p_token)
$$;

create or replace function admin_get(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform _admin_check(p_token);
  return jsonb_build_object(
    'settings', (select data from settings where id = 1),
    'business_key', (select business_key from admin_config where id = 1),
    'menus', coalesce((select jsonb_agg(to_jsonb(m) || jsonb_build_object(
        'start_time', to_char(m.start_time, 'HH24:MI'), 'end_time', to_char(m.end_time, 'HH24:MI'),
        'categories', coalesce((select jsonb_agg(to_jsonb(c) || jsonb_build_object(
            'products', coalesce((select jsonb_agg(to_jsonb(p) order by p.sort, p.name) from products p where p.category_id = c.id), '[]'::jsonb))
          order by c.sort, c.name) from categories c where c.menu_id = m.id), '[]'::jsonb))
      order by m.sort) from menus m), '[]'::jsonb),
    'rewards', coalesce((select jsonb_agg(to_jsonb(r) order by r.stars_required, r.sort) from rewards r), '[]'::jsonb)
  );
end $$;

create or replace function admin_orders(p_token text, p_limit int) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform _admin_check(p_token);
  return coalesce((
    select jsonb_agg(x order by x->>'created_at' desc) from (
      select to_jsonb(o) || jsonb_build_object('customer', jsonb_build_object('name', c.name, 'phone', c.phone, 'address', c.address)) as x
      from orders o join customers c on c.id = o.customer_id
      order by o.created_at desc limit least(greatest(coalesce(p_limit, 100), 1), 500)) s), '[]'::jsonb);
end $$;

create or replace function admin_set_order_status(p_token text, p_id uuid, p_status text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform _admin_check(p_token);
  update orders set status = p_status where id = p_id;
end $$;

create or replace function admin_customers(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform _admin_check(p_token);
  return coalesce((select jsonb_agg(_card(c) || jsonb_build_object(
      'orders', (select count(*) from orders o where o.customer_id = c.id),
      'events', coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at desc) from (
          select kind, delta, reward_name, created_at from star_events where customer_id = c.id order by created_at desc limit 30) e), '[]'::jsonb))
    order by c.created_at desc) from customers c), '[]'::jsonb);
end $$;

create or replace function admin_adjust_stars(p_token text, p_customer uuid, p_delta int) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare c customers;
begin
  perform _admin_check(p_token);
  update customers set stars = greatest(0, stars + p_delta) where id = p_customer returning * into c;
  if not found then raise exception 'not_found'; end if;
  insert into star_events (customer_id, kind, delta) values (c.id, 'adjust', p_delta);
  return _card(c);
end $$;

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
    when 'menus' then '{"start_time":"00:00","end_time":"23:59","sort":0,"active":true}'::jsonb
    when 'categories' then '{"sort":0}'::jsonb
    when 'products' then '{"images":[],"active":true,"featured":false,"sort":0}'::jsonb
    when 'rewards' then '{"active":true,"sort":0}'::jsonb
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

create or replace function admin_delete(p_token text, p_table text, p_id uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform _admin_check(p_token);
  if p_table not in ('menus', 'categories', 'products', 'rewards') then raise exception 'invalid_table'; end if;
  execute format('delete from public.%I where id = $1', p_table) using p_id;
end $$;

create or replace function admin_save_settings(p_token text, p_data jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform _admin_check(p_token);
  if jsonb_typeof(p_data) <> 'object' then raise exception 'invalid_settings'; end if;
  update settings set data = p_data, updated_at = now() where id = 1;
  return p_data;
end $$;

create or replace function admin_change_password(p_token text, p_old text, p_new text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform _admin_check(p_token);
  if not exists (select 1 from admin_config where id = 1 and password_hash = extensions.crypt(coalesce(p_old, ''), password_hash)) then
    raise exception 'invalid_password';
  end if;
  if length(coalesce(p_new, '')) < 4 then raise exception 'password_too_short'; end if;
  update admin_config set password_hash = extensions.crypt(p_new, extensions.gen_salt('bf')) where id = 1;
  delete from admin_sessions where token_hash <> _hash_token(p_token);
end $$;

-- ───────────── Permisos ─────────────
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  get_public_data(), register_customer(text, text, text, boolean), get_my_card(text),
  place_order(text, jsonb, text), arm_redeem(text, uuid), claim_star(text, text),
  admin_session_valid(text), admin_login(text), admin_logout(text), admin_get(text),
  admin_orders(text, int), admin_set_order_status(text, uuid, text), admin_customers(text),
  admin_adjust_stars(text, uuid, int), admin_upsert(text, text, jsonb), admin_delete(text, text, uuid),
  admin_save_settings(text, jsonb), admin_change_password(text, text, text)
to anon, authenticated;
