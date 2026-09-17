/* Executes the actual app.js admission functions in two isolated JS contexts.
 * Transport is simulated; this does not test real ICE/NAT or browser permissions. */
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {EventEmitter} = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {webcrypto} = require('node:crypto');
const source = fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
const names = ['CONFIG','state','dom','initializeHost','initializeGuest','connectToHost','requestRoomAdmission','confirmRoomReady','setupHostControlConnection','setupGuestControlConnection','extractRoomCodeInput','normalizeRoomCode','formatRoomCode','isValidRoomCode','roomPeerId','createInviteUrl','applyInviteFromHash','sessionErrorMessage','handleGuestControlMessage','init'];
const transport = () => {
 const peers = new Map(); let sequence=0;
 class Connection extends EventEmitter {
  constructor(peer,metadata){super();this.peer=peer;this.metadata=metadata;this.open=false;}
  send(data){if(!this.open)throw new Error('closed');const clone=JSON.parse(JSON.stringify(data));queueMicrotask(()=>{if(this.remote.open)this.remote.emit('data',clone);});}
  close(){if(!this.open)return;this.open=false;this.emit('close');if(this.remote?.open){this.remote.open=false;this.remote.emit('close');}}
 }
 class Peer extends EventEmitter {
  constructor(id,options){super();this.id=id||`guest-${++sequence}`;this.options=options;this.destroyed=false;peers.set(this.id,this);queueMicrotask(()=>this.emit('open',this.id));}
  connect(id,options){
   const local=new Connection(id,options.metadata);const host=peers.get(id);
   if(!host){queueMicrotask(()=>this.emit('error',{type:'peer-unavailable',peer:id}));return local;}
   const remote=new Connection(this.id,options.metadata);local.remote=remote;remote.remote=local;
   queueMicrotask(()=>{host.emit('connection',remote);remote.open=true;remote.emit('open');local.open=true;local.emit('open');});return local;
  }
  destroy(){this.destroyed=true;peers.delete(this.id);}
 }
 return {Peer,Connection,peers};
};
function app(t, network=transport(), {href='https://example.test/cloak/',audio=true}={}) {
 const timers=new Set();const nodes=new Map();
 const node=()=>({value:'',hidden:false,disabled:false,textContent:'',dataset:{},children:[],classList:{add(){},remove(){},toggle(){},contains(){return false;}},setAttribute(){},removeAttribute(){},addEventListener(){},replaceChildren(){},focus(){},querySelector(){return node();},querySelectorAll(){return[];}});
 const context={console,URL,URLSearchParams,crypto:webcrypto,TextEncoder,TextDecoder,Uint8Array,Set,Map,WeakSet,Promise,
  document:{querySelector(s){if(!nodes.has(s))nodes.set(s,node());return nodes.get(s);},querySelectorAll(){return[];},body:node(),createElement:node},
  location:new URL(href),navigator:{onLine:true,mediaDevices:{}},localStorage:{getItem(){return null;}},sessionStorage:{getItem(){return null;},removeItem(){}},
  setTimeout(fn,ms){const timer=setTimeout(()=>{timers.delete(timer);fn();},ms===30000?25:ms===15000?150:ms);timers.add(timer);return timer;},
  clearTimeout(id){timers.delete(id);clearTimeout(id);},requestAnimationFrame(fn){return setTimeout(fn,0);},
  history:{replaceState(){}},Peer:network.Peer,
  CloakScreenAudio:audio?{configureCaptureHandle(){}}:undefined,
 };
 context.window=context;
 const overrides=['renderParticipants','saveActiveSession','showToast','enforceGuestVoicePolicy','answerPendingCalls','answerPendingScreenCalls','scheduleChatHistoryStep','resetMicrophoneControls','clearHostMemberReconnectTimer','placeMediaCall','updateMediaUnlockControl','scheduleHostMemberRemoval'].map(n=>`${n}=()=>{};`).join('\n');
 // UI/audio functions are stubbed; admission, validation and membership are production code.
 const instrumented=source.replace(/  init\(\);\s*\}\)\(\);\s*$/,`${overrides}\nwindow.testAPI={${names.join(',')}};})();`);
 assert.notEqual(instrumented,source);
 vm.runInNewContext(instrumented,context,{filename:'app.js'});
 t.after(()=>{for(const timer of timers)clearTimeout(timer);});
 return {...context.testAPI,network,context};
}
async function host(t,net) {
 const a=app(t,net);Object.assign(a.state,{mode:'create',displayName:'Anfitrião',roomName:'Sala de teste',roomCode:'ABCDEFGHJKLM',roomCapacity:5,guestsCanSpeak:true});
 await a.initializeHost();return a;
}
async function guest(t,net,code) {
 const a=app(t,net);Object.assign(a.state,{mode:'join',displayName:'Convidado',roomCode:code});
 await a.initializeGuest();return a;
}

