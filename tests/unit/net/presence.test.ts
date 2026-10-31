import { afterEach, describe, expect, it, vi } from 'vitest';
import { connectPresenceChannel } from '../../../src/persistence/lobbyClient';

class FakeSocket extends EventTarget {
  static OPEN=1;
  static latest:FakeSocket;
  readyState=1;
  sent: string[]=[];
  constructor(readonly url:string) {super(); FakeSocket.latest=this;}
  send(frame:string) {this.sent.push(frame);}
  close() {this.readyState=3;this.dispatchEvent(new Event('close'));}
  message(event:string,payload:unknown) {this.dispatchEvent(new MessageEvent('message',{data:JSON.stringify({event,payload})}));}
}
describe('익명 Presence',()=>{
  afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
  it('접속마다 임의 키를 보내고 metas 하나만 떠났을 때 남은 접속을 보존한다',()=>{
    vi.stubGlobal('localStorage',{getItem:()=>JSON.stringify({shareRecords:true})});
    vi.stubEnv('VITE_SUPABASE_URL','https://presence.example');vi.stubEnv('VITE_SUPABASE_ANON_KEY','public');
    vi.stubGlobal('WebSocket',FakeSocket);
    const counts:(number|null)[]=[];
    const disconnect=connectPresenceChannel('persistent-private-id',count=>counts.push(count));
    try {
      FakeSocket.latest.dispatchEvent(new Event('open'));
      const join=JSON.parse(FakeSocket.latest.sent[0]!);
      expect(join.payload.config.presence.key).not.toBe('persistent-private-id');
      expect(FakeSocket.latest.sent.join('')).not.toContain('persistent-private-id');
      FakeSocket.latest.message('presence_state',{self:{metas:[{phx_ref:'self'}]},other:{metas:[{phx_ref:'one'},{phx_ref:'two'}]}});
      FakeSocket.latest.message('presence_diff',{leaves:{other:{metas:[{phx_ref:'one'}]}}});
      FakeSocket.latest.message('presence_diff',{leaves:{other:{metas:[{phx_ref:'two'}]}}});
      expect(counts).toEqual([2,2,1]);
    } finally {disconnect();}
  });
  it('다른 탭에서 동의를 끄면 열린 연결을 닫고 이후 프레임을 반영하지 않는다', () => {
    let sharing=true; const browser=new EventTarget();
    vi.stubGlobal('window',browser);
    vi.stubGlobal('localStorage',{getItem:()=>JSON.stringify({shareRecords:sharing})});
    vi.stubEnv('VITE_SUPABASE_URL','https://presence.example');vi.stubEnv('VITE_SUPABASE_ANON_KEY','public');
    vi.stubGlobal('WebSocket',FakeSocket);
    const counts:(number|null)[]=[];
    const disconnect=connectPresenceChannel('private',count=>counts.push(count));
    try {
      FakeSocket.latest.dispatchEvent(new Event('open'));
      sharing=false; browser.dispatchEvent(new Event('storage'));
      expect(FakeSocket.latest.readyState).toBe(3);
      FakeSocket.latest.message('presence_state',{other:{metas:[{phx_ref:'one'}]}});
      expect(counts).toEqual([null]);
    } finally {disconnect();}
  });

});
