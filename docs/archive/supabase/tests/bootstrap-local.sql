\set ON_ERROR_STOP on
-- 로컬 PostgreSQL 전용 fixture. 실제 Supabase 인증 서버를 대체 검증하지 않는다.
do $$ begin create role anon nologin; exception when duplicate_object then null; end; $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end; $$;
create schema auth;
create schema extensions;
create extension pgcrypto with schema public;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

set search_path = public, extensions;
