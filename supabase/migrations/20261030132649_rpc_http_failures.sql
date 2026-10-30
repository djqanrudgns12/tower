-- PRD §16.3: 논리적 실패를 HTTP 성공으로 반환하지 않는다.
-- response.status/headers는 PostgREST의 트랜잭션 응답 설정이다.
-- 예외로 롤백하지 않아 거부된 요청도 속도 제한 호출 수에 남는다.
create or replace function public.private_player_hash(p_player_id uuid)
returns char(64) language plpgsql stable security definer set search_path = public, extensions as $$
declare v_salt text := nullif(current_setting('app.player_salt', true), '');
begin
  if p_player_id is null then raise sqlstate 'PT401' using message='AUTH_REQUIRED'; end if;
  if v_salt is null then raise sqlstate 'PT503' using message='PLAYER_SALT_REQUIRED'; end if;
  return encode(hmac(p_player_id::text, v_salt, 'sha256'), 'hex')::char(64);
end;
$$;
revoke all on function public.private_player_hash(uuid) from public,anon,authenticated;

create function public.lobby_rpc_failure(p_error text,p_status integer,p_retry_after integer default null)
returns jsonb language plpgsql set search_path = public as $$
begin
  perform set_config('response.status',p_status::text,true);
  if p_retry_after is not null then
    perform set_config('response.headers',jsonb_build_array(
      jsonb_build_object('Retry-After',p_retry_after::text),
      jsonb_build_object('Access-Control-Expose-Headers','Content-Range, Range-Unit, Retry-After')
    )::text,true);
  end if;
  return jsonb_build_object('error',p_error);
end;
$$;
revoke all on function public.lobby_rpc_failure(text,integer,integer) from public,anon,authenticated;

create function public.lobby_retry_after(p_action text,p_day_limit integer)
returns integer language plpgsql stable set search_path = public as $$
declare v_day_calls integer; v_boundary timestamptz;
begin
  select calls into v_day_calls from public.rpc_rate_buckets
    where player_hash=public.private_player_hash(auth.uid()) and action=p_action and bucket='day:'||public.kst_today()::text;
  if coalesce(v_day_calls,0)>=p_day_limit then
    v_boundary:=((now() at time zone 'Asia/Seoul')::date+1)::timestamp at time zone 'Asia/Seoul';
  else v_boundary:=date_trunc('minute',now())+interval '1 minute'; end if;
  return greatest(1,ceil(extract(epoch from v_boundary-now()))::integer);
end;
$$;
revoke all on function public.lobby_retry_after(text,integer) from public,anon,authenticated;


create or replace function public.record_lobby_visit()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_today date := public.kst_today();
  v_hash char(64) := public.private_player_hash(auth.uid());
  v_inserted integer := 0;
  v_today_plays integer := 0;
  v_total_visitors bigint := 0;
  v_total_plays bigint := 0;
begin
  perform set_config('response.status','200',true);
  perform set_config('response.headers','[]',true);
  if not public.allow_lobby_rpc('visit',60,2000) then return public.lobby_rpc_failure('RATE_LIMITED',429,public.lobby_retry_after('visit',2000)); end if;
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

