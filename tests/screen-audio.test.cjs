const { test } = require('node:test');
const assert = require('node:assert/strict');
const audio = require('../screen-audio.js');

class Track extends EventTarget {
  constructor(kind, settings = {}) { super(); this.kind = kind; this.settings = settings; this.readyState = 'live'; this.stops = 0; }
  getSettings() { return this.settings; }
  stop() { this.stops++; this.readyState = 'ended'; }
  end() { this.stop(); this.dispatchEvent(new Event('ended')); }
}
class Stream extends EventTarget {
  constructor(tracks = []) { super(); this.tracks = tracks; }
  getAudioTracks() { return this.tracks.filter(t => t.kind === 'audio'); }
  getVideoTracks() { return this.tracks.filter(t => t.kind === 'video'); }
  add(track) { this.tracks.push(track); this.dispatchEvent(new Event('addtrack')); }
  remove(track) { this.tracks = this.tracks.filter(t => t !== track); this.dispatchEvent(new Event('removetrack')); }
}
class Video extends EventTarget {
  constructor() { super(); this.muted = false; this.volume = 1; this.plays = 0; this.playImpl = () => Promise.resolve(); }
  play() { this.plays++; return this.playImpl(); }
}
const fixture = (local = false) => {
  const video = new Video();
  const voice = new Video();
  const stream = new Stream([new Track('video'), new Track('audio')]);
  const states = [], blocked = [];
  const output = audio.createOutput(video, stream, { local, onChange:s=>states.push(s), onBlocked:b=>blocked.push(b) });
  return {video, voice, stream, states, blocked, output};
};

test('capture requests isolated source, never suppresses the presenter source audio', () => {
  const normal = audio.captureOptions({width:1280},true,{});
  assert.equal(normal.systemAudio,'exclude');
  assert.equal(normal.audio.suppressLocalAudioPlayback,false);
  assert.equal(normal.selfBrowserSurface,'exclude');
  assert.equal(normal.surfaceSwitching,'exclude');
  assert.equal(audio.captureOptions({},false,{}).audio,false);
  const supported = audio.captureOptions({},true,{restrictOwnAudio:true});
  assert.equal(supported.systemAudio,'include');
  assert.equal(supported.audio.restrictOwnAudio,true);
});
test('tab sends only one audio track, stopping duplicate sources', () => {
  const v=new Track('video',{displaySurface:'browser'}), a=new Track('audio'), b=new Track('audio');
  assert.deepEqual(audio.selectCaptureAudio(new Stream([v,a,b]),true),{tracks:[a],reason:'ready'});
  assert.equal(a.stops,0); assert.equal(b.stops,1); assert.equal(v.stops,0);
});
test('system and unknown sources are refused unless isolation is actually confirmed', () => {
  for(const surface of ['monitor','window',undefined]) {
    const a=new Track('audio');
    assert.equal(audio.selectCaptureAudio(new Stream([new Track('video',{displaySurface:surface}),a]),true).reason,'unsafe');
    assert.equal(a.stops,1);
    const isolated=new Track('audio',{restrictOwnAudio:true});
    assert.equal(audio.selectCaptureAudio(new Stream([new Track('video',{displaySurface:surface}),isolated]),true).reason,'ready');
  }
});
test('a captured Cloak tab is rejected even if it is a browser surface', () => {
  let config;
  audio.configureCaptureHandle({setCaptureHandleConfig:c=>{config=c;}},'https://example.test');
  const v=new Track('video',{displaySurface:'browser'}); v.getCaptureHandle=()=>({handle:config.handle});
  const a=new Track('audio');
  assert.equal(audio.selectCaptureAudio(new Stream([v,a]),true).reason,'unsafe');
  assert.equal(a.stops,1); assert.equal(config.exposeOrigin,false);
});
test('audio disabled or not provided is handled without stopping video', () => {
  const v=new Track('video',{displaySurface:'browser'}), a=new Track('audio');
  assert.equal(audio.selectCaptureAudio(new Stream([v,a]),false).reason,'disabled');
  assert.equal(a.stops,1); assert.equal(v.stops,0);
  assert.equal(audio.selectCaptureAudio(new Stream([v]),true).reason,'unavailable');
});
test('viewer opts into a single video output; voice volume stays independent', async () => {
  const {video,voice,output}=fixture();
  assert.equal(video.muted,true);
  await output.toggle();
  assert.equal(video.muted,false); assert.equal(video.plays,1);
  output.setVolume(.35);
  assert.equal(video.volume,.35); assert.equal(voice.volume,1); assert.equal(voice.muted,false);
  await output.toggle(); assert.equal(video.muted,true); assert.equal(video.plays,1);
});
test('presenter preview cannot be unmuted, including native volume events', async () => {
  const {video,output}=fixture(true);
  await output.toggle(); assert.equal(video.muted,true); assert.equal(video.plays,0);
  video.muted=false;video.dispatchEvent(new Event('volumechange')); assert.equal(video.muted,true);
});
test('autoplay failure offers retry without creating another output', async () => {
  const {video,output,blocked}=fixture();
  video.playImpl=()=>Promise.reject(new Error('NotAllowedError'));
  await output.toggle();assert.equal(output.snapshot().blocked,true);assert.equal(blocked.at(-1),true);
  video.playImpl=()=>Promise.resolve();await output.toggle();
  assert.equal(output.snapshot().blocked,false);assert.equal(video.muted,false);assert.equal(video.plays,2);
});
test('muting or disposal cancels stale playback rejection', async () => {
  for(const dispose of [false,true]) {
    const {video,output,blocked}=fixture();let reject;
    video.playImpl=()=>new Promise((_,r)=>{reject=r;});
    const pending=output.toggle();
    if(dispose)output.dispose();else await output.toggle();
    reject(new Error('late error'));await pending;
    assert.equal(blocked.at(-1),false);assert.equal(video.muted,true);
  }
});
test('late audio track is detected and removal silences output', async () => {
  const v=new Video(),s=new Stream(),out=audio.createOutput(v,s);
  await out.toggle();assert.equal(v.plays,0);assert.equal(out.snapshot().available,false);
  const track=new Track('audio');s.add(track);assert.equal(out.snapshot().available,true);
  await out.toggle();assert.equal(v.muted,false);
  s.remove(track);assert.equal(v.muted,true);assert.equal(out.snapshot().available,false);
});
test('stream replacement preserves chosen volume and listening state, detaches old listeners', async () => {
  const {video,stream,output,states}=fixture();await output.toggle();output.setVolume(.6);
  const next=new Stream([new Track('audio')]);output.setStream(next);
  assert.equal(video.srcObject,next);assert.equal(video.volume,.6);assert.equal(video.muted,false);
  const count=states.length;stream.add(new Track('audio'));assert.equal(states.length,count);
  next.getAudioTracks()[0].end();assert.equal(video.muted,true);
});
test('native controls synchronize with custom controls and disposal detaches listeners', async () => {
  const {video,stream,output,states}=fixture();
  video.muted=false;video.volume=.4;video.dispatchEvent(new Event('volumechange'));
  assert.equal(output.snapshot().enabled,true);assert.equal(output.snapshot().volume,.4);
  output.dispose();const count=states.length;
  stream.add(new Track('audio'));video.dispatchEvent(new Event('playing'));
  assert.equal(states.length,count);assert.equal(video.muted,true);
});
