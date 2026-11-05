-- 어휘력 타워 디펜스 — 랜딩 페이지 실시간·누적 지표 및 세분화 통합 랭킹 스키마 (v1.0)
-- 기준 문서: landing_page_prd_v1_0.md §4, §8.3

create extension if not exists pgcrypto;

create or replace function public.kst_today()
returns date language sql stable as $$
  select (now() at time zone 'Asia/Seoul')::date;
$$;

create or replace function public.kst_week_key(ts timestamptz default now())
returns text language sql immutable as $$
  select to_char(ts at time zone 'Asia/Seoul', 'IYYY-"W"IW');
$$;

create table if not exists public.global_metrics (
  row_id smallint primary key default 1 check (row_id = 1),
  total_visitors bigint not null default 0 check (total_visitors >= 0),
  total_plays bigint not null default 0 check (total_plays >= 0),
  updated_at timestamptz not null default now()
);
insert into public.global_metrics (row_id) values (1) on conflict do nothing;

create table if not exists public.daily_metrics (
  kst_date date primary key,
  unique_visitors integer not null default 0 check (unique_visitors >= 0),
  plays integer not null default 0 check (plays >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.daily_visitor_hashes (
  kst_date date not null,
  visitor_hash char(64) not null,
  created_at timestamptz not null default now(),
  primary key (kst_date, visitor_hash)
);

create table if not exists public.run_start_dedup (
  run_id uuid primary key,
  player_hash char(64) not null,
  kst_date date not null default public.kst_today(),
  started_at timestamptz not null default now()
);
create index if not exists idx_run_start_rate on public.run_start_dedup (player_hash, started_at desc);

create table if not exists public.completed_runs (
  run_id uuid primary key,
  player_hash char(64) not null,
  public_tag char(16) not null,
  nickname text not null check (char_length(nickname) between 2 and 12),
  grade smallint not null check (grade between 3 and 6),
  difficulty text not null check (difficulty in ('Easy', 'Normal', 'Hard', 'Crazy')),
  pt integer not null,
  honor_pt integer not null check (honor_pt between 0 and 5000),
  completed_wave smallint not null check (completed_wave between 0 and 200),
  correct smallint not null check (correct >= 0),
  wrong smallint not null check (wrong >= 0),
  skipped smallint not null check (skipped >= 0),
  content_mode text not null check (content_mode in ('published', 'development')),
  balance_version text not null,
  bank_version text not null,
  season_id text not null default 'season1',
  week_key text not null default public.kst_week_key(),
  kst_date date not null default public.kst_today(),
  ended_at timestamptz not null default now()
);

create table if not exists public.leaderboard_best (
  player_hash char(64) not null,
  public_tag char(16) not null,
  grade smallint not null check (grade between 3 and 6),
  difficulty text not null check (difficulty in ('Easy', 'Normal', 'Hard', 'Crazy')),
  nickname text not null,
  best_pt integer not null,
  best_pt_wave smallint not null,
  best_pt_accuracy smallint not null,
  best_pt_at timestamptz not null,
  best_wave smallint not null,
  best_wave_pt integer not null,
  best_wave_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (player_hash, grade, difficulty)
);

create index if not exists idx_lb_single_score
  on public.leaderboard_best (grade, difficulty, best_pt desc, best_pt_wave desc, best_pt_at asc);

create index if not exists idx_lb_best_wave
  on public.leaderboard_best (grade, difficulty, best_wave desc, best_wave_pt desc, best_wave_at asc);

create table if not exists public.leaderboard_honor (
  period_bucket text not null,
  grade_bucket smallint not null check (grade_bucket in (0, 3, 4, 5, 6)),
  player_hash char(64) not null,
  public_tag char(16) not null,
  nickname text not null,
  honor_pt_sum bigint not null default 0 check (honor_pt_sum >= 0),
  run_count integer not null default 0 check (run_count >= 0),
  last_achieved_at timestamptz not null default now(),
  primary key (period_bucket, grade_bucket, player_hash)
);

create index if not exists idx_lb_honor_rank
  on public.leaderboard_honor (period_bucket, grade_bucket, honor_pt_sum desc, run_count asc, last_achieved_at asc);

alter table public.global_metrics enable row level security;
alter table public.daily_metrics enable row level security;
alter table public.daily_visitor_hashes enable row level security;
alter table public.run_start_dedup enable row level security;
alter table public.completed_runs enable row level security;
alter table public.leaderboard_best enable row level security;
alter table public.leaderboard_honor enable row level security;

revoke all on public.global_metrics, public.daily_metrics, public.daily_visitor_hashes,
  public.run_start_dedup, public.completed_runs, public.leaderboard_best, public.leaderboard_honor
from anon, authenticated;

create or replace function private_player_hash(p_player_id uuid)
returns char(64)
language sql stable security definer set search_path = public as $$
  select encode(
    hmac(
      p_player_id::text,
      coalesce(nullif(current_setting('app.player_salt', true), ''), 'vtd-default-local-salt-change-in-prod'),
      'sha256'
    ),
    'hex'
  )::char(64);
$$;
revoke all on function private_player_hash(uuid) from public, anon, authenticated;

create or replace function public.record_lobby_visit(p_player_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_today date := public.kst_today();
  v_hash char(64) := private_player_hash(p_player_id);
  v_inserted integer := 0;
  v_today_plays integer := 0;
  v_total_visitors bigint := 0;
  v_total_plays bigint := 0;
begin
  insert into public.daily_visitor_hashes (kst_date, visitor_hash)
  values (v_today, v_hash)
  on conflict do nothing;

  get diagnostics v_inserted = row_count;

  insert into public.daily_metrics (kst_date, unique_visitors, plays)
  values (v_today, v_inserted, 0)
  on conflict (kst_date) do update
    set unique_visitors = public.daily_metrics.unique_visitors + excluded.unique_visitors,
        updated_at = now()
  returning plays into v_today_plays;

  if v_inserted > 0 then
    update public.global_metrics
       set total_visitors = total_visitors + 1,
           updated_at = now()
     where row_id = 1
    returning total_visitors, total_plays into v_total_visitors, v_total_plays;
  else
    select total_visitors, total_plays
      into v_total_visitors, v_total_plays
      from public.global_metrics
     where row_id = 1;
  end if;

  return jsonb_build_object(
    'todayPlays', coalesce(v_today_plays, 0),
    'totalVisitors', coalesce(v_total_visitors, 0),
    'totalPlays', coalesce(v_total_plays, 0),
    'updatedAtIso', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
  );
end;
$$;

create or replace function public.record_run_start(p_run_id uuid, p_player_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_today date := public.kst_today();
  v_hash char(64) := private_player_hash(p_player_id);
  v_recent integer := 0;
  v_inserted integer := 0;
begin
  select count(*) into v_recent
    from public.run_start_dedup
   where player_hash = v_hash
     and started_at > now() - interval '60 seconds';

  if v_recent >= 3 then
    return jsonb_build_object('counted', false, 'reason', 'RATE_LIMITED');
  end if;

  insert into public.run_start_dedup (run_id, player_hash, kst_date)
  values (p_run_id, v_hash, v_today)
  on conflict (run_id) do nothing;

  get diagnostics v_inserted = row_count;

  if v_inserted > 0 then
    insert into public.daily_metrics (kst_date, unique_visitors, plays)
    values (v_today, 0, 1)
    on conflict (kst_date) do update
      set plays = public.daily_metrics.plays + 1,
          updated_at = now();

    update public.global_metrics
       set total_plays = total_plays + 1,
           updated_at = now()
     where row_id = 1;
  end if;

  return jsonb_build_object('counted', v_inserted > 0);
end;
$$;

create or replace function public.submit_completed_run(
  p_run_id uuid,
  p_player_id uuid,
  p_nickname text,
  p_grade smallint,
  p_difficulty text,
  p_pt integer,
  p_completed_wave smallint,
  p_correct smallint,
  p_wrong smallint,
  p_skipped smallint,
  p_content_mode text,
  p_balance_version text,
  p_bank_version text
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_clean_nick text := btrim(regexp_replace(p_nickname, '[[:cntrl:]]', '', 'g'));
  v_hash char(64) := private_player_hash(p_player_id);
  v_tag char(16) := substr(v_hash, 1, 16);
  v_today date := public.kst_today();
  v_week text := 'week:' || public.kst_week_key();
  v_mult integer;
  v_honor integer := 0;
  v_daily_runs integer := 0;
  v_total_q integer := p_correct + p_wrong + p_skipped;
  v_acc smallint := case when v_total_q > 0 then round((p_correct::numeric * 100) / v_total_q)::smallint else 0 end;
  v_inserted integer := 0;
begin
  if p_content_mode <> 'published' then
    return jsonb_build_object('ok', true, 'status', 'dev_mode_skipped');
  end if;

  if char_length(v_clean_nick) < 2 or char_length(v_clean_nick) > 12
     or v_clean_nick ~ '01[016789][-.\s]?[0-9]{3,4}[-.\s]?[0-9]{4}'
     or v_clean_nick ~ '[0-9]{6,}' then
    return jsonb_build_object('ok', false, 'error', 'NICKNAME_REJECTED');
  end if;

  if p_grade not between 3 and 6
     or p_difficulty not in ('Easy', 'Normal', 'Hard', 'Crazy')
     or p_completed_wave not between 0 and 200
     or p_correct < 0 or p_wrong < 0 or p_skipped < 0
     or p_correct > (p_completed_wave + 1) * 25 + 10
     or p_pt > (p_correct * 450 + p_completed_wave * 600) then
    return jsonb_build_object('ok', false, 'error', 'PLAUSIBILITY_REJECTED');
  end if;

  if p_completed_wave >= 1 then
    v_mult := case p_difficulty
      when 'Easy' then 80
      when 'Normal' then 100
      when 'Hard' then 125
      when 'Crazy' then 150
      else 100
    end;
    v_honor := least(5000, ((greatest(0, p_pt) * v_mult) / 100) + (p_completed_wave * 15) + (p_correct * 2));
  end if;

  insert into public.completed_runs (
    run_id, player_hash, public_tag, nickname, grade, difficulty,
    pt, honor_pt, completed_wave, correct, wrong, skipped,
    content_mode, balance_version, bank_version, season_id, week_key, kst_date
  ) values (
    p_run_id, v_hash, v_tag, v_clean_nick, p_grade, p_difficulty,
    p_pt, v_honor, p_completed_wave, p_correct, p_wrong, p_skipped,
    p_content_mode, p_balance_version, p_bank_version, 'season1', public.kst_week_key(), v_today
  ) on conflict (run_id) do nothing;

  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    return jsonb_build_object('ok', true, 'status', 'already_recorded', 'honorPt', v_honor);
  end if;

  insert into public.leaderboard_best (
    player_hash, public_tag, grade, difficulty, nickname,
    best_pt, best_pt_wave, best_pt_accuracy, best_pt_at,
    best_wave, best_wave_pt, best_wave_at
  ) values (
    v_hash, v_tag, p_grade, p_difficulty, v_clean_nick,
    p_pt, p_completed_wave, v_acc, now(),
    p_completed_wave, p_pt, now()
  )
  on conflict (player_hash, grade, difficulty) do update set
    nickname = excluded.nickname,
    best_pt = case
      when excluded.best_pt > public.leaderboard_best.best_pt
        or (excluded.best_pt = public.leaderboard_best.best_pt and excluded.best_pt_wave > public.leaderboard_best.best_pt_wave)
      then excluded.best_pt else public.leaderboard_best.best_pt end,
    best_pt_wave = case
      when excluded.best_pt > public.leaderboard_best.best_pt
        or (excluded.best_pt = public.leaderboard_best.best_pt and excluded.best_pt_wave > public.leaderboard_best.best_pt_wave)
      then excluded.best_pt_wave else public.leaderboard_best.best_pt_wave end,
    best_pt_accuracy = case
      when excluded.best_pt > public.leaderboard_best.best_pt
        or (excluded.best_pt = public.leaderboard_best.best_pt and excluded.best_pt_wave > public.leaderboard_best.best_pt_wave)
      then excluded.best_pt_accuracy else public.leaderboard_best.best_pt_accuracy end,
    best_pt_at = case
      when excluded.best_pt > public.leaderboard_best.best_pt
        or (excluded.best_pt = public.leaderboard_best.best_pt and excluded.best_pt_wave > public.leaderboard_best.best_pt_wave)
      then now() else public.leaderboard_best.best_pt_at end,
    best_wave = case
      when excluded.best_wave > public.leaderboard_best.best_wave
        or (excluded.best_wave = public.leaderboard_best.best_wave and excluded.best_wave_pt > public.leaderboard_best.best_wave_pt)
      then excluded.best_wave else public.leaderboard_best.best_wave end,
    best_wave_pt = case
      when excluded.best_wave > public.leaderboard_best.best_wave
        or (excluded.best_wave = public.leaderboard_best.best_wave and excluded.best_wave_pt > public.leaderboard_best.best_wave_pt)
      then excluded.best_wave_pt else public.leaderboard_best.best_wave_pt end,
    best_wave_at = case
      when excluded.best_wave > public.leaderboard_best.best_wave
        or (excluded.best_wave = public.leaderboard_best.best_wave and excluded.best_wave_pt > public.leaderboard_best.best_wave_pt)
      then now() else public.leaderboard_best.best_wave_at end,
    updated_at = now();

  if v_honor > 0 then
    select count(*) into v_daily_runs
      from public.completed_runs
     where player_hash = v_hash
       and kst_date = v_today
       and honor_pt > 0;

    if v_daily_runs <= 30 then
      insert into public.leaderboard_honor (period_bucket, grade_bucket, player_hash, public_tag, nickname, honor_pt_sum, run_count)
      select p_bucket, g_bucket, v_hash, v_tag, v_clean_nick, v_honor, 1
        from unnest(array['all_time', 'season:season1', v_week]) as p_bucket
       cross join unnest(array[0::smallint, p_grade]) as g_bucket
      on conflict (period_bucket, grade_bucket, player_hash) do update set
        nickname = excluded.nickname,
        honor_pt_sum = public.leaderboard_honor.honor_pt_sum + excluded.honor_pt_sum,
        run_count = public.leaderboard_honor.run_count + 1,
        last_achieved_at = now();
    end if;
  end if;

  return jsonb_build_object('ok', true, 'status', 'recorded', 'honorPt', v_honor);
end;
$$;

create or replace function public.get_leaderboard_slice(
  p_tab text,
  p_grade smallint,
  p_difficulty text,
  p_period text,
  p_limit integer default 8,
  p_offset integer default 0,
  p_player_id uuid default null
)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_lim integer := least(greatest(coalesce(p_limit, 8), 1), 50);
  v_off integer := greatest(coalesce(p_offset, 0), 0);
  v_my_hash char(64) := case when p_player_id is not null then private_player_hash(p_player_id) else null end;
  v_period_bucket text := case p_period
    when 'weekly' then 'week:' || public.kst_week_key()
    when 'season1' then 'season:season1'
    else 'all_time'
  end;
  v_entries jsonb := '[]'::jsonb;
  v_total integer := 0;
  v_mine jsonb := null;
begin
  if p_tab = 'single_score' then
    with ranked as (
      select
        row_number() over (order by best_pt desc, best_pt_wave desc, best_pt_at asc) as rk,
        player_hash, public_tag, nickname, grade, difficulty,
        best_pt as primary_val,
        (best_pt_wave || '웨이브 · 정답 ' || best_pt_accuracy || '%') as secondary_lbl,
        best_pt_at as achieved_at
      from public.leaderboard_best
      where grade = p_grade and difficulty = p_difficulty
    )
    select
      coalesce((select jsonb_agg(jsonb_build_object(
        'rank', rk, 'playerIdHash', public_tag, 'isMe', (player_hash = v_my_hash),
        'nickname', nickname, 'grade', grade, 'difficulty', difficulty,
        'primaryValue', primary_val, 'secondaryLabel', secondary_lbl,
        'achievedAtIso', to_char(achieved_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
      )) from (select * from ranked offset v_off limit v_lim) s), '[]'::jsonb),
      (select count(*)::integer from ranked),
      (select jsonb_build_object(
        'rank', rk, 'playerIdHash', public_tag, 'isMe', true,
        'nickname', nickname, 'grade', grade, 'difficulty', difficulty,
        'primaryValue', primary_val, 'secondaryLabel', secondary_lbl,
        'achievedAtIso', to_char(achieved_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
      ) from ranked where player_hash = v_my_hash limit 1)
    into v_entries, v_total, v_mine;

  elsif p_tab = 'best_wave' then
    with ranked as (
      select
        row_number() over (order by best_wave desc, best_wave_pt desc, best_wave_at asc) as rk,
        player_hash, public_tag, nickname, grade, difficulty,
        best_wave as primary_val,
        (to_char(best_wave_pt, 'FM999,999,999') || '점') as secondary_lbl,
        best_wave_at as achieved_at
      from public.leaderboard_best
      where grade = p_grade and difficulty = p_difficulty
    )
    select
      coalesce((select jsonb_agg(jsonb_build_object(
        'rank', rk, 'playerIdHash', public_tag, 'isMe', (player_hash = v_my_hash),
        'nickname', nickname, 'grade', grade, 'difficulty', difficulty,
        'primaryValue', primary_val, 'secondaryLabel', secondary_lbl,
        'achievedAtIso', to_char(achieved_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
      )) from (select * from ranked offset v_off limit v_lim) s), '[]'::jsonb),
      (select count(*)::integer from ranked),
      (select jsonb_build_object(
        'rank', rk, 'playerIdHash', public_tag, 'isMe', true,
        'nickname', nickname, 'grade', grade, 'difficulty', difficulty,
        'primaryValue', primary_val, 'secondaryLabel', secondary_lbl,
        'achievedAtIso', to_char(achieved_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
      ) from ranked where player_hash = v_my_hash limit 1)
    into v_entries, v_total, v_mine;

  elsif p_tab = 'honor_points' then
    with ranked as (
      select
        row_number() over (order by honor_pt_sum desc, run_count asc, last_achieved_at asc) as rk,
        player_hash, public_tag, nickname,
        honor_pt_sum as primary_val,
        ('완주 ' || run_count || '판' || case when p_grade = 0 then ' · 전체 학년' else ' · ' || p_grade || '학년' end) as secondary_lbl,
        last_achieved_at as achieved_at
      from public.leaderboard_honor
      where period_bucket = v_period_bucket and grade_bucket = coalesce(p_grade, 0)
    )
    select
      coalesce((select jsonb_agg(jsonb_build_object(
        'rank', rk, 'playerIdHash', public_tag, 'isMe', (player_hash = v_my_hash),
        'nickname', nickname, 'grade', greatest(coalesce(p_grade, 3), 3), 'difficulty', 'Normal',
        'primaryValue', primary_val, 'secondaryLabel', secondary_lbl,
        'achievedAtIso', to_char(achieved_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
      )) from (select * from ranked offset v_off limit v_lim) s), '[]'::jsonb),
      (select count(*)::integer from ranked),
      (select jsonb_build_object(
        'rank', rk, 'playerIdHash', public_tag, 'isMe', true,
        'nickname', nickname, 'grade', greatest(coalesce(p_grade, 3), 3), 'difficulty', 'Normal',
        'primaryValue', primary_val, 'secondaryLabel', secondary_lbl,
        'achievedAtIso', to_char(achieved_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
      ) from ranked where player_hash = v_my_hash limit 1)
    into v_entries, v_total, v_mine;
  end if;

  return jsonb_build_object('entries', v_entries, 'totalCount', v_total, 'myEntry', v_mine);
end;
$$;

grant execute on function public.record_lobby_visit(uuid) to anon, authenticated;
grant execute on function public.record_run_start(uuid, uuid) to anon, authenticated;
grant execute on function public.submit_completed_run(uuid, uuid, text, smallint, text, integer, smallint, smallint, smallint, smallint, text, text, text) to anon, authenticated;
grant execute on function public.get_leaderboard_slice(text, smallint, text, text, integer, integer, uuid) to anon, authenticated;

create or replace function public.cleanup_ephemeral_lobby_hashes()
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.daily_visitor_hashes where kst_date < public.kst_today() - 7;
  delete from public.run_start_dedup where kst_date < public.kst_today() - 7;
end;
$$;
revoke all on function public.cleanup_ephemeral_lobby_hashes() from public, anon, authenticated;
