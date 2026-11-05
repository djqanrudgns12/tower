\set ON_ERROR_STOP on
begin;
select set_config('app.player_salt','local-test-salt-not-for-production',false);
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
insert into public.question_keys values('test-bank','q-a',1,'a',3);
insert into public.approved_run_conditions(bank_version,grade,balance_version,map_id) values('test-bank',3,'test-balance','garden_u');
insert into public.run_verification_rules select 'test-balance','Normal',rules from public.run_verification_rules where difficulty='Normal' limit 1;
create function pg_temp.submit_test(p_id uuid,p_pt integer default 67,p_correct smallint default 3) returns jsonb language sql as $$
  select public.submit_completed_run(p_id,'솔방울',3::smallint,'Normal',p_pt,1::smallint,p_correct,1::smallint,1::smallint,'published','test-balance','test-bank','garden_u',now()-interval '8 days',1::smallint,
  '[{"encounterId":1,"questionId":"q-a","revision":1,"choice":"a","phase":"prep","wave":1},{"encounterId":2,"questionId":"q-a","revision":1,"choice":"b","phase":"prep","wave":1},{"encounterId":3,"questionId":"q-a","revision":1,"choice":"skipped","phase":"prep","wave":1},{"encounterId":4,"questionId":"q-a","revision":1,"choice":"a","phase":"prep","wave":1},{"encounterId":5,"questionId":"q-a","revision":1,"choice":"a","phase":"prep","wave":1}]'::jsonb,3000::bigint);
$$;
do $$
declare r jsonb; id uuid:='22222222-2222-4222-8222-222222222222'; t timestamptz; score jsonb; rules jsonb;
begin
  if has_function_privilege('anon','public.record_lobby_visit()','execute') then raise exception 'anonymous RPC privilege'; end if;
  if to_regprocedure('public.record_lobby_visit(uuid)') is not null then raise exception 'legacy spoofable signature remains'; end if;
  if public.clean_public_nickname('１２３４５６') is not null or public.clean_public_nickname('a@b.kr') is not null or public.clean_public_nickname('a.com') is not null then raise exception 'nickname privacy'; end if;
  if public.clean_public_nickname('친구１２')<>'친구12' then raise exception 'nickname normalization'; end if;
  if public.clean_public_nickname(repeat('👨‍👩‍👧‍👦',2)) is null
     or public.clean_public_nickname(repeat('👨‍👩‍👧‍👦',12)) is null
     or public.clean_public_nickname('👨‍👩‍👧‍👦') is not null
     or public.clean_public_nickname(repeat('👨‍👩‍👧‍👦',13)) is not null then raise exception 'nickname grapheme bounds'; end if;
  if public.clean_public_nickname(U&'\FEFF솔\0085방울\1680') <> '솔방울' then raise exception 'nickname controls and trimming'; end if;
  r:=pg_temp.submit_test(id);
  if r->>'error'<>'START_REQUIRED' then raise exception 'missing start accepted: %',r; end if;
  perform public.record_run_start(id);
  r:=pg_temp.submit_test(id);
  if r->>'error'<>'DURATION_REJECTED' then raise exception 'short duration accepted: %',r; end if;
  update public.run_start_dedup set started_at=now()-interval '2 minutes' where run_id=id;
  r:=pg_temp.submit_test(id,67,4::smallint);
  if r->>'error'<>'ANSWER_MISMATCH' then raise exception 'counter mismatch accepted: %',r; end if;
  r:=pg_temp.submit_test(id,68);
  if r->>'error'<>'PT_MISMATCH' then raise exception 'kill cap mismatch accepted: %',r; end if;
  r:=pg_temp.submit_test(id);
  if r->>'ok'<>'true' then raise exception 'valid run rejected: %',r; end if;
  select received_at into t from public.completed_runs where run_id=id;
  r:=pg_temp.submit_test(id);
  if r->>'status'<>'already_recorded' then raise exception 'idempotence: %',r; end if;
  if (select count(*) from public.completed_runs where run_id=id)<>1 or (select received_at from public.completed_runs where run_id=id)<>t then raise exception 'duplicate altered receipt'; end if;
  if (select local_ended_at from public.completed_runs where run_id=id)<>now()-interval '8 days' then raise exception 'original local endedAt lost'; end if;
  if (select ended_at from public.completed_runs where run_id=id)<>now()-interval '7 days' then raise exception 'endedAt clamp'; end if;
  select x.rules into rules from public.run_verification_rules x where difficulty='Normal' limit 1;
  score:=public.regrade_run_answers('test-bank',3::smallint,'[{"encounterId":1,"questionId":"q-a","revision":1,"choice":null,"phase":"prep","wave":1}]',1,1,rules);
  if score is not null then raise exception 'null answer accepted'; end if;
  perform set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false);
  r:=pg_temp.submit_test(id);
  if r->>'error'<>'DUPLICATE_RUN_REJECTED' then raise exception 'spoofed owner accepted: %',r; end if;
  r:=public.get_leaderboard_slice('single_score',3::smallint,'Normal','all_time',8,0);
  if r->'myEntry'<>'null'::jsonb or (r->'entries'->0->>'isMe')::boolean then raise exception 'other owner marked me: %',r; end if;
  -- 사용자 단위 분당·일당 상한은 각각 검사하고 다른 사용자는 영향을 받지 않는다.
  if not public.allow_lobby_rpc('test-rate',1,100) or public.allow_lobby_rpc('test-rate',1,100) then raise exception 'minute rate'; end if;
  if not public.allow_lobby_rpc('test-day',100,1) or public.allow_lobby_rpc('test-day',100,1) then raise exception 'day rate'; end if;
  if public.get_leaderboard_slice('single_score',3::smallint,'Normal','all_time',null,0)->>'error' is distinct from 'INVALID_QUERY' then raise exception 'null limit accepted'; end if;
  perform set_config('app.player_salt','',false);
  begin perform public.record_lobby_visit(); raise exception 'missing salt accepted'; exception when others then if sqlerrm='missing salt accepted' then raise; end if; end;
end;
$$;
rollback;
\echo 'WP-NET SQL regression PASS: ownership, privileges, nickname, duration, scoring, idempotence, receipt, clamp, salt'