test('bundled PeerJS has TURN relays and the app no longer replaces them with STUN-only configuration',t=>{
 const a=app(t);assert.equal(a.CONFIG.peerOptions.config,undefined);assert.equal(a.CONFIG.peerOptions.secure,true);
 const c={window:{},navigator:{userAgent:'Node test'},location:{protocol:'https:'},console,setTimeout,clearTimeout,TextEncoder,TextDecoder,Blob,FileReader:class{}};c.window.navigator=c.navigator;
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../vendor/peerjs.min.js'),'utf8'),c);
 assert.ok(c.window.peerjs.util.defaultConfig.iceServers.some(s=>[].concat(s.urls).some(u=>u.startsWith('turn:'))));
});
test('code, formatted code, pasted link and encoded link target the exact same peer',t=>{
 const a=app(t);for(const input of ['ABCDEFGHJKLM','abcd-efgh-jklm','https://example.test/cloak/#room=ABCDEFGHJKLM','https://example.test/cloak/?room=ABCD%2DEFGH%2DJKLM']) {
  const code=a.extractRoomCodeInput(input);assert.equal(code,'ABCDEFGHJKLM');assert.ok(a.isValidRoomCode(code));assert.equal(a.roomPeerId(code),'cloak-room-abcdefghjklm');
 }
});
test('invalid characters and extra characters are rejected instead of silently changing room',t=>{
 const a=app(t);for(const input of ['ABCDEFGHJKLMZZ','IABCDEFGHJKLM','https://example.test/no-invite','https://example.test/#room=%ZZ'])assert.equal(a.isValidRoomCode(a.extractRoomCodeInput(input)),false,input);
});
test('room creation and full guest admission join/accepted/ready/ready-ack succeed',async t=>{
 const net=transport(),h=await host(t,net),g=await guest(t,net,'ABCDEFGHJKLM');
 assert.equal(g.state.joined,true);assert.equal(h.state.participants.size,2);assert.equal(g.state.participants.size,2);
 assert.equal(g.state.roomName,'Sala de teste');assert.equal(h.state.pendingMembers.size,0);assert.equal(g.state.pendingJoin,null);assert.equal(g.state.pendingReady,null);
});
test('link to a room resolves to a successful admission',async t=>{
 const net=transport(),h=await host(t,net);const link=h.createInviteUrl();const helper=app(t,net,{href:link});helper.applyInviteFromHash();
 assert.equal(helper.dom.roomCode.value,'ABCD-EFGH-JKLM');const g=await guest(t,net,helper.extractRoomCodeInput(link));assert.equal(g.state.joined,true);
});
test('full room rejects the next guest with room-full, not timeout',async t=>{
 const net=transport(),h=await host(t,net);for(let i=0;i<4;i++)await guest(t,net,h.state.roomCode);
 await assert.rejects(guest(t,net,h.state.roomCode),e=>e.code==='room-full');assert.equal(h.state.participants.size,5);
});
test('unavailable host is distinguished from an ICE timeout',async t=>{
 const a=app(t),peer=new a.network.Peer('guest');
 await assert.rejects(a.connectToHost(peer,'absent'),e=>e.code==='room-not-found');
 const never=new EventEmitter();never.open=false;never.close=()=>{};peer.connect=()=>never;
 await assert.rejects(a.connectToHost(peer,'existing-but-unreachable'),e=>e.code==='rtc-timeout');
 assert.match(a.sessionErrorMessage({code:'rtc-timeout'}),/outra rede/);
});
test('closed channel or failed admission send rejects immediately',async t=>{
 const a=app(t);await assert.rejects(a.requestRoomAdmission({open:false}),e=>e.code==='connection-closed');assert.equal(a.state.pendingJoin,null);
 const peer=new EventEmitter(),conn=new EventEmitter();conn.close=()=>{};peer.connect=()=>{queueMicrotask(()=>conn.emit('close'));return conn;};
 await assert.rejects(a.connectToHost(peer,'host'),e=>e.code==='connection-closed');
});
test('version mismatch does not become a generic timeout',async t=>{
 const a=app(t),connection=new EventEmitter();connection.open=true;connection.send=()=>{};a.state.hostConnection=connection;a.setupGuestControlConnection(connection);
 const result=a.requestRoomAdmission(connection);connection.emit('data',{version:999,type:'rejected'});
 await assert.rejects(result,e=>e.code==='version-mismatch');
});
test('a rejection during the final ready step is handled',async t=>{
 const a=app(t),connection={open:true,send(){}};const pending=a.confirmRoomReady(connection);
 a.handleGuestControlMessage({type:'rejected',reason:'removed'},connection);await assert.rejects(pending,e=>e.code==='removed');assert.equal(a.state.pendingReady,null);
});
test('invalid connection metadata cannot admit a member by sending valid message fields',async t=>{
 const a=app(t),conn=new EventEmitter();conn.peer='guest';conn.metadata={};conn.open=true;conn.send=()=>{};conn.close=()=>{};a.state.roomCode='ABCDEFGHJKLM';a.setupHostControlConnection(conn);
 conn.emit('data',{type:'join',version:4,roomCode:a.state.roomCode,name:'Visitante',resumeToken:'a'.repeat(32)});assert.equal(a.state.pendingMembers.size,0);
});
test('missing optional screen audio file does not crash app startup',t=>{const a=app(t,transport(),{audio:false});assert.ok(a.initializeGuest);});
test('hash invitation takes precedence over a stale query code and generated invites remove that query',t=>{
 const a=app(t,transport(),{href:'https://example.test/cloak/?room=ZZZZZZZZZZZZ#room=ABCDEFGHJKLM'});
 assert.equal(a.extractRoomCodeInput(a.context.location.href),'ABCDEFGHJKLM');
 a.applyInviteFromHash();assert.equal(a.dom.roomCode.value,'ABCD-EFGH-JKLM');
 a.state.roomCode='ABCDEFGHJKLM';const url=new URL(a.createInviteUrl());
 assert.equal(url.searchParams.has('room'),false);assert.equal(url.hash,'#room=ABCDEFGHJKLM');
});
test('synchronous peer failure is caught and temporary peer listeners are removed',async t=>{
 const a=app(t),peer=new EventEmitter();let closed=false;
 peer.connect=()=>{peer.emit('error',{type:'peer-unavailable'});return{close(){closed=true;}};};
 await assert.rejects(a.connectToHost(peer,'host'),e=>e.code==='room-not-found');
 assert.equal(closed,true);assert.equal(peer.listenerCount('error'),0);assert.equal(peer.listenerCount('disconnected'),0);
});
test('already open transport is accepted without waiting for a second open event',async t=>{
 const a=app(t),peer=new EventEmitter(),conn=new EventEmitter();conn.open=true;peer.connect=()=>conn;
 assert.equal(await a.connectToHost(peer,'host'),conn);assert.equal(peer.listenerCount('error'),0);
});
