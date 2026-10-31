\set ON_ERROR_STOP on
begin;
select set_config('app.player_salt','local-test-salt-not-for-production',true);
select set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',true);
do $$
declare r jsonb; headers jsonb; retry_seconds integer; action_name text; minute_limit integer; day_limit integer;
begin
  for action_name,minute_limit,day_limit in values ('visit',60,2000),('start',3,200),('submit',6,100),('ranking',120,10000) loop
    insert into public.rpc_rate_buckets values(public.private_player_hash(auth.uid()), action_name,
      'minute:'||to_char(now() at time zone 'UTC','YYYYMMDDHH24MI'),minute_limit,now()+interval '2 days');
    perform set_config('response.status','',true);
    case action_name
      when 'visit' then r:=public.record_lobby_visit();
      when 'start' then r:=public.record_run_start('55555555-5555-4555-8555-555555555555');
      when 'submit' then r:=public.submit_completed_run(null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null);
      else r:=public.get_leaderboard_slice('single_score',3::smallint,'Normal','all_time');
    end case;
    if r->>'error' is distinct from 'RATE_LIMITED' or current_setting('response.status',true) is distinct from '429' then raise exception '% must return HTTP 429: %',action_name,r; end if;
    headers:=current_setting('response.headers',true)::jsonb;
    if not exists(select 1 from jsonb_array_elements(headers) h where h->>'Access-Control-Expose-Headers' like '%Retry-After%') then raise exception 'Retry-After must be readable across origins'; end if;
    retry_seconds:=(headers->0->>'Retry-After')::integer;
    if retry_seconds is null or retry_seconds not between 1 and 60 then raise exception 'minute Retry-After: %',headers; end if;
  end loop;
  delete from public.rpc_rate_buckets;
  insert into public.rpc_rate_buckets values(public.private_player_hash(auth.uid()),'visit','day:'||public.kst_today()::text,2000,now()+interval '2 days');
  perform public.record_lobby_visit();
  retry_seconds:=(current_setting('response.headers',true)::jsonb->0->>'Retry-After')::integer;
  if retry_seconds is null or retry_seconds not between 1 and 86400 then raise exception 'daily Retry-After'; end if;
  if retry_seconds <> greatest(1,ceil(extract(epoch from (((now() at time zone 'Asia/Seoul')::date+1)::timestamp at time zone 'Asia/Seoul')-now()))::integer) then raise exception 'day limit must wait until KST midnight'; end if;
  delete from public.rpc_rate_buckets;
  r:=public.record_run_start(null);
  if r->>'error' is distinct from 'INVALID_RUN_ID' or current_setting('response.status',true)<>'422' then raise exception 'invalid start status'; end if;
  r:=public.get_leaderboard_slice('single_score',3::smallint,'Normal','all_time',null,0);
  if r->>'error' is distinct from 'INVALID_QUERY' or current_setting('response.status',true)<>'422' then raise exception 'invalid ranking status'; end if;
  if has_function_privilege('authenticated','public.lobby_rpc_failure(text,integer,integer)','execute') then raise exception 'failure helper exposed'; end if;
  perform set_config('app.player_salt','',true);
  begin
    perform public.record_lobby_visit();
    raise exception 'missing salt accepted';
  exception when sqlstate 'PT503' then null;
  end;
end;
$$;
rollback;
\echo 'WP-NET HTTP failure regression PASS: 429, Retry-After minute/day, 422, helper privileges, salt 503'
