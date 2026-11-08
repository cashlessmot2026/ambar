-- Ámbar PWA: cuentas de cliente con PIN, historial de pedidos, edición de pedidos por el admin,
-- reservas, avisos en tiempo real y límite de uso del Mesero IA.
--
-- Seguridad: las tablas siguen sin políticas RLS (la llave pública no las lee). Todo pasa por RPC
-- SECURITY DEFINER que validan el token del cliente o del admin. El PIN se guarda con bcrypt y el login
-- se bloquea tras varios intentos fallidos, porque 4 dígitos solo son 10.000 combinaciones.

-- ───────────── 1) Cuenta del cliente ─────────────
alter table customers add column if not exists email text;
alter table customers add column if not exists birthday date;
alter table customers add column if not exists pin_hash text;
alter table customers add column if not exists lat double precision;
alter table customers add column if not exists lng double precision;
create unique index if not exists customers_email_key on customers (lower(email)) where email is not null;

create or replace function _card(c customers) returns jsonb
language sql stable set search_path = public as $$
  select jsonb_build_object(
    'id', c.id, 'name', c.name, 'address', c.address, 'phone', c.phone,
    'email', c.email, 'birthday', c.birthday, 'lat', c.lat, 'lng', c.lng, 'has_pin', c.pin_hash is not null,
    'stars', c.stars, 'pending_reward_id', c.pending_reward_id, 'created_at', c.created_at)
$$;

create or replace function _normalize_email(p text) returns text
language plpgsql immutable as $$
declare v text := lower(btrim(coalesce(p, '')));
begin
  if length(v) > 120 or v !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'invalid_email'; end if;
  return v;
end $$;

create or replace function _check_pin(p text) returns text
language plpgsql immutable as $$
begin
  if coalesce(p, '') !~ '^\d{4}$' then raise exception 'invalid_pin'; end if;
  return p;
end $$;

create or replace function _check_coords(p_lat double precision, p_lng double precision) returns boolean
language sql immutable as $$
  select p_lat is not null and p_lng is not null and p_lat between -90 and 90 and p_lng between -180 and 180
$$;

