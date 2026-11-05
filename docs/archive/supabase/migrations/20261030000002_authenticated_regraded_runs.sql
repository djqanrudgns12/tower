-- WP-NET: 기존 공개 ID RPC를 제거하고 익명 인증 사용자만 소유자로 인정한다.
-- 기존 migration은 수정하지 않는다. 배포 전 익명 인증 및 app.player_salt 설정이 필요하다.
drop function public.record_lobby_visit(uuid);
drop function public.record_run_start(uuid, uuid);
drop function public.submit_completed_run(uuid, uuid, text, smallint, text, integer, smallint, smallint, smallint, smallint, text, text, text);
drop function public.get_leaderboard_slice(text, smallint, text, text, integer, integer, uuid);

create or replace function public.private_player_hash(p_player_id uuid)
returns char(64) language plpgsql stable security definer set search_path = public, extensions as $$
declare v_salt text := nullif(current_setting('app.player_salt', true), '');
begin
  if p_player_id is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  if v_salt is null then raise exception 'PLAYER_SALT_REQUIRED'; end if;
  return encode(hmac(p_player_id::text, v_salt, 'sha256'), 'hex')::char(64);
end;
$$;
revoke all on function public.private_player_hash(uuid) from public, anon, authenticated;

create table public.rpc_rate_buckets (
  player_hash char(64) not null, action text not null, bucket text not null,
  calls integer not null default 0, expires_at timestamptz not null,
  primary key (player_hash, action, bucket)
);
alter table public.rpc_rate_buckets enable row level security;
revoke all on public.rpc_rate_buckets from public, anon, authenticated;
create index rpc_rate_buckets_expiry on public.rpc_rate_buckets(expires_at);

create function public.allow_lobby_rpc(p_action text, p_minute integer, p_day integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_hash char(64) := public.private_player_hash(auth.uid());
  v_min text := 'minute:' || to_char(now() at time zone 'UTC', 'YYYYMMDDHH24MI');
  v_day text := 'day:' || public.kst_today()::text;
  v_count integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(v_hash || ':' || p_action, 0));
  select calls into v_count from public.rpc_rate_buckets where player_hash=v_hash and action=p_action and bucket=v_min;
  if coalesce(v_count,0) >= p_minute then return false; end if;
  select calls into v_count from public.rpc_rate_buckets where player_hash=v_hash and action=p_action and bucket=v_day;
  if coalesce(v_count,0) >= p_day then return false; end if;
  insert into public.rpc_rate_buckets(player_hash,action,bucket,calls,expires_at)
    values(v_hash,p_action,v_min,1,now()+interval '2 days'),(v_hash,p_action,v_day,1,now()+interval '2 days')
    on conflict(player_hash,action,bucket) do update set calls=public.rpc_rate_buckets.calls+1;
  return true;
end;
$$;
revoke all on function public.allow_lobby_rpc(text,integer,integer) from public, anon, authenticated;

create function public.clean_public_nickname(p_raw text)
returns text language plpgsql immutable set search_path = public as $$
declare v_nick text := btrim(regexp_replace(normalize(normalize(coalesce(p_raw,''), NFC), NFKC), '[[:cntrl:]]', '', 'g'));
begin
  if char_length(v_nick) not between 2 and 12 or v_nick ~ '[0-9]{6,}'
     or v_nick ~ '0[0-9]{1,2}[-.[:space:]]?[0-9]{3,4}[-.[:space:]]?[0-9]{4}'
     or v_nick ~* '(@|https?://|www\.|[^[:space:]@/]+\.[a-z]{2,}(/|$))' then
    return null;
  end if;
  return v_nick;
end;
$$;
revoke all on function public.clean_public_nickname(text) from public, anon, authenticated;

create table public.question_keys (
  bank_version text not null, question_id text not null, revision integer not null check(revision > 0),
  correct_option text not null check(correct_option in ('a','b','c','d')),
  grade smallint not null check(grade between 3 and 6),
  primary key(bank_version,question_id,revision)
);
create table public.run_verification_rules (
  balance_version text not null, difficulty text not null, rules jsonb not null,
  primary key(balance_version,difficulty)
);
create table public.approved_run_conditions (
  bank_version text not null, grade smallint not null, balance_version text not null, map_id text not null, active boolean not null default true,
  primary key(bank_version,grade,balance_version,map_id)
);
alter table public.question_keys enable row level security;
alter table public.run_verification_rules enable row level security;
alter table public.approved_run_conditions enable row level security;
revoke all on public.question_keys,public.run_verification_rules,public.approved_run_conditions from public, anon, authenticated;