create or replace function public.record_run_start(p_run_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_today date := public.kst_today();
  v_hash char(64) := public.private_player_hash(auth.uid());
  v_recent integer := 0;
  v_inserted integer := 0;
begin
  perform set_config('response.status','200',true);
  perform set_config('response.headers','[]',true);
  if not public.allow_lobby_rpc('start',3,200) then return public.lobby_rpc_failure('RATE_LIMITED',429,public.lobby_retry_after('start',200)); end if;
  if p_run_id is null then return public.lobby_rpc_failure('INVALID_RUN_ID',422); end if;
  select count(*) into v_recent
    from public.run_start_dedup
   where player_hash = v_hash
     and started_at > now() - interval '60 seconds';

  if v_recent >= 3 then
    return public.lobby_rpc_failure('RATE_LIMITED',429,public.lobby_retry_after('start',200));
  end if;

  if exists(select 1 from public.run_start_dedup where run_id=p_run_id and player_hash<>v_hash) then return public.lobby_rpc_failure('OWNER_REJECTED',403); end if;
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
  p_run_id uuid,p_nickname text,p_grade smallint,p_difficulty text,p_pt integer,p_completed_wave smallint,
  p_correct smallint,p_wrong smallint,p_skipped smallint,p_content_mode text,p_balance_version text,p_bank_version text,
  p_map_id text,p_ended_at timestamptz,p_ended_at_wave smallint,p_answers jsonb,p_active_ticks bigint
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_hash char(64):=public.private_player_hash(auth.uid()); v_clean text:=public.clean_public_nickname(p_nickname);
  v_start timestamptz; v_rules jsonb; v_score jsonb; v_kill bigint; v_min_ms bigint:=0; v_w integer; v_n integer; v_interval integer;
  v_ended timestamptz; v_honor integer; v_payload text; v_existing public.completed_runs%rowtype;
begin
  perform set_config('response.status','200',true);
  perform set_config('response.headers','[]',true);
  if not public.allow_lobby_rpc('submit',6,100) then return public.lobby_rpc_failure('RATE_LIMITED',429,public.lobby_retry_after('submit',100)); end if;
  if p_content_mode is distinct from 'published' then return jsonb_build_object('ok',true,'status','dev_mode_skipped'); end if;
  if v_clean is null then return public.lobby_rpc_failure('NICKNAME_REJECTED',422); end if;
  if p_run_id is null or p_grade is null or p_difficulty is null or p_pt is null or p_completed_wave is null or p_correct is null or p_wrong is null or p_skipped is null or p_ended_at is null or p_ended_at_wave is null or p_active_ticks is null
     or p_completed_wave<1 or p_ended_at_wave not between p_completed_wave and p_completed_wave+1 or p_correct<0 or p_wrong<0 or p_skipped<0 or p_active_ticks<0 or p_active_ticks>9007199254740991 then
    return public.lobby_rpc_failure('PLAUSIBILITY_REJECTED',422);
  end if;
  if not exists(select 1 from public.approved_run_conditions where bank_version=p_bank_version and grade=p_grade and balance_version=p_balance_version and map_id=p_map_id and active) then return public.lobby_rpc_failure('VERSION_REJECTED',422); end if;
  select rules into v_rules from public.run_verification_rules where balance_version=p_balance_version and difficulty=p_difficulty;
  if v_rules is null then return public.lobby_rpc_failure('VERSION_REJECTED',422); end if;
  perform pg_advisory_xact_lock(hashtextextended(p_run_id::text,0));
  v_payload:=encode(digest(jsonb_build_array(p_run_id,v_clean,p_grade,p_difficulty,p_pt,p_completed_wave,p_correct,p_wrong,p_skipped,p_balance_version,p_bank_version,p_map_id,p_ended_at,p_ended_at_wave,p_answers,p_active_ticks)::text,'sha256'),'hex');
  select * into v_existing from public.completed_runs where run_id=p_run_id;
  if found then
    if v_existing.player_hash=v_hash and v_existing.payload_hash=v_payload then return jsonb_build_object('ok',true,'status','already_recorded','verificationLevel',v_existing.verification_level); end if;
    return public.lobby_rpc_failure('DUPLICATE_RUN_REJECTED',409);
  end if;
  select started_at into v_start from public.run_start_dedup where run_id=p_run_id and player_hash=v_hash;
  if v_start is null then return public.lobby_rpc_failure('START_REQUIRED',422); end if;
  for v_w in 1..p_completed_wave loop
    v_n:=least((v_rules->>'countMax')::integer,(v_rules->>'countBase')::integer+((v_w-1)/(v_rules->>'countEvery')::integer)*(v_rules->>'countStep')::integer);
    v_interval:=coalesce((v_rules->'spawnOverrides'->>v_w::text)::integer,greatest((v_rules->>'spawnMin')::integer,(v_rules->>'spawnBase')::integer+(v_w-1)*(v_rules->>'spawnStep')::integer));
    v_min_ms:=v_min_ms+(v_n-1)*v_interval;
  end loop;
  if extract(epoch from now()-v_start)*1000<v_min_ms or p_active_ticks*1000/30<v_min_ms or p_active_ticks>ceil(extract(epoch from now()-v_start)*30)+300 then return public.lobby_rpc_failure('DURATION_REJECTED',422); end if;
  if jsonb_typeof(p_answers)='array' then
    if jsonb_array_length(p_answers)>p_active_ticks/30+1 then return public.lobby_rpc_failure('ANSWER_MISMATCH',422); end if;
  end if;
  v_score:=public.regrade_run_answers(p_bank_version,p_grade,p_answers,p_completed_wave,p_ended_at_wave,v_rules);
  if v_score is null or (v_score->>'correct')::integer<>p_correct or (v_score->>'wrong')::integer<>p_wrong or (v_score->>'skipped')::integer<>p_skipped then return public.lobby_rpc_failure('ANSWER_MISMATCH',422); end if;
  v_kill:=p_pt::bigint-(v_score->>'questionPt')::bigint;
  if v_kill<0 or v_kill>p_ended_at_wave*(v_rules->>'waveKillPtCap')::integer+(p_ended_at_wave/(v_rules->>'bossEvery')::integer)*(v_rules->>'bossPt')::integer then return public.lobby_rpc_failure('PT_MISMATCH',422); end if;
  v_ended:=greatest(now()-interval '7 days',least(p_ended_at,now()));
  v_honor:=least(5000,greatest(0,p_pt)::bigint*(case p_difficulty when 'Easy' then 80 when 'Hard' then 125 when 'Crazy' then 150 else 100 end)/100+p_completed_wave*15+p_correct*2);
  insert into public.completed_runs(run_id,player_hash,public_tag,nickname,grade,difficulty,pt,honor_pt,completed_wave,correct,wrong,skipped,content_mode,balance_version,bank_version,map_id,local_ended_at,ended_at,received_at,week_key,kst_date,verification_level,payload_hash)
    values(p_run_id,v_hash,substr(v_hash,1,16),v_clean,p_grade,p_difficulty,p_pt,v_honor,p_completed_wave,p_correct,p_wrong,p_skipped,'published',p_balance_version,p_bank_version,p_map_id,p_ended_at,v_ended,now(),public.kst_week_key(v_ended),(v_ended at time zone 'Asia/Seoul')::date,'question_regraded_combat_bounded',v_payload);
  return jsonb_build_object('ok',true,'status','recorded','verificationLevel','question_regraded_combat_bounded');
end;
$$;

create or replace function public.get_leaderboard_slice(p_tab text,p_grade smallint,p_difficulty text,p_period text,p_limit integer default 8,p_offset integer default 0)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_me char(64):=public.private_player_hash(auth.uid()); v_result jsonb;
begin
  perform set_config('response.status','200',true);
  perform set_config('response.headers','[]',true);
  if not public.allow_lobby_rpc('ranking',120,10000) then return public.lobby_rpc_failure('RATE_LIMITED',429,public.lobby_retry_after('ranking',10000)); end if;
  if p_tab is null or p_grade is null or p_difficulty is null or p_period is null or p_limit is null or p_offset is null or p_tab not in ('single_score','best_wave','honor_points') or p_grade not in (0,3,4,5,6) or p_difficulty not in ('Easy','Normal','Hard','Crazy') or p_period not in ('weekly','season1','all_time') or p_limit not between 1 and 50 or p_offset not between 0 and 10000 then return public.lobby_rpc_failure('INVALID_QUERY',422); end if;
  with eligible as (
    select * from public.completed_runs r where verification_level='question_regraded_combat_bounded' and completed_wave>=1
      and exists(select 1 from public.approved_run_conditions c where c.bank_version=r.bank_version and c.grade=r.grade and c.balance_version=r.balance_version and c.map_id=r.map_id and c.active)
      and (p_grade=0 or grade=p_grade) and (p_tab='honor_points' or difficulty=p_difficulty)
      and (p_period<>'weekly' or week_key=public.kst_week_key())
  ), best as (
    select *,row_number() over(partition by player_hash order by
      case when p_tab='best_wave' then completed_wave else pt end desc,
      case when p_tab='best_wave' then pt else completed_wave end desc,correct desc,received_at asc) as pick from eligible
  ), grouped as (
    select player_hash,max(public_tag) as public_tag,(array_agg(nickname order by received_at desc))[1] as nickname,
      max(grade)::smallint as grade,'Normal'::text as difficulty,sum(honor_pt)::bigint as val,count(*)::bigint as secondary,0::integer as correct,max(received_at) as achieved,array_agg(run_id) as run_ids
      from eligible where p_tab='honor_points' group by player_hash
    union all
    select player_hash,public_tag,nickname,grade,difficulty,case when p_tab='best_wave' then completed_wave else pt end,
      case when p_tab='best_wave' then pt else completed_wave end,correct,received_at,array[run_id] from best where pick=1 and p_tab<>'honor_points'
  ), ranked as (
    select *,row_number() over(order by val desc,
      case when p_tab='honor_points' then -secondary else secondary end desc,correct desc,achieved asc,player_hash) as rk from grouped
  ), entries as (
    select rk,player_hash,jsonb_build_object('rank',rk,'playerIdHash',public_tag,'isMe',player_hash=v_me,'runIds',case when player_hash=v_me then to_jsonb(run_ids) else '[]'::jsonb end,'nickname',nickname,'grade',grade,'difficulty',difficulty,
      'primaryValue',val,'secondaryLabel',case when p_tab='honor_points' then '완주 '||secondary||'판' when p_tab='best_wave' then secondary||'점' else secondary||'웨이브' end,
      'achievedAtIso',to_char(achieved at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) as entry from ranked
  ) select jsonb_build_object('entries',coalesce((select jsonb_agg(entry order by rk) from (select * from entries order by rk offset p_offset limit p_limit) page),'[]'::jsonb),
      'totalCount',(select count(*) from entries),'myEntry',(select entry from entries where player_hash=v_me)) into v_result;
  return v_result;
end;
$$;
