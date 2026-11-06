-- Ámbar PWA: correcciones de la revisión final de i18n/PWA.
-- 1) admin_save_settings no toca settings.ordering (solo admin_set_ordering lo cambia): guardar la página
--    desde una pestaña abierta con datos viejos no reactiva los pedidos apagados.
-- 2) admin_upsert fusiona i18n por idioma y campo en vez de reemplazarlo.

create or replace function admin_save_settings(p_token text, p_data jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare v jsonb;
begin
  perform _admin_check(p_token);
  if jsonb_typeof(p_data) <> 'object' then raise exception 'invalid_settings'; end if;
  update settings
     set data = (p_data - 'ordering') || case when data ? 'ordering' then jsonb_build_object('ordering', data->'ordering') else '{}'::jsonb end,
         updated_at = now()
   where id = 1
  returning data into v;
  return v;
end $$;

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
    -- Las traducciones se fusionan por idioma y campo: dos guardados seguidos con datos en caché no se pisan.
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

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  get_public_data(), register_customer(text, text, text, boolean), get_my_card(text),
  place_order(text, jsonb, text), arm_redeem(text, uuid), claim_star(text, text),
  admin_session_valid(text), admin_login(text), admin_logout(text), admin_get(text),
  admin_orders(text, int), admin_set_order_status(text, uuid, text), admin_customers(text),
  admin_adjust_stars(text, uuid, int), admin_upsert(text, text, jsonb), admin_delete(text, text, uuid),
  admin_save_settings(text, jsonb), admin_change_password(text, text, text), admin_set_ordering(text, boolean)
to anon, authenticated;