alter table public.completed_runs add column received_at timestamptz not null default now();
alter table public.completed_runs add column verification_level text not null default 'legacy_unverified';
alter table public.completed_runs add column map_id text;
alter table public.completed_runs add column payload_hash text;
alter table public.completed_runs drop constraint completed_runs_completed_wave_check;
create index completed_runs_owner_received on public.completed_runs(player_hash,received_at);
create index completed_runs_verified_league on public.completed_runs(grade,difficulty,pt desc,completed_wave desc,correct desc,received_at) where verification_level='question_regraded_combat_bounded';

/** 답안당 최초 선택은 encounterId로 구별한다. 순환 출제로 같은 문항이 다시 나올 수 있다. */
create function public.regrade_run_answers(p_bank text,p_grade smallint,p_answers jsonb,p_completed integer,p_ended integer,p_rules jsonb)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  a jsonb; v_key text; v_last_id integer:=0; v_last_wave integer:=0; v_last_phase text:='prep';
  v_id integer; v_wave integer; v_phase text; v_choice text; v_prep integer:=0;
  v_correct integer:=0; v_wrong integer:=0; v_skipped integer:=0; v_pt integer:=0;
begin
  if p_answers is null or jsonb_typeof(p_answers) <> 'array' or jsonb_array_length(p_answers)>1600 or octet_length(p_answers::text)>262144 then return null; end if;
  for a in select value from jsonb_array_elements(p_answers) loop
    if not (a ?& array['encounterId','questionId','revision','choice','phase','wave'])
       or jsonb_typeof(a->'encounterId') is distinct from 'number' or jsonb_typeof(a->'revision') is distinct from 'number' or jsonb_typeof(a->'wave') is distinct from 'number'
       or jsonb_typeof(a->'questionId') is distinct from 'string' or jsonb_typeof(a->'phase') is distinct from 'string' or jsonb_typeof(a->'choice') is distinct from 'string'
       or (a->>'encounterId') !~ '^[0-9]+$' or (a->>'revision') !~ '^[0-9]+$' or (a->>'wave') !~ '^[0-9]+$' then return null; end if;
    v_id:=(a->>'encounterId')::integer; v_wave:=(a->>'wave')::integer; v_phase:=a->>'phase'; v_choice:=a->>'choice';
    if v_id<=v_last_id or v_wave<greatest(v_last_wave,1) or v_wave>p_ended or v_phase not in ('prep','battle') or v_choice not in ('a','b','c','d','skipped') then return null; end if;
    if v_wave=v_last_wave and v_last_phase='battle' and v_phase='prep' then return null; end if;
    if v_wave<>v_last_wave then v_prep:=0; end if;
    if v_phase='battle' and v_prep<>(case when v_wave=1 then (p_rules->>'firstPrep')::integer else (p_rules->>'laterPrep')::integer end) then return null; end if;
    if v_phase='prep' then
      v_prep:=v_prep+1;
      if v_prep > (case when v_wave=1 then (p_rules->>'firstPrep')::integer else (p_rules->>'laterPrep')::integer end) then return null; end if;
    end if;
    select correct_option into v_key from public.question_keys where bank_version=p_bank and question_id=a->>'questionId' and revision=(a->>'revision')::integer and grade=p_grade;
    if v_key is null then return null; end if;
    if v_choice='skipped' then v_skipped:=v_skipped+1;
    elsif v_choice=v_key then v_correct:=v_correct+1; v_pt:=v_pt+(p_rules->>'correctPt')::integer;
    else v_wrong:=v_wrong+1; v_pt:=v_pt+(p_rules->>'wrongPt')::integer; end if;
    v_last_id:=v_id; v_last_wave:=v_wave; v_last_phase:=v_phase;
  end loop;
  -- 모든 완료 웨이브에는 정해진 준비 문항 최초 응답이 있어야 한다.
  for v_wave in 1..p_completed loop
    select count(*) into v_prep from jsonb_array_elements(p_answers) x where (x->>'wave')::integer=v_wave and x->>'phase'='prep';
    if v_prep <> (case when v_wave=1 then (p_rules->>'firstPrep')::integer else (p_rules->>'laterPrep')::integer end) then return null; end if;
  end loop;
  return jsonb_build_object('correct',v_correct,'wrong',v_wrong,'skipped',v_skipped,'questionPt',v_pt);
