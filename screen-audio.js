/* Screen sound stays on its video element; microphone audio has its own call.
 * No Web Audio destination, local loopback or second audio element is created.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CloakScreenAudio = api;
})(typeof window === "undefined" ? this : window, function () {
  "use strict";
  const CAPTURE_HANDLE = "cloak-call-audio-v1";

  function configureCaptureHandle(devices, origin) {
    try {
      if (origin && origin !== "null") devices?.setCaptureHandleConfig?.({
        handle: CAPTURE_HANDLE, exposeOrigin: false, permittedOrigins: [origin],
      });
    } catch (_) { /* Optional browser protection; capture policy still applies. */ }
  }

  function captureOptions(video, enabled, supported = {}) {
    return {
      video: { ...video, ...(enabled ? { displaySurface: "browser" } : {}) },
      audio: enabled ? {
        suppressLocalAudioPlayback: false,
        ...(supported.restrictOwnAudio ? { restrictOwnAudio: true } : {}),
      } : false,
      systemAudio: enabled && supported.restrictOwnAudio ? "include" : "exclude",
      windowAudio: "window",
      preferCurrentTab: false,
      selfBrowserSurface: "exclude",
      // A new source requires another explicit capture and isolation check.
      surfaceSwitching: enabled ? "exclude" : "include",
    };
  }

  function isIsolated(videoTrack, audioTrack) {
    try {
      if (videoTrack?.getCaptureHandle?.()?.handle === CAPTURE_HANDLE) return false;
      const surface = videoTrack?.getSettings?.().displaySurface;
      if (surface === "browser") return true;
      return audioTrack?.getSettings?.().restrictOwnAudio === true;
    } catch (_) { return false; }
  }

  function selectCaptureAudio(capture, enabled) {
    const video = capture.getVideoTracks()[0];
    const tracks = capture.getAudioTracks();
    const selected = enabled ? tracks.find(track =>
      track.readyState === "live" && isIsolated(video, track)) : undefined;
    // Stop every unselected track, including when a browser ignores audio:false.
    tracks.forEach(track => { if (track !== selected) track.stop(); });
    return {
      tracks: selected ? [selected] : [],
      reason: !enabled ? "disabled" : selected ? "ready" : tracks.length ? "unsafe" : "unavailable",
    };
  }

  function createOutput(video, stream, { local = false, onChange = () => {}, onBlocked = () => {} } = {}) {
    let active = true;
    let enabled = false;
    let volume = 1;
    let blocked = false;
    let generation = 0;
    let boundTracks = [];
    let lastMuted;
    let lastVolume;
    const hasAudio = () => stream.getAudioTracks().some(track => track.readyState === "live");
    const snapshot = () => ({ enabled, volume, blocked, available: hasAudio(), local });
    const announce = () => { if (active) onChange(snapshot()); };
    function sync() {
      if (!active) return;
      lastMuted = local || !enabled || !hasAudio();
      lastVolume = volume;
      video.muted = lastMuted;
      video.volume = volume;
      if (lastMuted || volume === 0) { blocked = false; onBlocked(false); }
      announce();
    }
    async function play() {
      const request = ++generation;
      try {
        await video.play();
        if (!active || request !== generation) return;
        blocked = false; onBlocked(false); announce();
      } catch (_) {
        if (!active || request !== generation) return;
        blocked = !video.muted && volume > 0;
        onBlocked(blocked); announce();
      }
    }
    function bindTracks() {
      boundTracks.forEach(track => ["ended", "mute", "unmute"].forEach(event => track.removeEventListener(event, sync)));
      boundTracks = stream.getAudioTracks();
      boundTracks.forEach(track => ["ended", "mute", "unmute"].forEach(event => track.addEventListener(event, sync)));
      sync();
    }
    function playing() { if (active) { blocked = false; onBlocked(false); announce(); } }
    function nativeVolumeChange() {
      if (!active) return;
      // Native fullscreen controls act on the same output and keep custom UI in sync.
      if (video.muted === lastMuted && video.volume === lastVolume) return;
      volume = Math.max(0, Math.min(1, video.volume));
      enabled = !local && !video.muted && hasAudio();
      generation += 1;
      sync();
    }
    video.addEventListener("volumechange", nativeVolumeChange);
    video.addEventListener("playing", playing);
    stream.addEventListener("addtrack", bindTracks);
    stream.addEventListener("removetrack", bindTracks);
    bindTracks();
    return {
      snapshot,
      async toggle() {
        if (!active || local || !hasAudio()) return;
        enabled = blocked || !enabled;
        generation += 1;
        if (enabled && volume === 0) volume = 1;
        sync();
        if (enabled) await play();
      },
      setVolume(value) {
        if (!active || local) return;
        const number = Number(value);
        if (!Number.isFinite(number)) return;
        volume = Math.max(0, Math.min(1, number)); sync();
      },
      setStream(nextStream) {
        if (!active || stream === nextStream) return;
        stream.removeEventListener("addtrack", bindTracks);
        stream.removeEventListener("removetrack", bindTracks);
        stream = nextStream;
        video.srcObject = stream;
        stream.addEventListener("addtrack", bindTracks);
        stream.addEventListener("removetrack", bindTracks);
        bindTracks();
      },
      dispose() {
        if (!active) return;
        active = false; generation += 1;
        video.removeEventListener("volumechange", nativeVolumeChange);
        video.removeEventListener("playing", playing);
        stream.removeEventListener("addtrack", bindTracks);
        stream.removeEventListener("removetrack", bindTracks);
        boundTracks.forEach(track => ["ended", "mute", "unmute"].forEach(event => track.removeEventListener(event, sync)));
        video.muted = true;
        onBlocked(false);
      },
    };
  }
  return { captureOptions, selectCaptureAudio, isIsolated, createOutput, configureCaptureHandle };
});
