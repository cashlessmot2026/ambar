-- Encuesta de satisfacción: la configuración (preguntas) vive en settings.survey y las respuestas en survey_responses.

create table if not exists survey_responses (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  answers jsonb not null,            -- [{ "id": "...", "text": "...", "rating": 1..5 }]
  comment text,
  average numeric(3, 2) not null
);
create index if not exists survey_responses_created_idx on survey_responses (created_at desc);
alter table survey_responses enable row level security;
revoke all on table survey_responses from anon, authenticated;

-- Pública: el cliente envía sus calificaciones. Valida forma y rangos; no requiere sesión.
create or replace function submit_survey(p_answers jsonb, p_comment text default null) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_clean jsonb;
  v_avg numeric;
  v_n int;
begin
  if p_answers is null or jsonb_typeof(p_answers) <> 'array' then raise exception 'invalid_survey'; end if;
  v_n := jsonb_array_length(p_answers);
  if v_n < 1 or v_n > 20 then raise exception 'invalid_survey'; end if;

  -- Freno básico contra abuso: máx. 40 respuestas por minuto en total.
  if (select count(*) from survey_responses where created_at > now() - interval '1 minute') >= 40 then
    raise exception 'too_many_attempts';
  end if;

  select jsonb_agg(jsonb_build_object(
           'id', left(coalesce(a->>'id', ''), 40),
           'text', left(coalesce(a->>'text', ''), 200),
           'rating', (a->>'rating')::int)),
         avg((a->>'rating')::int)
    into v_clean, v_avg
    from jsonb_array_elements(p_answers) a
   where (a->>'rating') ~ '^[1-5]$';

  if v_clean is null or jsonb_array_length(v_clean) <> v_n then raise exception 'invalid_survey'; end if;

  insert into survey_responses (answers, comment, average)
  values (v_clean, nullif(left(btrim(coalesce(p_comment, '')), 1000), ''), round(v_avg, 2));
end $$;

-- Admin: guarda la configuración de la encuesta sin tocar el resto de settings.
create or replace function admin_set_survey(p_token text, p_data jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare v jsonb;
begin
  perform _admin_check(p_token);
  if p_data is null or jsonb_typeof(p_data) <> 'object' or jsonb_typeof(p_data->'questions') <> 'array'
     or jsonb_array_length(p_data->'questions') > 20 then
    raise exception 'invalid_survey';
  end if;
  update settings
     set data = jsonb_set(data, '{survey}', p_data, true), updated_at = now()
   where id = 1
  returning data into v;
  return v;
end $$;

-- Admin: resumen y últimas respuestas.
create or replace function admin_survey_results(p_token text, p_limit int default 50) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  perform _admin_check(p_token);
  return jsonb_build_object(
    'total', (select count(*) from survey_responses),
    'average', (select round(avg(average), 2) from survey_responses),
    'by_question', coalesce((
      select jsonb_agg(jsonb_build_object('text', q.text, 'avg', q.avg, 'count', q.n) order by q.n desc, q.text)
      from (
        select a->>'text' as text, round(avg((a->>'rating')::int), 2) as avg, count(*) as n
          from survey_responses r, jsonb_array_elements(r.answers) a
         group by a->>'text'
      ) q), '[]'::jsonb),
    'recent', coalesce((
      select jsonb_agg(jsonb_build_object('id', r.id, 'created_at', r.created_at, 'average', r.average,
                                          'comment', r.comment, 'answers', r.answers) order by r.created_at desc)
      from (select * from survey_responses order by created_at desc limit greatest(1, least(coalesce(p_limit, 50), 200))) r
    ), '[]'::jsonb)
  );
end $$;

revoke execute on function submit_survey(jsonb, text), admin_set_survey(text, jsonb), admin_survey_results(text, int)
  from public, anon, authenticated;
grant execute on function submit_survey(jsonb, text), admin_set_survey(text, jsonb), admin_survey_results(text, int)
  to anon, authenticated;