exception when invalid_text_representation or numeric_value_out_of_range then return null;
end;
$$;
revoke all on function public.regrade_run_answers(text,smallint,jsonb,integer,integer,jsonb) from public, anon, authenticated;

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
  if not public.allow_lobby_rpc('visit',60,2000) then return jsonb_build_object('error','RATE_LIMITED'); end if;
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
  if not public.allow_lobby_rpc('start',3,200) then return jsonb_build_object('error','RATE_LIMITED'); end if;
  select count(*) into v_recent
    from public.run_start_dedup
   where player_hash = v_hash
     and started_at > now() - interval '60 seconds';

  if v_recent >= 3 then
    return jsonb_build_object('counted', false, 'reason', 'RATE_LIMITED');
  end if;

  if exists(select 1 from public.run_start_dedup where run_id=p_run_id and player_hash<>v_hash) then return jsonb_build_object('error','OWNER_REJECTED'); end if;
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

create function public.submit_completed_run(
  p_run_id uuid,p_nickname text,p_grade smallint,p_difficulty text,p_pt integer,p_completed_wave smallint,
  p_correct smallint,p_wrong smallint,p_skipped smallint,p_content_mode text,p_balance_version text,p_bank_version text,
  p_map_id text,p_ended_at timestamptz,p_ended_at_wave smallint,p_answers jsonb,p_active_ticks bigint
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_hash char(64):=public.private_player_hash(auth.uid()); v_clean text:=public.clean_public_nickname(p_nickname);
  v_start timestamptz; v_rules jsonb; v_score jsonb; v_kill bigint; v_min_ms bigint:=0; v_w integer; v_n integer; v_interval integer;
  v_ended timestamptz; v_honor integer; v_payload text; v_existing public.completed_runs%rowtype;
begin
  if not public.allow_lobby_rpc('submit',6,100) then return jsonb_build_object('error','RATE_LIMITED'); end if;
  if p_content_mode is distinct from 'published' then return jsonb_build_object('ok',true,'status','dev_mode_skipped'); end if;
  if v_clean is null then return jsonb_build_object('error','NICKNAME_REJECTED'); end if;
  if p_run_id is null or p_grade is null or p_difficulty is null or p_pt is null or p_completed_wave is null or p_correct is null or p_wrong is null or p_skipped is null or p_ended_at is null or p_ended_at_wave is null or p_active_ticks is null
     or p_completed_wave<1 or p_ended_at_wave not between p_completed_wave and p_completed_wave+1 or p_correct<0 or p_wrong<0 or p_skipped<0 or p_active_ticks<0 or p_active_ticks>9007199254740991 then
    return jsonb_build_object('error','PLAUSIBILITY_REJECTED');
  end if;
  if not exists(select 1 from public.approved_run_conditions where bank_version=p_bank_version and grade=p_grade and balance_version=p_balance_version and map_id=p_map_id and active) then return jsonb_build_object('error','VERSION_REJECTED'); end if;
  select rules into v_rules from public.run_verification_rules where balance_version=p_balance_version and difficulty=p_difficulty;
  if v_rules is null then return jsonb_build_object('error','VERSION_REJECTED'); end if;
  perform pg_advisory_xact_lock(hashtextextended(p_run_id::text,0));
  v_payload:=encode(digest(jsonb_build_array(p_run_id,v_clean,p_grade,p_difficulty,p_pt,p_completed_wave,p_correct,p_wrong,p_skipped,p_balance_version,p_bank_version,p_map_id,p_ended_at,p_ended_at_wave,p_answers,p_active_ticks)::text,'sha256'),'hex');
  select * into v_existing from public.completed_runs where run_id=p_run_id;
  if found then
    if v_existing.player_hash=v_hash and v_existing.payload_hash=v_payload then return jsonb_build_object('ok',true,'status','already_recorded','verificationLevel',v_existing.verification_level); end if;
    return jsonb_build_object('error','DUPLICATE_RUN_REJECTED');
  end if;
  select started_at into v_start from public.run_start_dedup where run_id=p_run_id and player_hash=v_hash;
  if v_start is null then return jsonb_build_object('error','START_REQUIRED'); end if;
  for v_w in 1..p_completed_wave loop
    v_n:=least((v_rules->>'countMax')::integer,(v_rules->>'countBase')::integer+((v_w-1)/(v_rules->>'countEvery')::integer)*(v_rules->>'countStep')::integer);
    v_interval:=coalesce((v_rules->'spawnOverrides'->>v_w::text)::integer,greatest((v_rules->>'spawnMin')::integer,(v_rules->>'spawnBase')::integer+(v_w-1)*(v_rules->>'spawnStep')::integer));
    v_min_ms:=v_min_ms+(v_n-1)*v_interval;
  end loop;
  if extract(epoch from now()-v_start)*1000<v_min_ms or p_active_ticks*1000/30<v_min_ms or p_active_ticks>ceil(extract(epoch from now()-v_start)*30)+300 then return jsonb_build_object('error','DURATION_REJECTED'); end if;
  if jsonb_typeof(p_answers)='array' then
    if jsonb_array_length(p_answers)>p_active_ticks/30+1 then return jsonb_build_object('error','ANSWER_MISMATCH'); end if;
  end if;
  v_score:=public.regrade_run_answers(p_bank_version,p_grade,p_answers,p_completed_wave,p_ended_at_wave,v_rules);
  if v_score is null or (v_score->>'correct')::integer<>p_correct or (v_score->>'wrong')::integer<>p_wrong or (v_score->>'skipped')::integer<>p_skipped then return jsonb_build_object('error','ANSWER_MISMATCH'); end if;
  v_kill:=p_pt::bigint-(v_score->>'questionPt')::bigint;
  if v_kill<0 or v_kill>p_ended_at_wave*(v_rules->>'waveKillPtCap')::integer+(p_ended_at_wave/(v_rules->>'bossEvery')::integer)*(v_rules->>'bossPt')::integer then return jsonb_build_object('error','PT_MISMATCH'); end if;
  v_ended:=greatest(now()-interval '7 days',least(p_ended_at,now()));
  v_honor:=least(5000,greatest(0,p_pt)::bigint*(case p_difficulty when 'Easy' then 80 when 'Hard' then 125 when 'Crazy' then 150 else 100 end)/100+p_completed_wave*15+p_correct*2);
  insert into public.completed_runs(run_id,player_hash,public_tag,nickname,grade,difficulty,pt,honor_pt,completed_wave,correct,wrong,skipped,content_mode,balance_version,bank_version,map_id,ended_at,received_at,week_key,kst_date,verification_level,payload_hash)
    values(p_run_id,v_hash,substr(v_hash,1,16),v_clean,p_grade,p_difficulty,p_pt,v_honor,p_completed_wave,p_correct,p_wrong,p_skipped,'published',p_balance_version,p_bank_version,p_map_id,v_ended,now(),public.kst_week_key(v_ended),(v_ended at time zone 'Asia/Seoul')::date,'question_regraded_combat_bounded',v_payload);
  return jsonb_build_object('ok',true,'status','recorded','verificationLevel','question_regraded_combat_bounded');
end;
$$;

create function public.get_leaderboard_slice(p_tab text,p_grade smallint,p_difficulty text,p_period text,p_limit integer default 8,p_offset integer default 0)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_me char(64):=public.private_player_hash(auth.uid()); v_result jsonb;
begin
  if not public.allow_lobby_rpc('ranking',120,10000) then return jsonb_build_object('error','RATE_LIMITED'); end if;
  if p_tab is null or p_grade is null or p_difficulty is null or p_period is null or p_limit is null or p_offset is null or p_tab not in ('single_score','best_wave','honor_points') or p_grade not in (0,3,4,5,6) or p_difficulty not in ('Easy','Normal','Hard','Crazy') or p_period not in ('weekly','season1','all_time') or p_limit not between 1 and 50 or p_offset not between 0 and 10000 then return null; end if;
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

revoke all on function public.record_lobby_visit(),public.record_run_start(uuid),public.submit_completed_run(uuid,text,smallint,text,integer,smallint,smallint,smallint,smallint,text,text,text,text,timestamptz,smallint,jsonb,bigint),public.get_leaderboard_slice(text,smallint,text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.record_lobby_visit(),public.record_run_start(uuid),public.submit_completed_run(uuid,text,smallint,text,integer,smallint,smallint,smallint,smallint,text,text,text,text,timestamptz,smallint,jsonb,bigint),public.get_leaderboard_slice(text,smallint,text,text,integer,integer) to authenticated;

create or replace function public.cleanup_ephemeral_lobby_hashes()
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.daily_visitor_hashes where kst_date < public.kst_today()-7;
  delete from public.run_start_dedup where kst_date < public.kst_today()-7;
  delete from public.rpc_rate_buckets where expires_at < now();
end;
$$;
revoke all on function public.cleanup_ephemeral_lobby_hashes() from public, anon, authenticated;
