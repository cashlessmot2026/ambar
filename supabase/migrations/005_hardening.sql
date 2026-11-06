-- Ámbar PWA: endurecimiento tras la revisión final.
-- 1) Varios dispositivos por cliente (tokens propios) y no permitir apropiarse de una tarjeta con otro nombre.
-- 2) Los pedidos guardan los datos de entrega del momento.
-- 3) Bloqueo de intentos de login admin (fuerza bruta).

-- ───────────── 1) Tokens por dispositivo ─────────────
create table if not exists customer_tokens (
  token_hash bytea primary key,
  customer_id uuid not null references customers(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists customer_tokens_customer_idx on customer_tokens (customer_id);
alter table customer_tokens enable row level security;
revoke all on table customer_tokens from anon, authenticated;

insert into customer_tokens (token_hash, customer_id)
select token_hash, id from customers where token_hash is not null
on conflict do nothing;

create or replace function _norm_name(p text) returns text
language sql immutable as $$
  select lower(translate(btrim(regexp_replace(coalesce(p, ''), '\s+', ' ', 'g')), 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun'))
$$;

create or replace function _customer(p_token text) returns customers
language plpgsql security definer set search_path = public, extensions as $$
declare c customers;
begin
  if p_token is null or length(p_token) < 32 then raise exception 'invalid_token'; end if;
  select cu.* into c from customer_tokens t join customers cu on cu.id = t.customer_id
  where t.token_hash = _hash_token(p_token);
  if not found then raise exception 'invalid_token'; end if;
  return c;
end $$;

create or replace function register_customer(p_name text, p_address text, p_phone text, p_consent boolean) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_phone text := _normalize_phone(p_phone);
  v_name text := left(btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')), 80);
  v_address text := left(btrim(coalesce(p_address, '')), 200);
  v_token text := _new_token();
  c customers;
begin
  if p_consent is not true then raise exception 'consent_required'; end if;
  if length(v_name) < 2 then raise exception 'invalid_name'; end if;
  if length(v_address) < 3 then raise exception 'invalid_address'; end if;

  select * into c from customers where phone = v_phone for update;
  if found then
    -- Mismo teléfono solo recupera la tarjeta si el nombre coincide; así nadie se apropia de las estrellas de otro.
    if _norm_name(c.name) <> _norm_name(v_name) then raise exception 'phone_in_use'; end if;
    update customers set address = v_address, consent_at = now(), consent_version = 'v1-2026-11'
    where id = c.id returning * into c;
  else
    insert into customers (name, address, phone, consent_at, consent_version)
    values (v_name, v_address, v_phone, now(), 'v1-2026-11') returning * into c;
  end if;
  insert into customer_tokens (token_hash, customer_id) values (_hash_token(v_token), c.id);
  return jsonb_build_object('token', v_token, 'customer', _card(c));
end $$;

-- ───────────── 2) Datos de entrega en el pedido ─────────────
alter table orders add column if not exists customer_name text;
alter table orders add column if not exists customer_address text;
alter table orders add column if not exists customer_phone text;
update orders o set customer_name = c.name, customer_address = c.address, customer_phone = c.phone
from customers c where c.id = o.customer_id and o.customer_name is null;

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
  insert into orders (customer_id, items, total, notes, customer_name, customer_address, customer_phone)
  values (c.id, v_items, v_total, nullif(left(btrim(coalesce(p_notes, '')), 500), ''), c.name, c.address, c.phone)
  returning * into o;
  return jsonb_build_object('id', o.id, 'number', o.number, 'total', o.total, 'items', o.items,
                            'notes', o.notes, 'created_at', o.created_at);
end $$;

create or replace function admin_orders(p_token text, p_limit int) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform _admin_check(p_token);
  return coalesce((
    select jsonb_agg(x order by x->>'created_at' desc) from (
      select (to_jsonb(o) - 'customer_name' - 'customer_address' - 'customer_phone') || jsonb_build_object('customer', jsonb_build_object(
        'name', coalesce(o.customer_name, c.name),
        'phone', coalesce(o.customer_phone, c.phone),
        'address', coalesce(o.customer_address, c.address))) as x
      from orders o join customers c on c.id = o.customer_id
      order by o.created_at desc limit least(greatest(coalesce(p_limit, 100), 1), 500)) s), '[]'::jsonb);
end $$;

-- ───────────── 3) Bloqueo de intentos de login ─────────────
create table if not exists admin_login_attempts (
  id bigint generated always as identity primary key,
  ip text not null,
  at timestamptz not null default now()
);
create index if not exists admin_login_attempts_idx on admin_login_attempts (ip, at desc);
alter table admin_login_attempts enable row level security;
revoke all on table admin_login_attempts from anon, authenticated;

-- Devuelve el token de sesión, o NULL si la contraseña es incorrecta (no lanza error para que el
-- intento fallido quede guardado). Tras 5 fallos en 15 min desde la misma IP, o 30 en total, bloquea.
create or replace function admin_login(p_password text) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_ip text := coalesce(nullif(btrim(split_part(
    coalesce(current_setting('request.headers', true)::json->>'x-forwarded-for', ''), ',', 1)), ''), 'local');
  v_token text;
begin
  delete from admin_login_attempts where at < now() - interval '1 day';
  if (select count(*) from admin_login_attempts where ip = v_ip and at > now() - interval '15 minutes') >= 5
     or (select count(*) from admin_login_attempts where at > now() - interval '15 minutes') >= 30 then
    raise exception 'too_many_attempts';
  end if;
  if not exists (select 1 from admin_config where id = 1 and password_hash = extensions.crypt(coalesce(p_password, ''), password_hash)) then
    insert into admin_login_attempts (ip) values (v_ip);
    return null;
  end if;
  delete from admin_login_attempts where ip = v_ip;
  delete from admin_sessions where expires_at < now();
  v_token := _new_token();
  insert into admin_sessions (token_hash, expires_at) values (_hash_token(v_token), now() + interval '12 hours');
  return v_token;
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
