-- Pruebas de las RPC. Todo se revierte: el bloque termina lanzando ALL_TESTS_PASSED.
-- Ejecutar: node scripts/db.mjs supabase/tests/rpc_test.sql --expect-error ALL_TESTS_PASSED
do $$
declare
  r jsonb;
  tok text;
  tok2 text;
  cid uuid;
  menu_id uuid;
  cat_id uuid;
  p_ok uuid;
  p_off uuid;
  rw uuid;
  bkey text;
  adm text;
  failed boolean;
  i int;
  t text;
begin
  -- Datos de prueba
  insert into menus (slug, name, start_time, end_time, sort) values ('t_menu', 'T', '04:00', '10:59', 99) returning id into menu_id;
  insert into categories (menu_id, name, sort) values (menu_id, 'T cat', 1) returning id into cat_id;
  insert into products (category_id, name, price, active) values (cat_id, 'T prod', 10000, true) returning id into p_ok;
  insert into products (category_id, name, price, active) values (cat_id, 'T off', 5000, false) returning id into p_off;
  insert into rewards (name, stars_required, active) values ('T premio', 2, true) returning id into rw;
  select business_key into bkey from admin_config where id = 1;

  -- Datos públicos
  r := get_public_data();
  if r->'settings' is null or jsonb_typeof(r->'menus') <> 'array' then raise exception 'get_public_data shape'; end if;
  if r::text like '%T off%' then raise exception 'get_public_data expone productos inactivos'; end if;

  -- Traducciones: el producto expone su i18n
  update products set i18n = '{"en":{"name":"T product EN"}}' where id = p_ok;
  update settings set data = data - 'ordering' where id = 1;
  r := get_public_data();
  if not (r::text like '%T product EN%') then raise exception 'get_public_data no expone i18n del producto'; end if;

  -- Registro sin consentimiento falla
  failed := false;
  begin perform register_customer('Ana', 'Calle 1', '3001112233', false); exception when others then failed := true; end;
  if not failed then raise exception 'registro sin consentimiento debió fallar'; end if;

  -- Teléfono inválido falla
  failed := false;
  begin perform register_customer('Ana', 'Calle 1', '123', true); exception when others then failed := true; end;
  if not failed then raise exception 'telefono invalido debió fallar'; end if;

  -- Registro y re-registro con el mismo teléfono = mismo cliente
  r := register_customer('Ana', 'Calle 1', '300 111 2233', true);
  tok := r->>'token';
  cid := (r->'customer'->>'id')::uuid;
  -- Mismo nombre (mayúsculas/espacios distintos) recupera la tarjeta y actualiza la dirección
  r := register_customer('  ana ', 'Calle 2', '3001112233', true);
  tok2 := r->>'token';
  if (r->'customer'->>'id')::uuid <> cid then raise exception 're-registro creó otro cliente'; end if;
  if (get_my_card(tok2)->>'address') <> 'Calle 2' then raise exception 're-registro no actualizó dirección'; end if;
  -- Varios dispositivos: el token anterior sigue siendo válido
  if (get_my_card(tok)->>'id')::uuid <> cid then raise exception 'el token del otro dispositivo dejó de funcionar'; end if;
  -- Otro nombre con el mismo teléfono: no puede apropiarse de la tarjeta
  failed := false;
  begin perform register_customer('Intruso', 'Calle X', '3001112233', true); exception when others then failed := sqlerrm = 'phone_in_use'; end;
  if not failed then raise exception 'registro con otro nombre debió dar phone_in_use'; end if;
  if (get_my_card(tok2)->>'name') <> 'Ana' then raise exception 'el intruso cambió el nombre'; end if;

  -- Token inválido
  failed := false;
  begin perform get_my_card('nope'); exception when others then failed := sqlerrm = 'invalid_token'; end;
  if not failed then raise exception 'token invalido debió dar invalid_token'; end if;

  -- Pedido: precio del servidor, producto inactivo rechazado
  r := place_order(tok2, jsonb_build_array(jsonb_build_object('product_id', p_ok, 'qty', 2, 'price', 1)), 'sin cebolla');
  if (r->>'total')::int <> 20000 then raise exception 'total esperado 20000, fue %', r->>'total'; end if;
  failed := false;
  begin perform place_order(tok2, jsonb_build_array(jsonb_build_object('product_id', p_off, 'qty', 1)), null);
  exception when others then failed := true; end;
  if not failed then raise exception 'producto inactivo debió rechazarse'; end if;
  failed := false;
  begin perform place_order(tok2, '[]'::jsonb, null); exception when others then failed := true; end;
  if not failed then raise exception 'pedido vacio debió rechazarse'; end if;

  -- Estrellas
  failed := false;
  begin perform claim_star(tok2, 'mala'); exception when others then failed := sqlerrm = 'invalid_key'; end;
  if not failed then raise exception 'clave mala debió dar invalid_key'; end if;
  r := claim_star(tok2, bkey);
  if r->>'action' <> 'earn' or (r->>'stars')::int <> 1 then raise exception 'claim_star 1: %', r; end if;
  r := claim_star(tok2, bkey);
  if (r->>'stars')::int <> 2 then raise exception 'claim_star 2: %', r; end if;

  -- Canje sin estrellas suficientes falla
  failed := false;
  update customers set stars = 1 where id = cid;
  begin perform arm_redeem(tok2, rw); exception when others then failed := true; end;
  if not failed then raise exception 'arm_redeem sin estrellas debió fallar'; end if;
  update customers set stars = 2 where id = cid;

  -- Canje: estrellas a 0
  perform arm_redeem(tok2, rw);
  r := claim_star(tok2, bkey);
  if r->>'action' <> 'redeem' or (r->>'stars')::int <> 0 then raise exception 'canje: %', r; end if;
  if (get_my_card(tok2)->>'pending_reward_id') is not null then raise exception 'canje pendiente no se limpió'; end if;

  -- El pedido conserva los datos de entrega del momento, aunque el cliente cambie su dirección
  perform register_customer('Ana', 'Calle 9', '3001112233', true);

  -- Admin (contraseña de prueba fijada dentro de la transacción; se revierte)
  update admin_config set password_hash = extensions.crypt('clave-de-prueba', extensions.gen_salt('bf')) where id = 1;
  delete from admin_login_attempts;
  -- Contraseña incorrecta: devuelve null (no lanza error, para que el intento fallido quede registrado)
  if admin_login('mal') is not null then raise exception 'admin_login mal debió devolver null'; end if;
  -- Bloqueo tras 5 intentos fallidos: ni la contraseña correcta entra
  for i in 1..4 loop
    perform admin_login('mal');
  end loop;
  failed := false;
  begin perform admin_login('clave-de-prueba'); exception when others then failed := sqlerrm = 'too_many_attempts'; end;
  if not failed then raise exception 'tras 5 fallos debió dar too_many_attempts'; end if;
  delete from admin_login_attempts;
  adm := admin_login('clave-de-prueba');
  if (admin_orders(adm, 10)->0->'customer'->>'address') <> 'Calle 2' then
    raise exception 'el pedido debe conservar la dirección original, fue %', admin_orders(adm, 10)->0->'customer'->>'address';
  end if;
  if length(adm) < 32 then raise exception 'token admin corto'; end if;
  if not admin_session_valid(adm) then raise exception 'sesion admin no valida'; end if;
  if admin_session_valid('x') then raise exception 'sesion falsa valida'; end if;
  r := admin_get(adm);
  if r->>'business_key' is null then raise exception 'admin_get sin business_key'; end if;
  if jsonb_array_length(admin_orders(adm, 10)) < 1 then raise exception 'admin_orders vacio'; end if;
  failed := false;
  begin perform admin_get('x'); exception when others then failed := sqlerrm = 'unauthorized'; end;
  if not failed then raise exception 'admin_get sin sesion debió dar unauthorized'; end if;
  failed := false;
  begin perform admin_upsert(adm, 'admin_config', '{}'::jsonb); exception when others then failed := true; end;
  if not failed then raise exception 'admin_upsert debe rechazar tablas fuera de la lista'; end if;
  r := admin_upsert(adm, 'products', jsonb_build_object('category_id', cat_id, 'name', 'Nuevo', 'price', 1000, 'images', jsonb_build_array('a.webp','b.webp')));
  if r->>'id' is null or jsonb_array_length(r->'images') <> 2 then raise exception 'admin_upsert insert: %', r; end if;
  r := admin_upsert(adm, 'products', jsonb_build_object('id', r->>'id', 'price', 2000));
  if (r->>'price')::int <> 2000 or r->>'name' <> 'Nuevo' then raise exception 'admin_upsert update: %', r; end if;
  r := admin_upsert(adm, 'products', jsonb_build_object('id', r->>'id', 'i18n', '{"fr":{"name":"Nouveau"}}'::jsonb));
  if r->'i18n'->'fr'->>'name' <> 'Nouveau' then raise exception 'admin_upsert no guardó i18n: %', r; end if;

  -- Modo solo menú: el interruptor no pisa el resto de settings y bloquea pedidos en el servidor
  update settings set data = data || '{"business":{"name":"X"}}' where id = 1;
  r := admin_set_ordering(adm, false);
  if r->'business'->>'name' <> 'X' or (r->'ordering'->>'enabled')::boolean <> false then raise exception 'admin_set_ordering: %', r; end if;
  failed := false;
  begin perform place_order(tok2, jsonb_build_array(jsonb_build_object('product_id', p_ok, 'qty', 1)), null);
  exception when others then failed := sqlerrm = 'ordering_disabled'; end;
  if not failed then raise exception 'con pedidos desactivados debió dar ordering_disabled'; end if;
  -- Guardar la página con una copia vieja (ordering=true) no debe reactivar los pedidos apagados
  r := admin_save_settings(adm, (select data from settings where id = 1) || '{"ordering":{"enabled":true}}'::jsonb);
  if (select (data->'ordering'->>'enabled')::boolean from settings where id = 1) <> false then
    raise exception 'admin_save_settings reactivó los pedidos con una copia vieja';
  end if;
  perform admin_set_ordering(adm, true);

  -- Dos guardados seguidos de traducciones con datos en caché no deben pisarse
  perform admin_upsert(adm, 'products', jsonb_build_object('id', p_ok, 'i18n', '{"de":{"name":"Produkt"}}'::jsonb));
  perform admin_upsert(adm, 'products', jsonb_build_object('id', p_ok, 'i18n', '{"de":{"description":"Beschreibung"}}'::jsonb));
  if (select i18n->'de'->>'name' from products where id = p_ok) is distinct from 'Produkt'
     or (select i18n->'de'->>'description' from products where id = p_ok) is distinct from 'Beschreibung'
     or (select i18n->'en'->>'name' from products where id = p_ok) is distinct from 'T product EN' then
    raise exception 'admin_upsert perdió traducciones: %', (select i18n from products where id = p_ok);
  end if;
  perform place_order(tok2, jsonb_build_array(jsonb_build_object('product_id', p_ok, 'qty', 1)), null);
  failed := false;
  begin perform admin_set_ordering('x', false); exception when others then failed := sqlerrm = 'unauthorized'; end;
  if not failed then raise exception 'admin_set_ordering sin sesión debió dar unauthorized'; end if;

  -- Permisos: anon no puede tocar ninguna tabla ni llamar a los helpers internos
  for t in select tablename from pg_tables where schemaname = 'public' loop
    if has_table_privilege('anon', 'public.' || t, 'select') or has_table_privilege('anon', 'public.' || t, 'insert')
       or has_table_privilege('anon', 'public.' || t, 'update') or has_table_privilege('anon', 'public.' || t, 'delete') then
      raise exception 'anon tiene permisos sobre %', t;
    end if;
  end loop;
  if has_function_privilege('anon', 'public._customer(text)', 'execute') then raise exception 'anon puede _customer'; end if;
  if has_function_privilege('anon', 'public._admin_check(text)', 'execute') then raise exception 'anon puede _admin_check'; end if;
  if not has_function_privilege('anon', 'public.get_public_data()', 'execute') then raise exception 'anon no puede get_public_data'; end if;

  raise exception 'ALL_TESTS_PASSED';
end $$;