-- Registro con PIN. Si el teléfono ya existe sin PIN (clientes de la versión anterior) y el nombre coincide,
-- la cuenta se completa; si ya tiene PIN debe iniciar sesión.
create or replace function register_account(
  p_name text, p_email text, p_phone text, p_birthday date, p_address text, p_pin text, p_consent boolean,
  p_lat double precision default null, p_lng double precision default null
) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_phone text := _normalize_phone(p_phone);
  v_email text := _normalize_email(p_email);
  v_name text := left(btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')), 80);
  v_address text := left(btrim(coalesce(p_address, '')), 200);
  v_pin text := _check_pin(p_pin);
  v_gps boolean := _check_coords(p_lat, p_lng);
  v_token text := _new_token();
  c customers;
begin
  if p_consent is not true then raise exception 'consent_required'; end if;
  if length(v_name) < 2 then raise exception 'invalid_name'; end if;
  if length(v_address) < 3 then raise exception 'invalid_address'; end if;
  if p_birthday is null or p_birthday > current_date or p_birthday < date '1900-01-01' then raise exception 'invalid_birthday'; end if;

  select * into c from customers where phone = v_phone for update;
  if found then
    if c.pin_hash is not null then raise exception 'account_exists'; end if;
    if _norm_name(c.name) <> _norm_name(v_name) then raise exception 'phone_in_use'; end if;
  end if;
  if exists (select 1 from customers where lower(email) = v_email and (c.id is null or id <> c.id)) then
    raise exception 'email_in_use';
  end if;

  if c.id is not null then
    update customers set
      email = v_email, birthday = p_birthday, address = v_address,
      pin_hash = extensions.crypt(v_pin, extensions.gen_salt('bf')),
      lat = case when v_gps then p_lat else lat end, lng = case when v_gps then p_lng else lng end,
      consent_at = now(), consent_version = 'v2-2026-11'
    where id = c.id returning * into c;
  else
    insert into customers (name, address, phone, email, birthday, pin_hash, lat, lng, consent_at, consent_version)
    values (v_name, v_address, v_phone, v_email, p_birthday, extensions.crypt(v_pin, extensions.gen_salt('bf')),
            case when v_gps then p_lat end, case when v_gps then p_lng end, now(), 'v2-2026-11')
    returning * into c;
  end if;
  insert into customer_tokens (token_hash, customer_id) values (_hash_token(v_token), c.id);
  return jsonb_build_object('token', v_token, 'customer', _card(c));
end $$;

create table if not exists customer_login_attempts (
  id bigint generated always as identity primary key,
  ip text not null,
  login text not null,
  at timestamptz not null default now()
);
create index if not exists customer_login_attempts_idx on customer_login_attempts (login, at desc);
alter table customer_login_attempts enable row level security;
revoke all on table customer_login_attempts from anon, authenticated;

-- Login con correo o teléfono + PIN. Devuelve NULL si los datos no coinciden (así el intento fallido
-- queda guardado). 5 fallos en 15 min sobre la misma cuenta, o 20 desde la misma IP, bloquean.
create or replace function customer_login(p_login text, p_pin text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_ip text := coalesce(nullif(btrim(split_part(
    coalesce(current_setting('request.headers', true)::json->>'x-forwarded-for', ''), ',', 1)), ''), 'local');
  v_login text := lower(btrim(coalesce(p_login, '')));
  v_phone text;
  v_token text;
  c customers;
begin
  if v_login !~ '@' then
    v_phone := regexp_replace(v_login, '\D', '', 'g');
    if length(v_phone) = 12 and left(v_phone, 2) = '57' then v_phone := substr(v_phone, 3); end if;
    v_login := v_phone;
  end if;
  delete from customer_login_attempts where at < now() - interval '1 day';
  if (select count(*) from customer_login_attempts where login = v_login and at > now() - interval '15 minutes') >= 5
     or (select count(*) from customer_login_attempts where ip = v_ip and at > now() - interval '15 minutes') >= 20 then
    raise exception 'too_many_attempts';
  end if;

  if v_phone is null then
    select * into c from customers where lower(email) = v_login;
  else
    select * into c from customers where phone = v_phone;
  end if;
  if c.id is null or c.pin_hash is null or c.pin_hash <> extensions.crypt(coalesce(p_pin, ''), c.pin_hash) then
    insert into customer_login_attempts (ip, login) values (v_ip, v_login);
    return null;
  end if;

  delete from customer_login_attempts where login = v_login;
  v_token := _new_token();
  insert into customer_tokens (token_hash, customer_id) values (_hash_token(v_token), c.id);
  return jsonb_build_object('token', v_token, 'customer', _card(c));
end $$;

create or replace function customer_logout(p_token text) returns void
language sql security definer set search_path = public, extensions as $$
  delete from customer_tokens where token_hash = _hash_token(p_token)
$$;

-- Edita los datos del perfil. El teléfono no cambia (es la identidad de la Tarjeta Ámbar).
-- p_gps: 'keep' deja la ubicación, 'set' guarda p_lat/p_lng, 'clear' la borra.
create or replace function update_my_profile(
  p_token text, p_name text, p_email text, p_address text, p_birthday date,
  p_gps text default 'keep', p_lat double precision default null, p_lng double precision default null
) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  c customers := _customer(p_token);
  v_email text := _normalize_email(p_email);
  v_name text := left(btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')), 80);
  v_address text := left(btrim(coalesce(p_address, '')), 200);
begin
  if length(v_name) < 2 then raise exception 'invalid_name'; end if;
  if length(v_address) < 3 then raise exception 'invalid_address'; end if;
  if p_birthday is not null and (p_birthday > current_date or p_birthday < date '1900-01-01') then raise exception 'invalid_birthday'; end if;
  if exists (select 1 from customers where lower(email) = v_email and id <> c.id) then raise exception 'email_in_use'; end if;
  if p_gps = 'set' and not _check_coords(p_lat, p_lng) then raise exception 'invalid_location'; end if;
  update customers set
    name = v_name, email = v_email, address = v_address, birthday = coalesce(p_birthday, birthday),
    lat = case p_gps when 'set' then p_lat when 'clear' then null else lat end,
    lng = case p_gps when 'set' then p_lng when 'clear' then null else lng end
  where id = c.id returning * into c;
  return _card(c);
end $$;

-- Crea o cambia el PIN. Si ya hay uno, hay que dar el actual.
create or replace function set_my_pin(p_token text, p_old text, p_new text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare c customers := _customer(p_token);
begin
  perform _check_pin(p_new);
  if c.pin_hash is not null and c.pin_hash <> extensions.crypt(coalesce(p_old, ''), c.pin_hash) then
    perform pg_sleep(1);
    raise exception 'invalid_pin_old';
  end if;
  update customers set pin_hash = extensions.crypt(p_new, extensions.gen_salt('bf')) where id = c.id returning * into c;
  -- Cierra las otras sesiones de este cliente.
  delete from customer_tokens where customer_id = c.id and token_hash <> _hash_token(p_token);
  return _card(c);
end $$;

-- ───────────── 2) Pedidos: ubicación, estados, historial y edición ─────────────
alter table orders add column if not exists lat double precision;
alter table orders add column if not exists lng double precision;
alter table orders add column if not exists updated_at timestamptz not null default now();
alter table orders drop constraint if exists orders_status_check;
alter table orders add constraint orders_status_check
  check (status in ('nuevo', 'preparando', 'en_camino', 'entregado', 'cancelado'));
create index if not exists orders_customer_idx on orders (customer_id, created_at desc);

create or replace function _order_json(o orders) returns jsonb
language sql stable set search_path = public as $$
  select jsonb_build_object('id', o.id, 'number', o.number, 'total', o.total, 'items', o.items, 'notes', o.notes,
    'status', o.status, 'lat', o.lat, 'lng', o.lng, 'created_at', o.created_at, 'updated_at', o.updated_at)
$$;

drop function if exists place_order(text, jsonb, text);
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
  insert into orders (customer_id, items, total, notes, customer_name, customer_address, customer_phone, lat, lng)
  values (c.id, v_items, v_total, nullif(left(btrim(coalesce(p_notes, '')), 500), ''), c.name, c.address, c.phone,
          case when v_gps then p_lat end, case when v_gps then p_lng end)
  returning * into o;
  return _order_json(o);
end $$;

create or replace function my_orders(p_token text, p_limit int default 30) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare c customers := _customer(p_token);
begin
  return coalesce((select jsonb_agg(_order_json(o) order by o.created_at desc)
    from (select * from orders where customer_id = c.id order by created_at desc
          limit least(greatest(coalesce(p_limit, 30), 1), 100)) o), '[]'::jsonb);
end $$;

create or replace function admin_orders(p_token text, p_limit int) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform _admin_check(p_token);
  return coalesce((
    select jsonb_agg(x order by x->>'created_at' desc) from (
      select _order_json(o) || jsonb_build_object('customer', jsonb_build_object(
        'name', coalesce(o.customer_name, c.name),
        'phone', coalesce(o.customer_phone, c.phone),
        'address', coalesce(o.customer_address, c.address),
        'email', c.email)) as x
      from orders o join customers c on c.id = o.customer_id
      order by o.created_at desc limit least(greatest(coalesce(p_limit, 100), 1), 500)) s), '[]'::jsonb);
end $$;

create or replace function admin_set_order_status(p_token text, p_id uuid, p_status text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform _admin_check(p_token);
  if p_status not in ('nuevo', 'preparando', 'en_camino', 'entregado', 'cancelado') then raise exception 'invalid_status'; end if;
  update orders set status = p_status, updated_at = now() where id = p_id;
end $$;

-- El admin reemplaza las líneas del pedido (cantidades, quitar o agregar platos) y las notas.
create or replace function admin_update_order(p_token text, p_id uuid, p_items jsonb, p_notes text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  it jsonb;
  v_qty int;
  v_price int;
  v_name text;
  v_items jsonb := '[]'::jsonb;
  v_total int := 0;
  o orders;
begin
  perform _admin_check(p_token);
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'empty_order'; end if;
  if jsonb_array_length(p_items) > 60 then raise exception 'too_many_items'; end if;
  for it in select * from jsonb_array_elements(p_items) loop
    v_qty := (it->>'qty')::int;
    v_price := (it->>'price')::int;
    v_name := left(btrim(coalesce(it->>'name', '')), 120);
    if v_qty is null or v_qty < 1 or v_qty > 50 then raise exception 'invalid_qty'; end if;
    if v_price is null or v_price < 0 or v_name = '' then raise exception 'invalid_item'; end if;
    v_items := v_items || jsonb_build_object('product_id', it->>'product_id', 'name', v_name, 'qty', v_qty, 'price', v_price);
    v_total := v_total + v_price * v_qty;
  end loop;
  update orders set items = v_items, total = v_total,
    notes = nullif(left(btrim(coalesce(p_notes, '')), 500), ''), updated_at = now()
  where id = p_id returning * into o;
  if not found then raise exception 'not_found'; end if;
  return _order_json(o);
end $$;

create or replace function admin_delete_order(p_token text, p_id uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform _admin_check(p_token);
  delete from orders where id = p_id;
end $$;

-- ───────────── 3) Reservas ─────────────
create table if not exists reservations (
  id uuid primary key default gen_random_uuid(),
  number int generated always as identity,
  customer_id uuid references customers(id) on delete set null,
  name text not null,
  phone text not null,
  email text not null,
  reserved_at timestamptz not null,
  people int not null check (people between 1 and 50),
  babies boolean not null default false,
  notes text,
  dishes jsonb not null default '[]'::jsonb,
  dishes_total int not null default 0,
  status text not null default 'pendiente'
    check (status in ('pendiente', 'confirmada', 'rechazada', 'cancelada', 'completada')),
  access_hash bytea,
  email_received_at timestamptz,
  email_confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists reservations_at_idx on reservations (reserved_at desc);
create index if not exists reservations_phone_idx on reservations (phone, created_at desc);
alter table reservations enable row level security;
revoke all on table reservations from anon, authenticated;

create or replace function _reservation_json(r reservations) returns jsonb
language sql stable set search_path = public as $$
  select jsonb_build_object('id', r.id, 'number', r.number, 'name', r.name, 'phone', r.phone, 'email', r.email,
    'reserved_at', r.reserved_at, 'people', r.people, 'babies', r.babies, 'notes', r.notes,
    'dishes', r.dishes, 'dishes_total', r.dishes_total, 'status', r.status,
    'email_received_at', r.email_received_at, 'email_confirmed_at', r.email_confirmed_at,
    'created_at', r.created_at, 'updated_at', r.updated_at)
$$;

-- Pública. Si el cliente tiene sesión (p_token) la reserva queda en su perfil. Devuelve una llave para
-- adjuntar los platos y pedir el correo de "reserva recibida".
create or replace function create_reservation(
  p_name text, p_phone text, p_email text, p_reserved_at timestamptz, p_people int, p_babies boolean,
  p_notes text default null, p_token text default null
) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_phone text := _normalize_phone(p_phone);
  v_email text := _normalize_email(p_email);
  v_name text := left(btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')), 80);
  v_key text := _new_token();
  v_customer uuid;
  r reservations;
begin
  if length(v_name) < 2 then raise exception 'invalid_name'; end if;
  if p_reserved_at is null or p_reserved_at < now() - interval '10 minutes' or p_reserved_at > now() + interval '180 days' then
    raise exception 'invalid_datetime';
  end if;
  if p_people is null or p_people < 1 or p_people > 50 then raise exception 'invalid_people'; end if;
  if p_babies is null then raise exception 'invalid_babies'; end if;
  if (select count(*) from reservations where phone = v_phone and created_at > now() - interval '1 hour') >= 3
     or (select count(*) from reservations where created_at > now() - interval '1 minute') >= 30 then
    raise exception 'too_many_attempts';
  end if;
  if p_token is not null and length(p_token) >= 32 then
    select customer_id into v_customer from customer_tokens where token_hash = _hash_token(p_token);
  end if;
  insert into reservations (customer_id, name, phone, email, reserved_at, people, babies, notes, access_hash)
  values (v_customer, v_name, v_phone, v_email, p_reserved_at, p_people, p_babies,
          nullif(left(btrim(coalesce(p_notes, '')), 500), ''), _hash_token(v_key))
  returning * into r;
  return jsonb_build_object('reservation', _reservation_json(r), 'key', v_key);
end $$;

-- Adjunta (o reemplaza) los platos elegidos a una reserva, con la llave que devolvió create_reservation.
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
    select * into p from products where id = (it->>'product_id')::uuid and active;
    if not found then raise exception 'product_unavailable'; end if;
    v_items := v_items || jsonb_build_object('product_id', p.id, 'name', p.name, 'qty', v_qty, 'price', p.price);
    v_total := v_total + p.price * v_qty;
  end loop;
  update reservations set dishes = v_items, dishes_total = v_total, updated_at = now() where id = r.id returning * into r;
  return _reservation_json(r);
end $$;

create or replace function my_reservations(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare c customers := _customer(p_token);
begin
  return coalesce((select jsonb_agg(_reservation_json(r) order by r.reserved_at desc)
    from (select * from reservations where customer_id = c.id or phone = c.phone
          order by reserved_at desc limit 30) r), '[]'::jsonb);
end $$;

create or replace function admin_reservations(p_token text, p_limit int default 300) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform _admin_check(p_token);
  return coalesce((select jsonb_agg(_reservation_json(r) order by r.reserved_at desc)
    from (select * from reservations order by reserved_at desc
          limit least(greatest(coalesce(p_limit, 300), 1), 1000)) r), '[]'::jsonb);
end $$;

-- Edición parcial: solo se cambian las claves presentes en p_row.
create or replace function admin_update_reservation(p_token text, p_id uuid, p_row jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare r reservations;
begin
  perform _admin_check(p_token);
  select * into r from reservations where id = p_id for update;
  if not found then raise exception 'not_found'; end if;
  if p_row ? 'name' then
    r.name := left(btrim(coalesce(p_row->>'name', '')), 80);
    if length(r.name) < 2 then raise exception 'invalid_name'; end if;
  end if;
  if p_row ? 'phone' then r.phone := _normalize_phone(p_row->>'phone'); end if;
  if p_row ? 'email' then r.email := _normalize_email(p_row->>'email'); end if;
  if p_row ? 'reserved_at' then
    r.reserved_at := (p_row->>'reserved_at')::timestamptz;
    if r.reserved_at is null then raise exception 'invalid_datetime'; end if;
  end if;
  if p_row ? 'people' then
    r.people := (p_row->>'people')::int;
    if r.people is null or r.people < 1 or r.people > 50 then raise exception 'invalid_people'; end if;
  end if;
  if p_row ? 'babies' then r.babies := coalesce((p_row->>'babies')::boolean, false); end if;
  if p_row ? 'notes' then r.notes := nullif(left(btrim(coalesce(p_row->>'notes', '')), 500), ''); end if;
  if p_row ? 'status' then
    if p_row->>'status' not in ('pendiente', 'confirmada', 'rechazada', 'cancelada', 'completada') then
      raise exception 'invalid_status';
    end if;
    r.status := p_row->>'status';
  end if;
  update reservations set name = r.name, phone = r.phone, email = r.email, reserved_at = r.reserved_at,
    people = r.people, babies = r.babies, notes = r.notes, status = r.status, updated_at = now()
  where id = p_id returning * into r;
  return _reservation_json(r);
end $$;

create or replace function admin_delete_reservation(p_token text, p_id uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform _admin_check(p_token);
  delete from reservations where id = p_id;
end $$;

-- Solo para la Edge Function de correo (service_role). Autoriza con la llave de la reserva (correo
-- "recibida", una sola vez) o con la sesión admin (correo "confirmada", solo si está confirmada).
create or replace function _reservation_email_data(p_id uuid, p_kind text, p_key text, p_admin_token text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare r reservations;
begin
  select * into r from reservations where id = p_id;
  if not found then raise exception 'not_found'; end if;
  if p_kind = 'received' then
    if p_key is null or r.access_hash is distinct from _hash_token(p_key) then raise exception 'unauthorized'; end if;
    if r.email_received_at is not null then raise exception 'already_sent'; end if;
  elsif p_kind = 'confirmed' then
    if not admin_session_valid(p_admin_token) then raise exception 'unauthorized'; end if;
    if r.status <> 'confirmada' then raise exception 'not_confirmed'; end if;
  else
    raise exception 'invalid_kind';
  end if;
  return _reservation_json(r);
end $$;

create or replace function _reservation_email_sent(p_id uuid, p_kind text) returns void
language sql security definer set search_path = public as $$
  update reservations set
    email_received_at = case when p_kind = 'received' then now() else email_received_at end,
    email_confirmed_at = case when p_kind = 'confirmed' then now() else email_confirmed_at end
  where id = p_id
$$;

-- ───────────── 4) Avisos en tiempo real ─────────────
-- Difunde un "ping" sin datos personales por un canal público de Supabase Realtime. El panel y el perfil
-- del cliente, al recibirlo, vuelven a pedir los datos por RPC con su token. Si Realtime no está
-- disponible, el error se ignora (la app también consulta cada pocos segundos).
create or replace function _broadcast(p_topic text, p_event text, p_payload jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform realtime.send(p_payload, p_event, p_topic, false);
exception when others then
  null;
end $$;

create or replace function _notify_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_customer uuid;
begin
  if tg_op = 'DELETE' then
    v_id := old.id; v_customer := old.customer_id;
  else
    v_id := new.id; v_customer := new.customer_id;
  end if;
  perform _broadcast('ambar-admin', 'change', jsonb_build_object('table', tg_table_name, 'op', tg_op, 'id', v_id));
  if v_customer is not null then
    perform _broadcast('ambar-customer-' || v_customer, 'change', jsonb_build_object('table', tg_table_name, 'id', v_id));
  end if;
  return null;
end $$;

drop trigger if exists orders_notify on orders;
create trigger orders_notify after insert or update or delete on orders
  for each row execute function _notify_change();
drop trigger if exists reservations_notify on reservations;
create trigger reservations_notify after insert or update or delete on reservations
  for each row execute function _notify_change();

-- ───────────── 5) Límite de uso del Mesero IA ─────────────
create table if not exists ai_usage (
  id bigint generated always as identity primary key,
  ip text not null,
  at timestamptz not null default now()
);
create index if not exists ai_usage_idx on ai_usage (ip, at desc);
alter table ai_usage enable row level security;
revoke all on table ai_usage from anon, authenticated;

-- Solo service_role (Edge Function). 20 mensajes cada 10 min por IP y 600 por hora en total.
create or replace function _ai_allow(p_ip text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  delete from ai_usage where at < now() - interval '1 day';
  if (select count(*) from ai_usage where ip = p_ip and at > now() - interval '10 minutes') >= 20
     or (select count(*) from ai_usage where at > now() - interval '1 hour') >= 600 then
    return false;
  end if;
  insert into ai_usage (ip) values (coalesce(p_ip, 'unknown'));
  return true;
end $$;

-- ───────────── Permisos ─────────────
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  get_public_data(), register_customer(text, text, text, boolean), get_my_card(text),
  place_order(text, jsonb, text, double precision, double precision), arm_redeem(text, uuid), claim_star(text, text),
  admin_session_valid(text), admin_login(text), admin_logout(text), admin_get(text),
  admin_orders(text, int), admin_set_order_status(text, uuid, text), admin_customers(text),
  admin_adjust_stars(text, uuid, int), admin_upsert(text, text, jsonb), admin_delete(text, text, uuid),
  admin_save_settings(text, jsonb), admin_change_password(text, text, text), admin_set_ordering(text, boolean),
  submit_survey(jsonb, text), admin_set_survey(text, jsonb), admin_survey_results(text, int),
  register_account(text, text, text, date, text, text, boolean, double precision, double precision),
  customer_login(text, text), customer_logout(text),
  update_my_profile(text, text, text, text, date, text, double precision, double precision),
  set_my_pin(text, text, text), my_orders(text, int),
  admin_update_order(text, uuid, jsonb, text), admin_delete_order(text, uuid),
  create_reservation(text, text, text, timestamptz, int, boolean, text, text),
  reservation_set_dishes(uuid, text, jsonb), my_reservations(text),
  admin_reservations(text, int), admin_update_reservation(text, uuid, jsonb), admin_delete_reservation(text, uuid)
to anon, authenticated;

grant execute on function
  _reservation_email_data(uuid, text, text, text), _reservation_email_sent(uuid, text), _ai_allow(text),
  get_public_data(), admin_session_valid(text)
to service_role;
