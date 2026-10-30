import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expireAccessToken, getAccessToken, getPublicRecordNotice, setPublicRecordNotice } from '../../../src/persistence/auth';
const env={url:'https://auth.example',anonKey:'public'};
describe('익명 인증 토큰',()=>{
  beforeEach(()=>{setPublicRecordNotice(null);const store=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(k:string)=>store.get(k)??null,setItem:(k:string,v:string)=>store.set(k,v)}); localStorage.setItem('vocabulary-td.settings',JSON.stringify({shareRecords:true}));});
  afterEach(()=>vi.unstubAllGlobals());
  it('익명 signup을 한 번만 보내고 저장된 사용자 JWT를 재사용한다',async()=>{
    const fetchSpy=vi.fn(async(url:string)=>{void url;return new Response(JSON.stringify({access_token:'jwt',refresh_token:'refresh',expires_in:3600}));});vi.stubGlobal('fetch',fetchSpy);
    expect(await Promise.all([getAccessToken(env),getAccessToken(env)])).toEqual(['jwt','jwt']);
    expect(await getAccessToken(env)).toBe('jwt');expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0]?.[0]).toBe('https://auth.example/auth/v1/signup');
  });
  it('토큰 저장이 차단되어도 같은 화면의 후속 요청은 같은 익명 소유자를 쓴다', async () => {
    const blockedEnv = { url: 'https://quota.example', anonKey: 'public' };
    const originalGet = localStorage.getItem.bind(localStorage);
    vi.stubGlobal('localStorage', {
      getItem: originalGet,
      setItem: () => { throw new DOMException('quota', 'QuotaExceededError'); },
    });
    const fetchSpy = vi.fn(async (url: string, init: RequestInit) => {
      expect(url.startsWith('https://quota.example/auth/v1/')).toBe(true);
      expect(init.method).toBe('POST');
      return new Response(JSON.stringify({
        access_token: 'memory-jwt', refresh_token: 'memory-refresh', expires_in: 3600,
      }));
    });
    vi.stubGlobal('fetch', fetchSpy);
    expect(await getAccessToken(blockedEnv)).toBe('memory-jwt');
    expect(await getAccessToken(blockedEnv)).toBe('memory-jwt');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expireAccessToken(blockedEnv);
    expect(await getAccessToken(blockedEnv)).toBe('memory-jwt');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy.mock.calls[1]?.[0]).toBe('https://quota.example/auth/v1/token?grant_type=refresh_token');
    const init = fetchSpy.mock.calls[1]?.[1];
    expect(JSON.parse(init?.body as string)).toEqual({ refresh_token: 'memory-refresh' });
  });
  it('영구 만료된 인증은 새 소유자를 만들지 않고 로컬 기록 보존 안내를 남긴다', async () => {
    localStorage.setItem('vocabulary-td.anonymousSession:https://auth.example', JSON.stringify({access_token:'expired',refresh_token:'saved',expires_at:0}));
    const fetchSpy=vi.fn(async()=>new Response('{}',{status:400}));vi.stubGlobal('fetch',fetchSpy);
    expect(await getAccessToken(env)).toBeNull();
    expect(getPublicRecordNotice()?.kind).toBe('auth_expired');
    expect(getPublicRecordNotice()?.message).toContain('이 기기 기록');
    expect(localStorage.getItem('vocabulary-td.anonymousSession:https://auth.example')).toContain('saved');
  });
  it('만료 시 refresh_token으로 갱신하고 일시 오류에서 소유자를 새로 만들지 않는다',async()=>{
    localStorage.setItem('vocabulary-td.anonymousSession:https://auth.example',JSON.stringify({access_token:'expired',refresh_token:'saved-refresh',expires_at:0}));
    const fetchSpy=vi.fn(async(url:string,init:RequestInit)=>{expect(url).toContain('token?grant_type=refresh_token'); expect(JSON.parse(init.body as string)).toEqual({refresh_token:'saved-refresh'});return new Response('{}',{status:503});});vi.stubGlobal('fetch',fetchSpy);
    expect(await getAccessToken(env)).toBeNull();expect(await getAccessToken(env)).toBeNull();expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
