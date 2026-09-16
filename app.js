(function () {
  "use strict";

  const screenAudio = window.CloakScreenAudio;
  screenAudio.configureCaptureHandle(navigator.mediaDevices, location.origin);

  const CONFIG = Object.freeze({
    protocolVersion: 4,
    maxParticipants: 30,
    defaultRoomCapacity: 5,
    allowedRoomCapacities: Object.freeze([5, 10, 15, 20, 25, 30]),
    maxRoomNameLength: 40,
    roomCodeLength: 12,
    roomAlphabet: "ABCDEFGHJKLMNPQRSTUVWXYZ23456789",
    peerPrefix: "cloak-room-",
    connectionTimeout: 12000,
    joinTimeout: 10000,
    pendingCallTimeout: 1800,
    maxChatLength: 300,
    maxChatMessages: 200,
    chatHistoryBatchSize: 5,
    chatRateLimit: 6,
    chatRateWindow: 10000,
    chatSendTimeout: 7000,
    messageSizeLimit: 32768,
    activeSessionKey: "cloak-active-room-v3",
    voiceProfileKey: "cloak-voice-profile-v1",
    screenShareProfileKey: "cloak-screen-share-profile-v1",
    activeSessionMaxAge: 45000,
    restoreRetryWindow: 45000,
    screenShareUploadBudget: 8000000,
    screenShareStatsInterval: 3000,
    peerOptions: {
      debug: 1,
      config: {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
        ],
        sdpSemantics: "unified-plan",
      },
    },
  });

  const SCREEN_SHARE_PROFILES = Object.freeze({
    480: Object.freeze({
      label: "480p",
      width: 854,
      height: 480,
      maxBitrates: Object.freeze({ 30: 900000, 60: 1400000 }),
      adaptiveScales: Object.freeze([1, 1, 1]),
    }),
    720: Object.freeze({
      label: "720p",
      width: 1280,
      height: 720,
      maxBitrates: Object.freeze({ 30: 2000000, 60: 3200000 }),
      adaptiveScales: Object.freeze([1, 1.5, 1.5]),
    }),
    1080: Object.freeze({
      label: "1080p",
      width: 1920,
      height: 1080,
      maxBitrates: Object.freeze({ 30: 3500000, 60: 5500000 }),
      adaptiveScales: Object.freeze([1, 1.5, 2.25]),
    }),
  });
  const SCREEN_SHARE_FRAME_RATES = Object.freeze([30, 60]);
  const DEFAULT_SCREEN_SHARE_SETTINGS = Object.freeze({
    quality: "720",
    frameRate: 30,
    shareAudio: true,
  });

  const ICON_PATHS = Object.freeze({
    microphoneOff: "src/icons/microphone%20red%20off.png",
    microphoneOn: "src/icons/microphone%20green%20on.png",
  });

  const VOICE_PRESETS = Object.freeze({
    natural: Object.freeze({
      label: "Natural",
      bass: 0,
      mid: 0,
      treble: 0,
      intensity: 0,
    }),
    thin: Object.freeze({
      label: "Fina",
      bass: -4,
      mid: 2,
      treble: 5,
      intensity: 78,
    }),
    deep: Object.freeze({
      label: "Grave",
      bass: 6,
      mid: 1,
      treble: -3,
      intensity: 78,
    }),
    robot: Object.freeze({
      label: "Robô",
      bass: -3,
      mid: 5,
      treble: 2,
      intensity: 86,
    }),
    electronic: Object.freeze({
      label: "Eletrônica",
      bass: 2,
      mid: -1,
      treble: 5,
      intensity: 74,
    }),
  });

  const dom = {
    brandLink: document.querySelector("#brand-link"),
    roomControls: document.querySelector("#room-controls"),
    roomMenuDialog: document.querySelector("#room-menu-dialog"),
    roomMenuBody: document.querySelector(".room-menu-body"),
    roomMenuClose: document.querySelector("#room-menu-close"),
    homeScreen: document.querySelector("#home-screen"),
    roomScreen: document.querySelector("#room-screen"),
    roomScreenTitle: document.querySelector("#room-screen-title"),
    roomLayout: document.querySelector(".room-layout"),
    homeForm: document.querySelector("#home-form"),
    displayName: document.querySelector("#display-name"),
    nameCounter: document.querySelector("#name-counter"),
    nameError: document.querySelector("#name-error"),
    roomCode: document.querySelector("#room-code"),
    codeError: document.querySelector("#code-error"),
    createRoomButton: document.querySelector("#create-room-button"),
    createRoomDialog: document.querySelector("#create-room-dialog"),
    createRoomForm: document.querySelector("#create-room-form"),
    createRoomClose: document.querySelector("#create-room-close"),
    cancelCreateRoom: document.querySelector("#cancel-create-room"),
    createRoomName: document.querySelector("#create-room-name"),
    createRoomNameCounter: document.querySelector("#create-room-name-counter"),
    createRoomNameError: document.querySelector("#create-room-name-error"),
    createRoomStatus: document.querySelector("#create-room-status"),
    allowParticipantVoice: document.querySelector("#allow-participant-voice"),
    joinRoomButton: document.querySelector("#join-room-button"),
    inviteArrival: document.querySelector("#invite-arrival"),
    roomTitle: document.querySelector("#room-title"),
    roomKicker: document.querySelector("#room-kicker"),
    roomCapacitySummary: document.querySelector("#room-capacity-summary"),
    roomVoicePolicySummary: document.querySelector(
      "#room-voice-policy-summary",
    ),
    sidebarRoomCode: document.querySelector("#sidebar-room-code"),
    connectionStatus: document.querySelector("#connection-status"),
    connectionStatusText: document.querySelector("#connection-status-text"),
    participantCount: document.querySelector("#participant-count"),
    capacityCount: document.querySelector("#capacity-count"),
    capacityLimit: document.querySelector("#capacity-limit"),
    participantsGrid: document.querySelector("#participants-grid"),
    waitingCard: document.querySelector("#waiting-card"),
    chatMessages: document.querySelector("#chat-messages"),
    chatEmpty: document.querySelector("#chat-empty"),
    chatForm: document.querySelector("#chat-form"),
    chatInput: document.querySelector("#chat-input"),
    chatCounter: document.querySelector("#chat-counter"),
    chatStatus: document.querySelector("#chat-status"),
    chatSendButton: document.querySelector("#chat-send-button"),
    chatNewMessagesButton: document.querySelector("#chat-new-messages-button"),
    emojiToggleButton: document.querySelector("#emoji-toggle-button"),
    emojiPicker: document.querySelector("#emoji-picker"),
    sidebarCodeButton: document.querySelector("#sidebar-code-button"),
    sidebarInviteButton: document.querySelector("#sidebar-invite-button"),
    roomMicrophoneSelect: document.querySelector("#room-microphone-select"),
    roomMicrophoneStatus: document.querySelector("#room-microphone-status"),
    copyInviteButton: document.querySelector("#copy-invite-button"),
    muteButton: document.querySelector("#mute-button"),
    muteButtonIcon: document.querySelector("#mute-button-icon"),
    muteButtonLabel: document.querySelector("#mute-button-label"),
    voiceEqualizerButton: document.querySelector("#voice-equalizer-button"),
    voiceEqualizerLabel: document.querySelector("#voice-equalizer-label"),
    screenShareButton: document.querySelector("#screen-share-button"),
    screenShareLabel: document.querySelector("#screen-share-label"),
    screenShareDialog: document.querySelector("#screen-share-dialog"),
    screenShareForm: document.querySelector("#screen-share-form"),
    screenShareCloseButton: document.querySelector(
      "#screen-share-close-button",
    ),
    screenShareCancelButton: document.querySelector(
      "#screen-share-cancel-button",
    ),
    screenShareQualityOptions: document.querySelector(
      "#screen-share-quality-options",
    ),
    screenShareFrameRate: document.querySelector("#screen-share-frame-rate"),
    screenShareAudio: document.querySelector("#screen-share-audio"),
    screenShareProfileSummary: document.querySelector(
      "#screen-share-profile-summary",
    ),
    screenShareStage: document.querySelector("#screen-share-stage"),
    screenShareGrid: document.querySelector("#screen-share-grid"),
    screenShareCount: document.querySelector("#screen-share-count"),
    leaveRoomButton: document.querySelector("#leave-room-button"),
    enableAudioButton: document.querySelector("#enable-audio-button"),
    remoteAudioContainer: document.querySelector("#remote-audio-container"),
    toastRegion: document.querySelector("#toast-region"),
    leaveDialog: document.querySelector("#leave-dialog"),
    leaveDialogDescription: document.querySelector("#leave-dialog-description"),
    removeParticipantDialog: document.querySelector(
      "#remove-participant-dialog",
    ),
    removeParticipantDescription: document.querySelector(
      "#remove-participant-description",
    ),
    equalizerDialog: document.querySelector("#equalizer-dialog"),
    equalizerCloseButton: document.querySelector("#equalizer-close-button"),
    voicePresets: document.querySelector("#voice-presets"),
    voiceBass: document.querySelector("#voice-bass"),
    voiceBassValue: document.querySelector("#voice-bass-value"),
    voiceMid: document.querySelector("#voice-mid"),
    voiceMidValue: document.querySelector("#voice-mid-value"),
    voiceTreble: document.querySelector("#voice-treble"),
    voiceTrebleValue: document.querySelector("#voice-treble-value"),
    voiceIntensity: document.querySelector("#voice-intensity"),
    voiceIntensityValue: document.querySelector("#voice-intensity-value"),
    voiceMonitorButton: document.querySelector("#voice-monitor-button"),
    voiceMonitorLabel: document.querySelector("#voice-monitor-label"),
    voiceResetButton: document.querySelector("#voice-reset-button"),
    voiceSaveDefaultButton: document.querySelector(
      "#voice-save-default-button",
    ),
    equalizerStatus: document.querySelector("#equalizer-status"),
  };

  const state = {
    mode: null,
    roomCode: "",
    displayName: "",
    roomName: "",
    roomCapacity: CONFIG.defaultRoomCapacity,
    guestsCanSpeak: true,
    peer: null,
    selfPeerId: "",
    hostPeerId: "",
    isHost: false,
    joined: false,
    leaving: false,
    entryInProgress: false,
    localStream: null,
    pendingLocalStream: null,
    silentStream: null,
    microphoneGranted: false,
    enteredWithMicrophone: false,
    muted: true,
    selectedAudioInputId: "",
    audioInputDevices: [],
    switchingMicrophone: false,
    deviceRefreshTimer: 0,
    mediaGeneration: 0,
    hostConnection: null,
    controlConnections: new Map(),
    pendingMembers: new Map(),
    participants: new Map(),
    mediaCalls: new Map(),
    outgoingMediaCalls: new WeakSet(),
    mediaRetryState: new Map(),
    pendingMediaCalls: new Map(),
    remoteAudios: new Map(),
    blockedRemoteMedia: new Set(),
    screenStream: null,
    screenCaptureGeneration: 0,
    screenShareStarting: false,
    screenShareDialogRestoreFocus: true,
    outgoingScreenCalls: new Map(),
    incomingScreenCalls: new Map(),
    pendingScreenCalls: new Map(),
    screenShareRetryState: new Map(),
    screenShareSettings: readStoredScreenShareSettings(),
    screenShareSenderStates: new Map(),
    screenShareAdaptiveLevels: new Map(),
    screenShareConnectionTimers: new Map(),
    screenShareStatsTimer: 0,
    remoteScreenVideos: new Map(),
    localScreenPreview: null,
    participantOutputSettings: new Map(),
    audioContext: null,
    voiceEngine: null,
    voiceEnginePromise: null,
    voiceEngineGeneration: 0,
    voiceWorkletPromise: null,
    voiceSettings: createNaturalVoiceSettings(),
    voiceMonitoring: false,
    voicePreparing: false,
    analysisNodes: new Map(),
    analysisFrame: 0,
    speakingPeers: new Set(),
    pendingJoin: null,
    pendingReady: null,
    reconnectTimer: 0,
    guestReconnectTimer: 0,
    guestReconnectGeneration: 0,
    guestReconnecting: false,
    restoring: false,
    pendingOfflineRestore: null,
    resumePeerId: "",
    resumeToken: "",
    memberResumeTokens: new Map(),
    blockedResumeTokens: new Set(),
    memberReconnectTimers: new Map(),
    pageHiding: false,
    chatMessages: [],
    chatSequence: 0,
    chatMessageSequences: new Set(),
    chatRateLimits: new Map(),
    chatHistoryTimers: new Set(),
    pendingChatSend: null,
    pendingRemovalPeerId: "",
    networkOffline: navigator.onLine === false,
  };

  function createNaturalVoiceSettings() {
    return {
      preset: "natural",
      bass: 0,
      mid: 0,
      treble: 0,
      intensity: 0,
    };
  }

  function clampVoiceValue(value, minimum, maximum, fallback = 0) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.min(maximum, Math.max(minimum, numeric));
  }

  function parseVoiceSettings(candidate) {
    if (!candidate || typeof candidate !== "object") return null;
    const preset = Object.prototype.hasOwnProperty.call(
      VOICE_PRESETS,
      candidate.preset,
    )
      ? candidate.preset
      : "natural";
    const recommended = VOICE_PRESETS[preset];
    return {
      preset,
      bass: clampVoiceValue(candidate.bass, -12, 12, recommended.bass),
      mid: clampVoiceValue(candidate.mid, -12, 12, recommended.mid),
      treble: clampVoiceValue(candidate.treble, -12, 12, recommended.treble),
      intensity: clampVoiceValue(
        candidate.intensity,
        0,
        100,
        recommended.intensity,
      ),
    };
  }

  function serializeVoiceSettings(settings) {
    const parsed = parseVoiceSettings(settings) || createNaturalVoiceSettings();
    return {
      preset: parsed.preset,
      bass: parsed.bass,
      mid: parsed.mid,
      treble: parsed.treble,
      intensity: parsed.intensity,
    };
  }

  function readStoredVoiceProfile() {
    try {
      const stored = JSON.parse(localStorage.getItem(CONFIG.voiceProfileKey));
      if (stored?.version !== 1) return createNaturalVoiceSettings();
      return (
        parseVoiceSettings(stored.settings) || createNaturalVoiceSettings()
      );
    } catch (_) {
      return createNaturalVoiceSettings();
    }
  }

  function storeVoiceProfile() {
    try {
      localStorage.setItem(
        CONFIG.voiceProfileKey,
        JSON.stringify({
          version: 1,
          settings: serializeVoiceSettings(state.voiceSettings),
        }),
      );
      return true;
    } catch (_) {
      return false;
    }
  }

  function init() {
    bindEvents();
    state.voiceSettings = readStoredVoiceProfile();
    syncVoiceEqualizerUI();
    updateNameCounter();
    resetChat();
    resetParticipantOutputSettings();
    updateScreenShareControl();
    applyInviteFromHash();
    const activeSession = readActiveSession();
    if (activeSession && navigator.onLine !== false) {
      void restoreActiveSession(activeSession);
    } else {
      showScreen("home");
      if (state.networkOffline) {
        if (activeSession) state.pendingOfflineRestore = activeSession;
        showToast(
          "Você está sem internet. O Cloak abriu normalmente, mas as salas exigem conexão.",
          "error",
        );
      }
    }
  }

  function readActiveSession() {
    try {
      const raw = sessionStorage.getItem(CONFIG.activeSessionKey);
      if (!raw) return null;
      const saved = JSON.parse(raw);
      const mode = saved?.mode;
      const roomCode = normalizeRoomCode(saved?.roomCode);
      const displayName = sanitizeName(saved?.displayName);
      const peerId = typeof saved?.peerId === "string" ? saved.peerId : "";
      const resumeToken = isValidResumeToken(saved?.resumeToken)
        ? saved.resumeToken
        : "";
      const age = Date.now() - Number(saved?.savedAt);
      const roomSettings = parseRoomSettings(saved?.room);
      if (
        saved?.version !== 3 ||
        !Number.isFinite(age) ||
        age < 0 ||
        age > CONFIG.activeSessionMaxAge ||
        !["create", "join"].includes(mode) ||
        !isValidRoomCode(roomCode) ||
        displayName.length < 2 ||
        displayName.length > 24 ||
        (mode === "join" &&
          (!isValidPeerId(peerId) || !isValidResumeToken(resumeToken))) ||
        !roomSettings
      ) {
        clearActiveSession();
        return null;
      }

      const rawMessages =
        mode === "create" && Array.isArray(saved.chatMessages)
          ? saved.chatMessages.slice(-CONFIG.maxChatMessages)
          : [];
      const chatMessages = rawMessages.map(parseChatMessage).filter(Boolean);
      const chatSequence = Number.isSafeInteger(saved.chatSequence)
        ? Math.max(0, saved.chatSequence)
        : 0;
      const reservedMembers =
        mode === "create" && Array.isArray(saved.reservedMembers)
          ? saved.reservedMembers
              .slice(0, roomSettings.capacity - 1)
              .map((reservation) => {
                const member = parseMember(reservation?.member);
                const token = isValidResumeToken(reservation?.resumeToken)
                  ? reservation.resumeToken
                  : "";
                if (!member || member.host || !token) return null;
                return { member, resumeToken: token };
              })
              .filter(Boolean)
          : [];
      return {
        savedAt: Number(saved.savedAt),
        mode,
        roomCode,
        displayName,
        peerId,
        resumeToken,
        roomName: roomSettings.name,
        roomCapacity: roomSettings.capacity,
        guestsCanSpeak: roomSettings.guestsCanSpeak,
        listener: Boolean(saved.listener),
        restoreMicrophone: Boolean(saved.restoreMicrophone ?? !saved.listener),
        muted: Boolean(saved.muted),
        selectedAudioInputId:
          typeof saved.selectedAudioInputId === "string"
            ? saved.selectedAudioInputId.slice(0, 512)
            : "",
        voiceSettings:
          parseVoiceSettings(saved.voiceSettings) || readStoredVoiceProfile(),
        chatMessages,
        chatSequence,
        reservedMembers,
        blockedResumeTokens:
          mode === "create" && Array.isArray(saved.blockedResumeTokens)
            ? saved.blockedResumeTokens
                .filter(isValidResumeToken)
                .slice(0, CONFIG.maxParticipants * 2)
            : [],
      };
    } catch (_) {
      clearActiveSession();
      return null;
    }
  }

  function saveActiveSession() {
    if (!state.joined || state.leaving || state.pageHiding) return;
    try {
      const snapshot = {
        version: 3,
        savedAt: Date.now(),
        mode: state.isHost ? "create" : "join",
        roomCode: state.roomCode,
        displayName: state.displayName,
        room: serializeRoomSettings(),
        peerId: state.selfPeerId,
        resumeToken: state.resumeToken,
        listener: getLocalListenerState(),
        restoreMicrophone: Boolean(
          state.microphoneGranted || state.enteredWithMicrophone,
        ),
        muted: state.muted,
        selectedAudioInputId: state.selectedAudioInputId,
        voiceSettings: serializeVoiceSettings(state.voiceSettings),
        chatMessages: state.isHost
          ? state.chatMessages.map(serializeChatMessage)
          : [],
        chatSequence: state.isHost ? state.chatSequence : 0,
        reservedMembers: state.isHost
          ? Array.from(state.participants.values())
              .filter((member) => member.peerId !== state.selfPeerId)
              .map((member) => ({
                member: serializeMember(member),
                resumeToken: state.memberResumeTokens.get(member.peerId) || "",
              }))
              .filter(
                (reservation) =>
                  isValidResumeToken(reservation.resumeToken) &&
                  !state.blockedResumeTokens.has(reservation.resumeToken),
              )
          : [],
        blockedResumeTokens: state.isHost
          ? Array.from(state.blockedResumeTokens)
          : [],
      };
      sessionStorage.setItem(CONFIG.activeSessionKey, JSON.stringify(snapshot));
    } catch (_) {
      // A recuperação é um aprimoramento; a sala continua funcionando sem ela.
    }
  }

  function clearActiveSession() {
    state.pendingOfflineRestore = null;
    try {
      sessionStorage.removeItem(CONFIG.activeSessionKey);
    } catch (_) {
      // O navegador pode bloquear o armazenamento da sessão.
    }
  }

  async function restoreActiveSession(saved) {
    state.restoring = true;
    state.mode = saved.mode;
    state.roomCode = saved.roomCode;
    state.displayName = saved.displayName;
    state.roomName = saved.roomName;
    state.roomCapacity = saved.roomCapacity;
    state.guestsCanSpeak = saved.guestsCanSpeak;
    state.blockedResumeTokens = new Set(saved.blockedResumeTokens || []);
    state.resumePeerId = saved.peerId;
    state.resumeToken = saved.resumeToken || generateResumeToken();
    state.isHost = saved.mode === "create";
    state.hostPeerId = roomPeerId(saved.roomCode);
    state.muted = saved.muted;
    state.voiceSettings =
      parseVoiceSettings(saved.voiceSettings) || readStoredVoiceProfile();
    syncVoiceEqualizerUI();
    dom.displayName.value = saved.displayName;
    dom.roomCode.value = formatRoomCode(saved.roomCode);
    updateNameCounter();

    stopSilentStream();
    state.silentStream = createSilentStream();
    state.localStream = state.silentStream;
    state.microphoneGranted = false;
    state.enteredWithMicrophone = false;
    updateRoomDetails();
    updateMuteControl();
    updateAudioInputSelectorState();
    syncVoiceEqualizerUI();
    setConnectionStatus("connecting", "Restaurando…");
    showScreen("room");
    document.title = `${state.roomName} — Cloak`;

    const deadline = Date.now() + CONFIG.restoreRetryWindow;
    let lastError = null;
    while (state.restoring && Date.now() < deadline) {
      try {
        if (saved.mode === "create") {
          await initializeHost();
          restoreHostReservations(saved.reservedMembers, saved.savedAt);
        } else {
          await initializeGuest();
        }

        if (!state.restoring) {
          closeNetworkConnections(true);
          return;
        }

        if (saved.mode === "create") {
          restoreHostChat(saved.chatMessages, saved.chatSequence);
        }
        await activateRoom();
        if (!state.restoring || !state.joined || state.leaving) {
          closeNetworkConnections(true);
          return;
        }
        state.restoring = false;
        updateMuteControl();
        updateAudioInputSelectorState();
        saveActiveSession();
        if (saved.restoreMicrophone)
          void restoreMicrophoneAfterReconnect(saved);
        return;
      } catch (error) {
        if (!state.restoring) {
          closeNetworkConnections(true);
          return;
        }
        if (error?.code === "removed" || error?.type === "removed") {
          state.restoring = false;
          clearActiveSession();
          closeNetworkConnections(true);
          resetMicrophoneControls();
          resetSessionIdentity();
          showScreen("home");
          showToast("Você foi removido pelo anfitrião.", "error");
          return;
        }
        lastError = error;
        closeNetworkConnections(false);
        state.restoring = true;
        state.mode = saved.mode;
        state.roomCode = saved.roomCode;
        state.displayName = saved.displayName;
        state.roomName = saved.roomName;
        state.roomCapacity = saved.roomCapacity;
        state.guestsCanSpeak = saved.guestsCanSpeak;
        state.blockedResumeTokens = new Set(saved.blockedResumeTokens || []);
        state.resumePeerId = saved.peerId;
        state.isHost = saved.mode === "create";
        state.hostPeerId = roomPeerId(saved.roomCode);
        setConnectionStatus("connecting", "Reconectando…");
        await waitForRetry(500);
      }
    }

    if (!state.restoring) return;

    clearActiveSession();
    closeNetworkConnections(true);
    resetMicrophoneControls();
    resetSessionIdentity();
    dom.displayName.value = saved.displayName;
    dom.roomCode.value = formatRoomCode(saved.roomCode);
    updateNameCounter();
    showScreen("home");
    document.title = "Cloak — Voz e tela em salas privadas";
    showToast(sessionErrorMessage(lastError), "error");
  }

  async function restoreSavedMicrophone(saved) {
    if (!state.joined || state.leaving || state.pageHiding) return false;
    const mediaGeneration = ++state.mediaGeneration;
    const expectedRoomCode = state.roomCode;
    const expectedPeerId = state.selfPeerId;
    const expectedResumeToken = state.resumeToken;
    if (!isSecureMicrophoneContext() || !navigator.mediaDevices?.getUserMedia) {
      state.muted = true;
      return false;
    }

    let stream = null;
    try {
      stream = await captureMicrophone(saved.selectedAudioInputId);
    } catch (error) {
      if (
        !isRestoredMicrophoneCurrent(
          mediaGeneration,
          expectedRoomCode,
          expectedPeerId,
          expectedResumeToken,
        )
      ) {
        return false;
      }
      if (
        !saved.selectedAudioInputId ||
        !["NotFoundError", "OverconstrainedError"].includes(error?.name)
      ) {
        state.muted = true;
        return false;
      }
      if (
        !isRestoredMicrophoneCurrent(
          mediaGeneration,
          expectedRoomCode,
          expectedPeerId,
          expectedResumeToken,
        )
      ) {
        return false;
      }
      try {
        stream = await captureMicrophone();
      } catch (_) {
        if (
          !isRestoredMicrophoneCurrent(
            mediaGeneration,
            expectedRoomCode,
            expectedPeerId,
            expectedResumeToken,
          )
        ) {
          return false;
        }
        state.muted = true;
        return false;
      }
    }

    if (
      !isRestoredMicrophoneCurrent(
        mediaGeneration,
        expectedRoomCode,
        expectedPeerId,
        expectedResumeToken,
      )
    ) {
      stream?.getTracks().forEach((item) => item.stop());
      return false;
    }

    const track = stream?.getAudioTracks()[0];
    if (!track || track.readyState !== "live") {
      stream?.getTracks().forEach((item) => item.stop());
      state.muted = true;
      return false;
    }

    state.voicePreparing = true;
    state.localStream = stream;
    state.microphoneGranted = true;
    state.enteredWithMicrophone = true;
    state.muted = saved.muted;
    track.enabled = !state.muted;
    watchLocalMicrophoneTrack(track);
    state.selectedAudioInputId = getTrackDeviceId(track);
    try {
      await ensureVoiceEngine(stream);
    } catch (_) {
      // A voz natural continua disponível quando o processamento não inicia.
    } finally {
      if (mediaGeneration === state.mediaGeneration)
        state.voicePreparing = false;
    }
    if (
      !isRestoredMicrophoneCurrent(
        mediaGeneration,
        expectedRoomCode,
        expectedPeerId,
        expectedResumeToken,
      )
    ) {
      if (state.voiceEngine?.inputStream === stream) detachVoiceInput(stream);
      stream.getTracks().forEach((item) => item.stop());
      return false;
    }
    syncLocalAudioGates();
    return true;
  }

  function isRestoredMicrophoneCurrent(
    generation,
    roomCode,
    peerId,
    resumeToken,
  ) {
    return (
      generation === state.mediaGeneration &&
      state.joined &&
      !state.leaving &&
      !state.pageHiding &&
      state.roomCode === roomCode &&
      state.selfPeerId === peerId &&
      state.resumeToken === resumeToken
    );
  }

  async function restoreMicrophoneAfterReconnect(saved) {
    const expectedRoomCode = state.roomCode;
    const expectedPeerId = state.selfPeerId;
    const expectedResumeToken = state.resumeToken;
    const restored = await restoreSavedMicrophone(saved);
    if (
      !state.joined ||
      state.leaving ||
      state.pageHiding ||
      state.roomCode !== expectedRoomCode ||
      state.selfPeerId !== expectedPeerId ||
      state.resumeToken !== expectedResumeToken
    ) {
      return;
    }
    updateMuteControl();
    updateAudioInputSelectorState();
    syncVoiceEqualizerUI();
    const self = state.participants.get(state.selfPeerId);
    if (self) {
      self.listener = getLocalListenerState();
      self.muted = self.listener ? true : state.muted;
      renderParticipants();
      sendLocalMemberState();
    }
    if (restored && state.microphoneGranted) {
      await publishMicrophoneTrackToRoom(true);
      await addAnalysisNode(
        state.selfPeerId,
        getProcessedVoiceStream() || state.localStream,
      );
      await refreshAudioInputDevices();
    }
    saveActiveSession();
  }

  async function publishMicrophoneTrackToRoom(recreateCalls = false) {
    const track = getPreferredVoiceTrack();
    if (!track || track.readyState !== "live") return;

    if (recreateCalls) {
      const peerIds = Array.from(state.participants.keys()).filter(
        (peerId) => peerId !== state.selfPeerId,
      );
      peerIds.forEach(closeMediaForPeer);
      if (!state.joined || state.leaving || track.readyState !== "live") return;
      peerIds.forEach(placeMediaCall);
      return;
    }

    const calls = Array.from(state.mediaCalls.entries());
    await Promise.allSettled(
      calls.map(async ([peerId, call]) => {
        if (state.mediaCalls.get(peerId) !== call) return;
        const sender = getAudioSender(call);
        if (!sender?.replaceTrack) {
          closeMediaForPeer(peerId);
          return;
        }
        try {
          await sender.replaceTrack(track);
        } catch (_) {
          if (state.mediaCalls.get(peerId) === call) closeMediaForPeer(peerId);
        }
      }),
    );

    if (!state.joined || state.leaving || track.readyState !== "live") return;
    state.participants.forEach((member, peerId) => {
      if (peerId !== state.selfPeerId && !state.mediaCalls.has(peerId)) {
        placeMediaCall(peerId);
      }
    });
  }

  function restoreHostChat(messages, savedSequence) {
    resetChat();
    const ordered = messages
      .slice(-CONFIG.maxChatMessages)
      .sort((left, right) => left.sequence - right.sequence);
    ordered.forEach(receiveChatMessage);
    const latestSequence = ordered.reduce(
      (latest, message) => Math.max(latest, message.sequence),
      0,
    );
    state.chatSequence = Math.max(latestSequence, savedSequence);
  }

  function waitForRetry(delay) {
    return new Promise((resolve) => window.setTimeout(resolve, delay));
  }

  function bindEvents() {
    dom.displayName.addEventListener("input", () => {
      updateNameCounter();
      clearFieldError(dom.displayName, dom.nameError);
    });

    dom.createRoomName.addEventListener("input", () => {
      updateCreateRoomNameCounter();
      clearFieldError(dom.createRoomName, dom.createRoomNameError);
      dom.createRoomStatus.textContent = "";
    });

    dom.roomCode.addEventListener("input", () => {
      const normalized = extractRoomCodeInput(dom.roomCode.value);
      dom.roomCode.value = formatRoomCode(normalized);
      clearFieldError(dom.roomCode, dom.codeError);
    });

    dom.createRoomButton.addEventListener("click", prepareCreateRoom);
    dom.createRoomForm.addEventListener("submit", confirmCreateRoom);
    dom.createRoomClose.addEventListener("click", closeCreateRoomDialog);
    dom.cancelCreateRoom.addEventListener("click", closeCreateRoomDialog);
    dom.homeForm.addEventListener("submit", prepareJoinRoom);
    dom.roomMicrophoneSelect.addEventListener(
      "change",
      handleMicrophoneSelection,
    );
    dom.sidebarCodeButton.addEventListener("click", copyRoomCode);
    dom.sidebarInviteButton.addEventListener("click", copyInviteLink);
    dom.copyInviteButton.addEventListener("click", openRoomMenuDialog);
    dom.roomMenuClose.addEventListener("click", closeRoomMenuDialog);
    dom.roomMenuDialog.addEventListener("close", finishRoomMenuDialogClose);
    dom.roomMenuDialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      closeRoomMenuDialog();
    });
    dom.roomMenuDialog.addEventListener("click", (event) => {
      if (event.target === dom.roomMenuDialog) closeRoomMenuDialog();
    });
    dom.muteButton.addEventListener("click", toggleMute);
    dom.voiceEqualizerButton.addEventListener("click", openVoiceEqualizer);
    dom.screenShareButton.addEventListener("click", toggleScreenShare);
    dom.screenShareForm.addEventListener(
      "submit",
      confirmScreenShareSettings,
    );
    dom.screenShareCloseButton.addEventListener("click", () =>
      closeScreenShareDialog(),
    );
    dom.screenShareCancelButton.addEventListener("click", () =>
      closeScreenShareDialog(),
    );
    dom.screenShareQualityOptions.addEventListener(
      "change",
      updateScreenShareProfileSummary,
    );
    dom.screenShareFrameRate.addEventListener(
      "change",
      updateScreenShareProfileSummary,
    );
    dom.screenShareDialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      closeScreenShareDialog();
    });
    dom.screenShareDialog.addEventListener("click", (event) => {
      if (event.target === dom.screenShareDialog) closeScreenShareDialog();
    });
    dom.screenShareDialog.addEventListener("close", () => {
      const restoreFocus = state.screenShareDialogRestoreFocus;
      state.screenShareDialogRestoreFocus = true;
      if (restoreFocus) focusScreenShareControl();
    });
    dom.equalizerCloseButton.addEventListener("click", () =>
      dom.equalizerDialog.close(),
    );
    dom.voicePresets.addEventListener("change", handleVoicePresetChange);
    [dom.voiceBass, dom.voiceMid, dom.voiceTreble, dom.voiceIntensity].forEach(
      (range) => {
        range.addEventListener("input", handleVoiceAdjustmentInput);
        range.addEventListener("change", announceVoiceAdjustment);
      },
    );
    dom.voiceMonitorButton.addEventListener("click", toggleVoiceMonitor);
    dom.voiceResetButton.addEventListener("click", resetVoiceEqualizer);
    dom.voiceSaveDefaultButton.addEventListener("click", saveVoiceProfile);
    dom.equalizerDialog.addEventListener("close", () => {
      stopVoiceMonitor();
      dom.equalizerStatus.textContent = "";
      dom.voiceEqualizerButton.focus();
    });
    dom.participantsGrid.addEventListener(
      "input",
      handleParticipantOutputInput,
    );
    dom.removeParticipantDialog.addEventListener("close", () => {
      const peerId = state.pendingRemovalPeerId;
      state.pendingRemovalPeerId = "";
      if (dom.removeParticipantDialog.returnValue === "confirm" && peerId) {
        kickParticipant(peerId);
        requestAnimationFrame(() => dom.participantsGrid.focus());
      }
    });
    dom.participantsGrid.addEventListener(
      "click",
      handleParticipantOutputClick,
    );
    dom.leaveRoomButton.addEventListener("click", openLeaveDialog);
    dom.enableAudioButton.addEventListener("click", unlockRemoteAudio);
    dom.chatForm.addEventListener("submit", handleChatSubmit);
    dom.chatInput.addEventListener("input", updateChatComposer);
    dom.chatInput.addEventListener("keydown", handleChatInputKeydown);
    dom.chatMessages.addEventListener("scroll", handleChatScroll);
    dom.chatNewMessagesButton.addEventListener("click", scrollChatToBottom);
    dom.emojiToggleButton.addEventListener("click", toggleEmojiPicker);
    dom.emojiPicker.addEventListener("click", handleEmojiSelection);
    dom.emojiPicker.addEventListener("keydown", handleEmojiPickerKeydown);
    document.addEventListener("click", handleDocumentClick);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) stopVoiceMonitor();
    });

    dom.leaveDialog.addEventListener("close", () => {
      if (dom.leaveDialog.returnValue === "confirm") {
        leaveCurrentRoom(true);
      }
    });

    dom.brandLink.addEventListener("click", (event) => {
      if (state.joined) {
        event.preventDefault();
        openLeaveDialog();
      }
    });

    window.addEventListener("online", () => {
      const connectionWasOffline = state.networkOffline;
      state.networkOffline = false;
      if (
        state.pendingOfflineRestore &&
        !state.joined &&
        !state.restoring &&
        !state.mode
      ) {
        const activeSession = readActiveSession();
        state.pendingOfflineRestore = null;
        if (activeSession) {
          showToast("Conexão restabelecida. Restaurando sua sala…");
          void restoreActiveSession(activeSession);
          return;
        }
      }
      if (state.joined && !state.guestReconnecting) {
        setConnectionStatus("connected", "Conectado");
      } else if (connectionWasOffline) {
        showToast("Conexão restabelecida.");
      }
    });

    window.addEventListener("offline", () => {
      state.networkOffline = true;
      if (state.joined) {
        setConnectionStatus("offline", "Sem conexão");
        showToast(
          "Sua conexão caiu. As chamadas podem ser interrompidas.",
          "error",
        );
      } else {
        showToast(
          "Você está sem internet. As salas exigem conexão.",
          "error",
        );
      }
    });

    window.addEventListener("hashchange", () => {
      if (!state.joined && !state.mode) {
        applyInviteFromHash();
      }
    });

    window.addEventListener("pagehide", () => {
      saveActiveSession();
      state.pageHiding = true;
      stopScreenShare(false);
      cancelAllMediaCapture();
    });
    window.addEventListener("pageshow", (event) => {
      if (event.persisted) location.reload();
    });
    document.addEventListener(
      "pointerdown",
      () => {
        if (state.joined && state.audioContext?.state === "suspended") {
          void resumeAudioContext();
        }
      },
      { passive: true },
    );

    if (navigator.mediaDevices?.addEventListener) {
      navigator.mediaDevices.addEventListener(
        "devicechange",
        scheduleAudioInputRefresh,
      );
    }
  }

  function prepareCreateRoom() {
    if (state.entryInProgress) return;
    if (navigator.onLine === false) {
      showToast("Conecte-se à internet para criar uma sala.", "error");
      return;
    }
    if (!validateName()) return;
    const displayName = sanitizeName(dom.displayName.value);
    if (!sanitizeRoomName(dom.createRoomName.value)) {
      dom.createRoomName.value = `Sala de ${displayName}`.slice(
        0,
        CONFIG.maxRoomNameLength,
      );
    }
    updateCreateRoomNameCounter();
    clearFieldError(dom.createRoomName, dom.createRoomNameError);
    dom.createRoomStatus.textContent = "";
    if (typeof dom.createRoomDialog.showModal === "function") {
      dom.createRoomDialog.showModal();
      requestAnimationFrame(() => dom.createRoomName.focus());
    } else {
      dom.createRoomDialog.setAttribute("open", "");
      dom.createRoomName.focus();
    }
  }

  function closeCreateRoomDialog() {
    if (typeof dom.createRoomDialog.close === "function") {
      dom.createRoomDialog.close();
    } else {
      dom.createRoomDialog.removeAttribute("open");
    }
    dom.createRoomButton.focus();
  }

  function confirmCreateRoom(event) {
    event.preventDefault();
    if (state.entryInProgress) return;
    if (navigator.onLine === false) {
      dom.createRoomStatus.textContent =
        "Conecte-se à internet para criar a sala.";
      return;
    }
    const roomName = sanitizeRoomName(dom.createRoomName.value);
    const selectedCapacity = dom.createRoomForm.querySelector(
      'input[name="roomCapacity"]:checked',
    );
    const roomCapacity = normalizeRoomCapacity(selectedCapacity?.value);
    if (roomName.length < 2 || roomName.length > CONFIG.maxRoomNameLength) {
      setFieldError(
        dom.createRoomName,
        dom.createRoomNameError,
        "Digite um nome para a sala entre 2 e 40 caracteres.",
      );
      dom.createRoomName.focus();
      return;
    }
    if (!roomCapacity) {
      dom.createRoomStatus.textContent =
        "Escolha um limite válido de participantes.";
      return;
    }

    state.mode = "create";
    state.displayName = sanitizeName(dom.displayName.value);
    state.roomName = roomName;
    state.roomCapacity = roomCapacity;
    state.guestsCanSpeak = Boolean(dom.allowParticipantVoice.checked);
    state.blockedResumeTokens.clear();
    state.roomCode = generateRoomCode();
    state.resumeToken = generateResumeToken();
    if (typeof dom.createRoomDialog.close === "function") {
      dom.createRoomDialog.close();
    } else {
      dom.createRoomDialog.removeAttribute("open");
    }
    void startPreparedSession(dom.createRoomButton);
  }

  function prepareJoinRoom(event) {
    event.preventDefault();
    if (state.entryInProgress) return;
    if (navigator.onLine === false) {
      showToast("Conecte-se à internet para entrar em uma sala.", "error");
      return;
    }
    const nameIsValid = validateName();
    const codeIsValid = validateCode();
    if (!nameIsValid || !codeIsValid) return;

    state.mode = "join";
    state.displayName = sanitizeName(dom.displayName.value);
    state.roomName = "Sala de voz";
    state.roomCapacity = CONFIG.defaultRoomCapacity;
    state.guestsCanSpeak = true;
    state.roomCode = extractRoomCodeInput(dom.roomCode.value);
    state.resumeToken = generateResumeToken();
    void startPreparedSession(dom.joinRoomButton);
  }

  function validateName() {
    const name = sanitizeName(dom.displayName.value);
    if (name.length < 2 || name.length > 24) {
      setFieldError(
        dom.displayName,
        dom.nameError,
        "Digite um nome entre 2 e 24 caracteres.",
      );
      dom.displayName.focus();
      return false;
    }
    return true;
  }

  function validateCode() {
    const code = extractRoomCodeInput(dom.roomCode.value);
    if (!isValidRoomCode(code)) {
      setFieldError(
        dom.roomCode,
        dom.codeError,
        "O código precisa ter 12 letras ou números. Você pode colar o convite completo.",
      );
      dom.roomCode.focus();
      return false;
    }
    return true;
  }

  function setFieldError(input, target, message) {
    input.setAttribute("aria-invalid", "true");
    target.textContent = message;
  }

  function clearFieldError(input, target) {
    input.removeAttribute("aria-invalid");
    target.textContent = "";
  }

  function updateNameCounter() {
    dom.nameCounter.textContent = `${Array.from(dom.displayName.value).length}/24`;
  }

  function updateCreateRoomNameCounter() {
    dom.createRoomNameCounter.textContent = `${Array.from(dom.createRoomName.value).length}/${CONFIG.maxRoomNameLength}`;
  }

  async function requestMicrophone() {
    if (
      !state.joined ||
      state.leaving ||
      state.pageHiding ||
      state.switchingMicrophone ||
      state.microphoneGranted ||
      !isLocalVoiceAllowed()
    ) {
      return false;
    }

    if (!isSecureMicrophoneContext()) {
      reportMicrophoneActivationError(
        "O microfone exige uma conexão segura. Abra o Cloak por HTTPS ou em localhost.",
      );
      return false;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      reportMicrophoneActivationError(
        "Este navegador não oferece acesso ao microfone. Tente uma versão recente do Chrome, Edge, Firefox ou Safari.",
      );
      return false;
    }

    return switchMicrophone("");
  }

  function captureMicrophone(deviceId = "") {
    const audio = {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    };

    if (deviceId) audio.deviceId = { exact: deviceId };
    return navigator.mediaDevices.getUserMedia({ video: false, audio });
  }

  async function handleMicrophoneSelection(event) {
    const deviceId = event.currentTarget.value;
    if (!deviceId || deviceId === state.selectedAudioInputId) {
      synchronizeAudioInputSelectors();
      return;
    }

    await switchMicrophone(deviceId);
  }

  async function switchMicrophone(deviceId = "") {
    const activating = !state.microphoneGranted;
    if (
      state.switchingMicrophone ||
      !state.joined ||
      state.leaving ||
      state.pageHiding ||
      !isLocalVoiceAllowed() ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      synchronizeAudioInputSelectors();
      return false;
    }

    const previousStream = state.localStream;
    const previousTrack = previousStream?.getAudioTracks()[0];
    const previousDeviceId = state.selectedAudioInputId;
    const previousMicrophoneGranted = state.microphoneGranted;
    const previousEnteredWithMicrophone = state.enteredWithMicrophone;
    const previousMuted = state.muted;
    const previousEngineStream = state.voiceEngine?.inputStream || null;
    const previousMember = state.participants.get(state.selfPeerId);
    const previousMemberState = previousMember
      ? { muted: previousMember.muted, listener: previousMember.listener }
      : null;
    const expectedRoomCode = state.roomCode;
    const expectedPeerId = state.selfPeerId;
    const mediaGeneration = ++state.mediaGeneration;
    let nextStream = null;

    const isCurrentRequest = () =>
      mediaGeneration === state.mediaGeneration &&
      state.joined &&
      !state.leaving &&
      !state.pageHiding &&
      state.roomCode === expectedRoomCode &&
      state.selfPeerId === expectedPeerId;

    state.switchingMicrophone = true;
    stopVoiceMonitor();
    updateAudioInputSelectorState();
    updateMuteControl();
    setAudioInputStatus(
      activating
        ? "Aguardando a permissão do navegador…"
        : "Trocando o microfone…",
    );

    try {
      nextStream = await captureMicrophone(deviceId);
      if (!isCurrentRequest()) {
        nextStream.getTracks().forEach((track) => track.stop());
        return false;
      }
      const nextTrack = nextStream.getAudioTracks()[0];
      if (!nextTrack || nextTrack.readyState !== "live") {
        throw createAppError("microphone-missing-track", "");
      }

      nextTrack.enabled = activating ? true : !previousMuted;
      watchLocalMicrophoneTrack(nextTrack);
      state.pendingLocalStream = nextStream;
      state.voicePreparing = true;
      try {
        await ensureVoiceEngine(nextStream);
      } catch (_) {
        // Compatibilidade: a voz natural continua usando a faixa do microfone.
      } finally {
        if (mediaGeneration === state.mediaGeneration)
          state.voicePreparing = false;
      }

      if (!isCurrentRequest()) {
        if (state.voiceEngine?.inputStream === nextStream) {
          if (previousMicrophoneGranted && previousTrack?.readyState === "live") {
            attachVoiceInput(state.voiceEngine, previousStream);
          } else {
            detachVoiceInput(nextStream);
          }
        }
        nextStream.getTracks().forEach((track) => track.stop());
        return false;
      }
      if (nextTrack.readyState !== "live") {
        throw createAppError("microphone-ended", "");
      }

      removeAnalysisNode(state.selfPeerId);
      state.localStream = nextStream;
      state.pendingLocalStream = null;
      state.selectedAudioInputId = getTrackDeviceId(nextTrack) || deviceId;
      state.microphoneGranted = true;
      state.enteredWithMicrophone = true;
      state.muted = activating ? false : previousMuted;
      syncLocalAudioGates();

      const self = state.participants.get(state.selfPeerId);
      if (self) {
        self.listener = false;
        self.muted = state.muted;
        updateMuteControl();
        renderParticipants();
        sendLocalMemberState();
      }

      await publishMicrophoneTrackToRoom(activating);
      await addAnalysisNode(
        state.selfPeerId,
        getProcessedVoiceStream() || nextStream,
      );
      await refreshAudioInputDevices();
      if (!isCurrentRequest() || nextTrack.readyState !== "live") {
        throw createAppError(
          !isCurrentRequest()
            ? "microphone-switch-cancelled"
            : "microphone-ended",
          "",
        );
      }

      if (previousStream === state.silentStream) {
        stopSilentStream();
      } else if (previousStream !== nextStream) {
        previousStream?.getTracks().forEach((track) => track.stop());
      }
      syncVoiceEqualizerUI();
      setAudioInputStatus(
        activating
          ? "Microfone ativado e pronto para usar na sala."
          : "Microfone alterado. A nova entrada já está sendo usada.",
      );
      saveActiveSession();
      showToast(
        activating
          ? "Microfone ativado com sucesso."
          : "Microfone alterado com sucesso.",
      );
      return true;
    } catch (error) {
      if (!isCurrentRequest()) {
        if (state.voiceEngine?.inputStream === nextStream) {
          if (
            previousEngineStream === previousStream &&
            previousMicrophoneGranted &&
            previousTrack?.readyState === "live"
          ) {
            attachVoiceInput(state.voiceEngine, previousStream);
          } else {
            detachVoiceInput(nextStream);
          }
        }
        nextStream?.getTracks().forEach((track) => track.stop());
        return false;
      }

      const rollbackTrack =
        previousMicrophoneGranted && previousTrack?.readyState === "live"
          ? previousTrack
          : null;
      if (state.voiceEngine?.inputStream === nextStream) {
        if (rollbackTrack) attachVoiceInput(state.voiceEngine, previousStream);
        else detachVoiceInput(nextStream);
      }

      state.pendingLocalStream = null;
      if (rollbackTrack) {
        state.localStream = previousStream;
      } else {
        if (!state.silentStream?.getAudioTracks().length) {
          stopSilentStream();
          state.silentStream = createSilentStream();
        }
        state.localStream = state.silentStream;
      }
      state.selectedAudioInputId = rollbackTrack ? previousDeviceId : "";
      state.microphoneGranted = Boolean(rollbackTrack);
      state.enteredWithMicrophone = previousEnteredWithMicrophone;
      state.muted = rollbackTrack ? previousMuted : true;
      syncLocalAudioGates();
      await publishCurrentVoiceTrackToCalls();
      nextStream?.getTracks().forEach((track) => track.stop());

      if (rollbackTrack) {
        await addAnalysisNode(
          state.selfPeerId,
          getProcessedVoiceStream() || previousStream,
        );
      }
      const self = state.participants.get(state.selfPeerId);
      if (self) {
        self.listener = rollbackTrack
          ? getLocalListenerState()
          : previousMemberState?.listener ?? true;
        self.muted = rollbackTrack ? previousMemberState?.muted ?? true : true;
        updateMuteControl();
        renderParticipants();
        sendLocalMemberState();
      }
      syncVoiceEqualizerUI();
      synchronizeAudioInputSelectors();
      const message = activating
        ? microphoneErrorMessage(error)
        : microphoneSwitchErrorMessage(error);
      reportMicrophoneActivationError(message);
      return false;
    } finally {
      if (mediaGeneration === state.mediaGeneration) {
        state.switchingMicrophone = false;
        updateAudioInputSelectorState();
        updateMuteControl();
      }
    }
  }

  function getAudioSender(call) {
    const connection = call?.peerConnection;
    if (!connection || typeof connection.getSenders !== "function") return null;

    const directSender = connection
      .getSenders()
      .find((sender) => sender.track?.kind === "audio");
    if (directSender) return directSender;

    if (typeof connection.getTransceivers !== "function") return null;
    return (
      connection
        .getTransceivers()
        .find(
          (transceiver) =>
            transceiver.sender && transceiver.receiver?.track?.kind === "audio",
        )?.sender || null
    );
  }

  function watchLocalMicrophoneTrack(track) {
    track.addEventListener(
      "ended",
      () => {
        const activeTrack = state.localStream?.getAudioTracks()[0];
        if (activeTrack !== track) return;
        const replacementTrack = state.pendingLocalStream?.getAudioTracks()[0];
        if (
          state.switchingMicrophone &&
          replacementTrack?.readyState === "live"
        ) {
          return;
        }
        handleLocalMicrophoneEnded();
      },
      { once: true },
    );
  }

  function getTrackDeviceId(track) {
    try {
      return track?.getSettings?.().deviceId || "";
    } catch (_) {
      return "";
    }
  }

  async function refreshAudioInputDevices() {
    if (
      !navigator.mediaDevices?.enumerateDevices ||
      !state.enteredWithMicrophone
    ) {
      updateAudioInputSelectorState();
      return;
    }

    const mediaGeneration = state.mediaGeneration;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      if (mediaGeneration !== state.mediaGeneration) return;
      state.audioInputDevices = devices.filter(
        (device) => device.kind === "audioinput" && device.deviceId,
      );

      const currentTrack = state.localStream?.getAudioTracks()[0];
      state.selectedAudioInputId =
        getTrackDeviceId(currentTrack) || state.selectedAudioInputId;
      populateAudioInputSelect(dom.roomMicrophoneSelect, currentTrack);
      synchronizeAudioInputSelectors();
      updateAudioInputSelectorState();
    } catch (_) {
      if (mediaGeneration !== state.mediaGeneration) return;
      setAudioInputStatus(
        "Não foi possível atualizar a lista de microfones.",
        true,
      );
    }
  }

  function populateAudioInputSelect(select, currentTrack) {
    const currentId = state.selectedAudioInputId;
    const currentLabel = currentTrack?.label || "Microfone atual";
    const fragment = document.createDocumentFragment();
    const hasCurrentDevice = state.audioInputDevices.some(
      (device) => device.deviceId === currentId,
    );

    if (currentId && !hasCurrentDevice) {
      fragment.appendChild(createAudioInputOption(currentId, currentLabel));
    }

    if (!currentId && state.audioInputDevices.length) {
      const currentOption = createAudioInputOption("", currentLabel);
      currentOption.selected = true;
      fragment.appendChild(currentOption);
    }

    if (!state.audioInputDevices.length) {
      fragment.appendChild(
        createAudioInputOption(
          currentId,
          currentLabel || "Nenhum microfone disponível",
        ),
      );
    } else {
      state.audioInputDevices.forEach((device, index) => {
        const label = device.label || `Microfone ${index + 1}`;
        fragment.appendChild(createAudioInputOption(device.deviceId, label));
      });
    }

    select.replaceChildren(fragment);
  }

  function createAudioInputOption(value, label) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    return option;
  }

  function synchronizeAudioInputSelectors() {
    if (
      state.selectedAudioInputId &&
      Array.from(dom.roomMicrophoneSelect.options).some(
        (option) => option.value === state.selectedAudioInputId,
      )
    ) {
      dom.roomMicrophoneSelect.value = state.selectedAudioInputId;
    }
  }

  function updateAudioInputSelectorState() {
    const voiceBlocked = !isLocalVoiceAllowed();
    const disabled =
      voiceBlocked ||
      !state.enteredWithMicrophone ||
      state.switchingMicrophone ||
      !state.audioInputDevices.length;
    dom.roomMicrophoneSelect.disabled = disabled;

    if (
      !state.enteredWithMicrophone &&
      (voiceBlocked || !dom.roomMicrophoneStatus.classList.contains("is-error"))
    ) {
      setAudioInputStatus(
        voiceBlocked
          ? "O anfitrião desativou o microfone dos participantes nesta sala."
          : "Use Ativar microfone nos controles da sala para permitir o acesso.",
      );
    }
  }

  function setAudioInputStatus(message, isError = false) {
    dom.roomMicrophoneStatus.textContent = message;
    dom.roomMicrophoneStatus.classList.toggle("is-error", isError);
  }

  function scheduleAudioInputRefresh() {
    clearTimeout(state.deviceRefreshTimer);
    state.deviceRefreshTimer = window.setTimeout(() => {
      if (state.enteredWithMicrophone) refreshAudioInputDevices();
    }, 250);
  }

  function microphoneSwitchErrorMessage(error) {
    if (error?.code === "microphone-switch-unsupported") {
      return "Este navegador não conseguiu trocar o microfone durante a chamada.";
    }
    if (
      error?.name === "NotFoundError" ||
      error?.name === "OverconstrainedError"
    ) {
      return "O microfone escolhido não está mais disponível.";
    }
    if (error?.name === "NotAllowedError") {
      return "O navegador bloqueou o acesso ao microfone escolhido.";
    }
    if (error?.name === "NotReadableError") {
      return "O microfone escolhido está sendo usado por outro aplicativo.";
    }
    if (!state.microphoneGranted) {
      return "Não foi possível ativar esse microfone. Escolha outra entrada de áudio.";
    }
    return "Não foi possível trocar o microfone. A entrada anterior continua ativa.";
  }

  function prepareListenerStream() {
    cancelAllMediaCapture();
    stopSilentStream();
    state.silentStream = createSilentStream();
    state.localStream = state.silentStream;
    state.microphoneGranted = false;
    state.enteredWithMicrophone = false;
    state.selectedAudioInputId = "";
    state.audioInputDevices = [];
    state.muted = true;
    resetMicrophoneControls();
  }

  async function startPreparedSession(triggerButton) {
    if (state.entryInProgress) return false;
    state.entryInProgress = true;
    const actionButton = triggerButton?.dataset
      ? triggerButton
      : state.mode === "create"
        ? dom.createRoomButton
        : dom.joinRoomButton;
    const entryMode = state.mode;
    prepareListenerStream();

    try {
      if (navigator.onLine === false) {
        throw createAppError(
          "offline",
          "Conecte-se à internet para acessar uma sala.",
        );
      }
      resetChat();
      setEntryActionsBusy(
        actionButton,
        true,
        state.mode === "create" ? "Criando sala…" : "Procurando sala…",
      );
      if (typeof window.Peer !== "function") {
        throw createAppError(
          "library-unavailable",
          "Não foi possível carregar o serviço de conexão.",
        );
      }

      if (
        typeof window.RTCPeerConnection !== "function" ||
        typeof window.MediaStream !== "function"
      ) {
        throw createAppError(
          "browser-incompatible",
          "Este navegador não oferece suporte ao chat de voz.",
        );
      }

      if (state.mode === "create") {
        await initializeHost();
      } else {
        await initializeGuest();
      }

      await activateRoom();
      setEntryActionsBusy(actionButton, false);
      await waitForRoomPaint();
      if (state.joined && !state.leaving && isLocalVoiceAllowed()) {
        void requestMicrophone();
      }
      return true;
    } catch (error) {
      closeNetworkConnections(true);
      resetMicrophoneControls();
      setEntryActionsBusy(actionButton, false);
      const message = sessionErrorMessage(error);
      if (entryMode === "join") {
        setFieldError(dom.roomCode, dom.codeError, message);
      }
      showScreen("home");
      showToast(message, "error");
      return false;
    } finally {
      state.entryInProgress = false;
    }
  }

  function waitForRoomPaint() {
    return new Promise((resolve) => {
      window.requestAnimationFrame(() =>
        window.requestAnimationFrame(resolve),
      );
    });
  }

  async function initializeHost() {
    state.isHost = true;
    if (!state.resumeToken) state.resumeToken = generateResumeToken();
    let lastError = null;

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const peerId = roomPeerId(state.roomCode);
      let peer = null;

      try {
        peer = await openPeer(peerId);
        state.peer = peer;
        state.selfPeerId = peer.id;
        state.hostPeerId = peer.id;
        attachPeerHandlers(peer);

        state.participants.set(peer.id, {
          peerId: peer.id,
          name: state.displayName,
          muted: state.muted,
          listener: getLocalListenerState(),
          host: true,
        });

        state.joined = true;
        return;
      } catch (error) {
        lastError = error;
        safeDestroyPeer(peer);

        if (
          error?.type === "unavailable-id" ||
          error?.code === "unavailable-id"
        ) {
          if (state.restoring) throw error;
          state.roomCode = generateRoomCode();
          continue;
        }

        throw error;
      }
    }

    throw (
      lastError ||
      createAppError("room-code-failed", "Não foi possível reservar um código.")
    );
  }

  async function initializeGuest() {
    state.isHost = false;
    if (!state.resumeToken) state.resumeToken = generateResumeToken();
    state.hostPeerId = roomPeerId(state.roomCode);

    const peer = await openPeer(state.restoring ? state.resumePeerId : "");
    state.peer = peer;
    state.selfPeerId = peer.id;
    attachPeerHandlers(peer);

    const connection = await connectToHost(peer, state.hostPeerId);
    state.hostConnection = connection;
    setupGuestControlConnection(connection);

    const response = await requestRoomAdmission(connection);
    applyRoomSettings(response.room);
    enforceGuestVoicePolicy();
    const members = parseMemberList(response.members, state.roomCapacity);

    if (
      !members.some(
        (member) => member.peerId === state.hostPeerId && member.host,
      )
    ) {
      throw createAppError(
        "invalid-room",
        "A resposta da sala não pôde ser validada.",
      );
    }

    state.participants.clear();
    const returnedPeerIds = new Set(members.map((member) => member.peerId));
    Array.from(state.participants.keys()).forEach((peerId) => {
      if (peerId !== state.selfPeerId && !returnedPeerIds.has(peerId)) {
        state.participants.delete(peerId);
        state.participantOutputSettings.delete(peerId);
        closeMediaForPeer(peerId);
      }
    });
    members.forEach((member) => state.participants.set(member.peerId, member));
    state.participants.set(state.selfPeerId, {
      peerId: state.selfPeerId,
      name: state.displayName,
      muted: getLocalListenerState() ? true : state.muted,
      listener: getLocalListenerState(),
      host: false,
    });

    await confirmRoomReady(connection);
    state.joined = true;
    state.participants.forEach((_, peerId) => {
      if (peerId !== state.selfPeerId) {
        answerPendingCalls(peerId);
        answerPendingScreenCalls(peerId);
      }
    });
  }

  function enforceGuestVoicePolicy() {
    if (state.isHost || state.guestsCanSpeak) return;
    stopVoiceMonitor();
    cancelAllMediaCapture();
    stopSilentStream();
    state.silentStream = createSilentStream();
    state.localStream = state.silentStream;
    state.microphoneGranted = false;
    state.enteredWithMicrophone = false;
    state.muted = true;
    state.selectedAudioInputId = "";
    updateMuteControl();
    updateAudioInputSelectorState();
    syncVoiceEqualizerUI();
  }

  function openPeer(id) {
    return new Promise((resolve, reject) => {
      let peer;
      let settled = false;
      let timer = 0;

      try {
        peer = new window.Peer(id || undefined, CONFIG.peerOptions);
      } catch (error) {
        reject(error);
        return;
      }

      const cleanup = () => {
        clearTimeout(timer);
        removeEmitterListener(peer, "open", handleOpen);
        removeEmitterListener(peer, "error", handleError);
      };

      const handleOpen = () => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(peer);
      };

      const handleError = (error) => {
        if (settled) return;
        settled = true;
        cleanup();
        safeDestroyPeer(peer);
        reject(error);
      };

      peer.on("open", handleOpen);
      peer.on("error", handleError);
      timer = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        safeDestroyPeer(peer);
        reject(
          createAppError("connection-timeout", "A conexão demorou demais."),
        );
      }, CONFIG.connectionTimeout);
    });
  }

  function connectToHost(peer, hostPeerId) {
    return new Promise((resolve, reject) => {
      let connection;
      let settled = false;
      let timer = 0;

      try {
        connection = peer.connect(hostPeerId, {
          reliable: true,
          serialization: "json",
          metadata: {
            type: "cloak-control",
            version: CONFIG.protocolVersion,
            roomCode: state.roomCode,
          },
        });
      } catch (error) {
        reject(error);
        return;
      }

      const cleanup = () => {
        clearTimeout(timer);
        removeEmitterListener(peer, "error", handlePeerError);
      };

      const fail = (error) => {
        if (settled) return;
        settled = true;
        cleanup();
        try {
          connection.close();
        } catch (_) {
          // A conexão já pode estar fechada.
        }
        reject(error);
      };

      const handlePeerError = (error) => {
        if (error?.type === "peer-unavailable") {
          fail(createAppError("room-not-found", "Sala não encontrada."));
        }
      };

      connection.on("open", () => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(connection);
      });
      connection.on("error", fail);
      peer.on("error", handlePeerError);

      timer = window.setTimeout(
        () => fail(createAppError("room-not-found", "Sala não encontrada.")),
        CONFIG.connectionTimeout,
      );
    });
  }

  function requestRoomAdmission(connection) {
    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => {
        if (state.pendingJoin) {
          state.pendingJoin = null;
          reject(
            createAppError("join-timeout", "A sala não respondeu a tempo."),
          );
        }
      }, CONFIG.joinTimeout);

      state.pendingJoin = {
        connection,
        resolve: (message) => {
          clearTimeout(timer);
          state.pendingJoin = null;
          resolve(message);
        },
        reject: (error) => {
          clearTimeout(timer);
          state.pendingJoin = null;
          reject(error);
        },
      };

      sendControl(connection, {
        type: "join",
        version: CONFIG.protocolVersion,
        roomCode: state.roomCode,
        name: state.displayName,
        muted: state.muted,
        listener: getLocalListenerState(),
        resumeToken: state.resumeToken,
      });
    });
  }

  function confirmRoomReady(connection) {
    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => {
        if (state.pendingReady?.connection !== connection) return;
        state.pendingReady = null;
        reject(createAppError("join-timeout", "A entrada não foi confirmada."));
      }, CONFIG.joinTimeout);

      state.pendingReady = {
        connection,
        resolve: () => {
          clearTimeout(timer);
          state.pendingReady = null;
          resolve();
        },
        reject: (error) => {
          clearTimeout(timer);
          state.pendingReady = null;
          reject(error);
        },
      };

      if (
        !sendControl(connection, {
          type: "ready",
          version: CONFIG.protocolVersion,
          roomCode: state.roomCode,
        })
      ) {
        state.pendingReady.reject(
          createAppError("connection-closed", "A conexão foi interrompida."),
        );
      }
    });
  }

  function attachPeerHandlers(peer) {
    peer.on("connection", (connection) => {
      if (state.isHost && state.joined) {
        setupHostControlConnection(connection);
      } else {
        rejectUnexpectedConnection(connection);
      }
    });

    peer.on("call", handleIncomingMediaCall);

    peer.on("disconnected", () => {
      if (!state.joined || state.leaving) return;
      setConnectionStatus("connecting", "Reconectando…");
      clearTimeout(state.reconnectTimer);
      state.reconnectTimer = window.setTimeout(() => {
        if (!peer.destroyed && peer.disconnected) {
          try {
            peer.reconnect();
          } catch (_) {
            setConnectionStatus("offline", "Sem conexão");
          }
        }
      }, 900);
    });

    peer.on("open", () => {
      if (state.joined && !state.leaving && !state.guestReconnecting) {
        clearTimeout(state.reconnectTimer);
        setConnectionStatus("connected", "Conectado");
        publishScreenShareToParticipants();
      }
    });

    peer.on("close", () => {
      if (state.joined && !state.leaving) {
        setConnectionStatus("offline", "Conexão encerrada");
      }
    });

    peer.on("error", (error) => {
      if (!state.joined || state.leaving || error?.type === "peer-unavailable")
        return;
      setConnectionStatus("offline", "Problema na conexão");
      showToast(peerErrorMessage(error), "error");
    });
  }

  function setupHostControlConnection(connection) {
    const metadata = connection.metadata || {};
    let joinTimer = 0;

    const reject = (reason, message) => {
      if (connection.open) {
        sendControl(connection, {
          type: "rejected",
          version: CONFIG.protocolVersion,
          reason,
          message,
        });
      }
      window.setTimeout(() => {
        try {
          connection.close();
        } catch (_) {
          // Sem ação necessária.
        }
      }, 120);
    };

    const beginAdmission = () => {
      if (
        metadata.type !== "cloak-control" ||
        metadata.version !== CONFIG.protocolVersion ||
        normalizeRoomCode(metadata.roomCode) !== state.roomCode
      ) {
        reject("invalid-room", "Convite inválido.");
        return;
      }

      joinTimer = window.setTimeout(
        () => reject("join-timeout", "A entrada não foi concluída."),
        CONFIG.joinTimeout,
      );
    };

    if (connection.open) beginAdmission();
    else connection.on("open", beginAdmission);

    connection.on("data", (message) => {
      if (!isSafeControlMessage(message)) return;
      handleHostControlMessage(
        connection,
        message,
        () => clearTimeout(joinTimer),
        reject,
      );
    });

    connection.on("close", () => {
      clearTimeout(joinTimer);
      const pending = state.pendingMembers.get(connection.peer);
      if (pending?.connection === connection) {
        clearTimeout(pending.readyTimer);
        state.pendingMembers.delete(connection.peer);
      }

      if (
        state.controlConnections.get(connection.peer) === connection &&
        !state.leaving
      ) {
        scheduleHostMemberRemoval(connection.peer, connection);
      }
    });

    connection.on("error", () => {
      if (
        state.controlConnections.get(connection.peer) === connection &&
        !state.leaving
      ) {
        scheduleHostMemberRemoval(connection.peer, connection);
      }
    });
  }

  function handleHostControlMessage(
    connection,
    message,
    clearJoinTimer,
    reject,
  ) {
    if (message.version !== CONFIG.protocolVersion) return;
    if (normalizeRoomCode(message.roomCode) !== state.roomCode) return;

    if (message.type === "join") {
      const existingMember = state.participants.get(connection.peer);
      const existingConnection = state.controlConnections.get(connection.peer);
      const resumeToken = isValidResumeToken(message.resumeToken)
        ? message.resumeToken
        : "";
      const expectedResumeToken = state.memberResumeTokens.get(connection.peer);
      const isResume = Boolean(
        existingMember &&
          !existingMember.host &&
          !existingConnection &&
          expectedResumeToken &&
          resumeToken === expectedResumeToken,
      );

      if (state.blockedResumeTokens.has(resumeToken)) {
        reject("removed", "Você foi removido desta sala.");
        return;
      }

      if (
        state.pendingMembers.has(connection.peer) ||
        (existingMember && !isResume)
      ) {
        reject("duplicate", "Esta pessoa já está na sala.");
        return;
      }

      if (
        !isResume &&
        state.participants.size + state.pendingMembers.size >=
          state.roomCapacity
      ) {
        reject("room-full", "A sala já está cheia.");
        return;
      }

      const name = sanitizeName(message.name);
      if (
        name.length < 2 ||
        name.length > 24 ||
        !isValidPeerId(connection.peer) ||
        !resumeToken
      ) {
        reject("invalid-member", "Os dados de entrada são inválidos.");
        return;
      }

      clearJoinTimer();
      const listener = !state.guestsCanSpeak || Boolean(message.listener);
      const member = {
        peerId: connection.peer,
        name,
        muted: listener ? true : Boolean(message.muted),
        listener,
        host: false,
      };

      const readyTimer = window.setTimeout(() => {
        state.pendingMembers.delete(connection.peer);
        reject("join-timeout", "A entrada não foi concluída.");
      }, CONFIG.joinTimeout);

      state.pendingMembers.set(connection.peer, {
        member,
        connection,
        readyTimer,
        resumeToken,
        resuming: isResume,
      });
      sendControl(connection, {
        type: "accepted",
        version: CONFIG.protocolVersion,
        roomCode: state.roomCode,
        room: serializeRoomSettings(),
        members: Array.from(state.participants.values()).map(serializeMember),
      });
      return;
    }

    const pending = state.pendingMembers.get(connection.peer);
    if (message.type === "ready" && pending?.connection === connection) {
      clearTimeout(pending.readyTimer);
      state.pendingMembers.delete(connection.peer);
      clearHostMemberReconnectTimer(connection.peer);

      const existingMembers = Array.from(state.participants.values()).filter(
        (member) => member.peerId !== connection.peer,
      );
      state.participants.set(connection.peer, pending.member);
      state.controlConnections.set(connection.peer, connection);
      state.memberResumeTokens.set(connection.peer, pending.resumeToken);
      sendControl(connection, {
        type: "ready-ack",
        version: CONFIG.protocolVersion,
        roomCode: state.roomCode,
      });
      scheduleChatHistoryStep(() => sendChatHistory(connection), 0);

      broadcastControl(
        {
          type: "member-added",
          version: CONFIG.protocolVersion,
          roomCode: state.roomCode,
          member: serializeMember(pending.member),
        },
        connection.peer,
      );

      const self = state.participants.get(state.selfPeerId);
      if (self && !self.listener) {
        placeMediaCall(connection.peer);
      }
      if (hasActiveScreenShare()) placeScreenShareCall(connection.peer);

      if (!pending.member.listener) {
        const listeners = existingMembers
          .filter((member) => member.listener)
          .map((member) => member.peerId);
        if (listeners.length) {
          sendControl(connection, {
            type: "initiate-calls",
            version: CONFIG.protocolVersion,
            roomCode: state.roomCode,
            peerIds: listeners,
          });
        }
      }

      renderParticipants();
      saveActiveSession();
      showToast(
        pending.resuming
          ? `${pending.member.name} voltou à sala.`
          : `${pending.member.name} entrou na sala.`,
      );
      return;
    }

    if (state.controlConnections.get(connection.peer) !== connection) return;

    if (message.type === "chat-send") {
      handleHostChatSend(connection, message.text, message.clientMessageId);
      return;
    }

    if (message.type === "state") {
      const member = state.participants.get(connection.peer);
      if (!member) return;
      member.listener = !state.guestsCanSpeak || Boolean(message.listener);
      member.muted = member.listener ? true : Boolean(message.muted);
      applyParticipantVoiceGate(member.peerId);
      broadcastControl({
        type: "member-state",
        version: CONFIG.protocolVersion,
        roomCode: state.roomCode,
        peerId: connection.peer,
        muted: member.muted,
        listener: member.listener,
      });
      renderParticipants();
      saveActiveSession();
      return;
    }

    if (message.type === "leave") {
      removeHostMember(connection.peer, true);
      return;
    }

    if (message.type === "ping") {
      sendControl(connection, {
        type: "pong",
        version: CONFIG.protocolVersion,
        roomCode: state.roomCode,
      });
    }
  }

  function setupGuestControlConnection(connection) {
    connection.on("data", (message) => {
      if (
        !isSafeControlMessage(message) ||
        message.version !== CONFIG.protocolVersion
      )
        return;
      if (
        message.roomCode &&
        normalizeRoomCode(message.roomCode) !== state.roomCode
      )
        return;
      handleGuestControlMessage(message, connection);
    });

    connection.on("close", () => {
      if (state.hostConnection !== connection) return;
      state.hostConnection = null;
      if (state.pendingReady?.connection === connection) {
        state.pendingReady.reject(
          createAppError("connection-closed", "A conexão foi interrompida."),
        );
      } else if (state.pendingJoin?.connection === connection) {
        state.pendingJoin.reject(
          createAppError("room-closed", "A sala foi encerrada."),
        );
      } else if (state.joined && !state.leaving) {
        scheduleGuestReconnect();
      }
    });

    connection.on("error", () => {
      if (state.hostConnection !== connection) return;
      state.hostConnection = null;
      if (state.pendingReady?.connection === connection) {
        state.pendingReady.reject(
          createAppError("connection-closed", "A conexão foi interrompida."),
        );
      } else if (state.pendingJoin?.connection === connection) {
        state.pendingJoin.reject(
          createAppError("room-not-found", "Não foi possível entrar."),
        );
      } else if (state.joined && !state.leaving) {
        scheduleGuestReconnect();
      }
    });
  }

  function scheduleGuestReconnect() {
    if (
      state.isHost ||
      !state.joined ||
      state.leaving ||
      state.guestReconnecting
    ) {
      return;
    }

    state.guestReconnecting = true;
    const generation = ++state.guestReconnectGeneration;
    const deadline = Date.now() + CONFIG.restoreRetryWindow;
    let attemptNumber = 0;
    setConnectionStatus("connecting", "Reconectando…");
    updateChatComposer();

    const attempt = async () => {
      if (
        generation !== state.guestReconnectGeneration ||
        !state.joined ||
        state.leaving ||
        state.isHost
      ) {
        return;
      }

      let connection = null;
      try {
        if (!state.peer || state.peer.destroyed) {
          const replacementPeer = await openPeer(state.selfPeerId);
          if (generation !== state.guestReconnectGeneration) {
            safeDestroyPeer(replacementPeer);
            return;
          }
          state.peer = replacementPeer;
          attachPeerHandlers(replacementPeer);
        }

        connection = await connectToHost(state.peer, state.hostPeerId);
        if (generation !== state.guestReconnectGeneration) {
          connection.close();
          return;
        }

        state.hostConnection = connection;
        setupGuestControlConnection(connection);
        const response = await requestRoomAdmission(connection);
        applyRoomSettings(response.room);
        enforceGuestVoicePolicy();
        const members = parseMemberList(response.members, state.roomCapacity);
        if (
          !members.some(
            (member) => member.peerId === state.hostPeerId && member.host,
          )
        ) {
          throw createAppError("invalid-room", "A sala não pôde ser validada.");
        }

        const returnedPeerIds = new Set(members.map((member) => member.peerId));
        Array.from(state.participants.keys()).forEach((peerId) => {
          if (peerId !== state.selfPeerId && !returnedPeerIds.has(peerId)) {
            state.participants.delete(peerId);
            state.participantOutputSettings.delete(peerId);
            closeMediaForPeer(peerId);
          }
        });
        members.forEach((member) =>
          state.participants.set(member.peerId, member),
        );
        const self = state.participants.get(state.selfPeerId) || {
          peerId: state.selfPeerId,
          name: state.displayName,
          host: false,
        };
        self.name = state.displayName;
        self.listener = getLocalListenerState();
        self.muted = self.listener ? true : state.muted;
        self.host = false;
        state.participants.set(state.selfPeerId, self);

        await confirmRoomReady(connection);
        if (generation !== state.guestReconnectGeneration) {
          connection.close();
          return;
        }
        state.guestReconnecting = false;
        clearTimeout(state.guestReconnectTimer);
        state.guestReconnectTimer = 0;
        setConnectionStatus("connected", "Conectado");
        publishScreenShareToParticipants();
        renderParticipants();
        updateChatComposer();
        saveActiveSession();
        showToast("Você voltou à sala.");
      } catch (error) {
        if (state.hostConnection === connection) state.hostConnection = null;
        try {
          connection?.close();
        } catch (_) {
          // A tentativa já pode estar fechada.
        }
        if (error?.code === "removed" || error?.type === "removed") {
          state.guestReconnecting = false;
          remoteRoomClosed("Você foi removido pelo anfitrião.");
          return;
        }
        if (
          generation !== state.guestReconnectGeneration ||
          !state.joined ||
          state.leaving
        ) {
          return;
        }
        if (Date.now() >= deadline) {
          state.guestReconnecting = false;
          remoteRoomClosed("Não foi possível recuperar a conexão com a sala.");
          return;
        }
        attemptNumber += 1;
        const delay = Math.min(3200, 350 + attemptNumber * 250);
        state.guestReconnectTimer = window.setTimeout(attempt, delay);
      }
    };

    state.guestReconnectTimer = window.setTimeout(attempt, 350);
  }

  function handleGuestControlMessage(message, connection) {
    if (
      message.type === "accepted" &&
      state.pendingJoin?.connection === connection
    ) {
      state.pendingJoin.resolve(message);
      return;
    }

    if (
      message.type === "rejected" &&
      state.pendingJoin?.connection === connection
    ) {
      state.pendingJoin.reject(
        createAppError(
          message.reason || "join-rejected",
          message.message || "Entrada recusada.",
        ),
      );
      return;
    }

    if (
      message.type === "ready-ack" &&
      state.pendingReady?.connection === connection
    ) {
      state.joined = true;
      state.pendingReady.resolve();
      return;
    }

    if (message.type === "removed") {
      remoteRoomClosed("Você foi removido pelo anfitrião.");
      return;
    }

    if (!state.joined) return;

    if (message.type === "chat-history") {
      receiveChatHistory(message.messages);
      return;
    }

    if (message.type === "chat-message") {
      receiveChatMessage(message.message);
      return;
    }

    if (message.type === "chat-error") {
      rejectPendingChatSend(message.clientMessageId, message.reason);
      return;
    }

    if (message.type === "member-added") {
      const member = parseMember(message.member);
      if (!member || member.peerId === state.selfPeerId) return;
      state.participants.set(member.peerId, member);
      renderParticipants();
      answerPendingCalls(member.peerId);
      answerPendingScreenCalls(member.peerId);

      const self = state.participants.get(state.selfPeerId);
      if (self && !self.listener) {
        placeMediaCall(member.peerId);
      }
      if (hasActiveScreenShare()) placeScreenShareCall(member.peerId);
      showToast(`${member.name} entrou na sala.`);
      return;
    }

    if (message.type === "initiate-calls" && Array.isArray(message.peerIds)) {
      message.peerIds.slice(0, state.roomCapacity).forEach((peerId) => {
        if (isValidPeerId(peerId) && state.participants.has(peerId)) {
          window.setTimeout(() => placeMediaCall(peerId), 80);
        }
      });
      return;
    }

    if (message.type === "member-left" && isValidPeerId(message.peerId)) {
      removeGuestMember(message.peerId, true);
      return;
    }

    if (message.type === "member-removed" && isValidPeerId(message.peerId)) {
      removeGuestMember(message.peerId, false);
      showToast("Um participante foi removido pelo anfitrião.");
      return;
    }

    if (message.type === "member-state" && isValidPeerId(message.peerId)) {
      const member = state.participants.get(message.peerId);
      if (!member) return;
      member.muted = Boolean(message.muted);
      member.listener = Boolean(message.listener);
      applyParticipantVoiceGate(member.peerId);
      renderParticipants();
      return;
    }

    if (message.type === "room-closed") {
      remoteRoomClosed("A sala foi encerrada por quem a criou.");
    }
  }

  function removeHostMember(peerId, announce, reason = "left") {
    const member = state.participants.get(peerId);
    if (!member || peerId === state.selfPeerId) return;

    clearHostMemberReconnectTimer(peerId);
    const connection = state.controlConnections.get(peerId);
    state.participants.delete(peerId);
    state.controlConnections.delete(peerId);
    state.memberResumeTokens.delete(peerId);
    state.chatRateLimits.delete(peerId);
    state.participantOutputSettings.delete(peerId);
    closeMediaForPeer(peerId);
    try {
      connection?.close();
    } catch (_) {
      // Conexão já encerrada.
    }

    if (announce) {
      broadcastControl({
        type: "member-left",
        version: CONFIG.protocolVersion,
        roomCode: state.roomCode,
        peerId,
      });
      showToast(`${member.name} saiu da sala.`);
    } else if (reason === "removed") {
      showToast(`${member.name} foi removido da sala.`);
    }

    renderParticipants();
    saveActiveSession();
  }

  function scheduleHostMemberRemoval(
    peerId,
    connection = null,
    delay = CONFIG.restoreRetryWindow,
  ) {
    const member = state.participants.get(peerId);
    if (!member || peerId === state.selfPeerId || state.leaving) return;
    if (connection && state.controlConnections.get(peerId) !== connection)
      return;

    clearHostMemberReconnectTimer(peerId);
    state.controlConnections.delete(peerId);
    member.reconnecting = true;
    closeMediaForPeer(peerId);
    const timer = window.setTimeout(
      () => {
        state.memberReconnectTimers.delete(peerId);
        if (!state.controlConnections.has(peerId))
          removeHostMember(peerId, true);
      },
      Math.max(250, delay),
    );
    state.memberReconnectTimers.set(peerId, timer);
    renderParticipants();
    saveActiveSession();
  }

  function clearHostMemberReconnectTimer(peerId) {
    const timer = state.memberReconnectTimers.get(peerId);
    if (timer) clearTimeout(timer);
    state.memberReconnectTimers.delete(peerId);
    const member = state.participants.get(peerId);
    if (member) member.reconnecting = false;
  }

  function restoreHostReservations(reservations, savedAt) {
    const remaining = CONFIG.restoreRetryWindow - (Date.now() - savedAt);
    if (remaining <= 0) return;
    reservations.forEach(({ member, resumeToken }) => {
      if (
        member.peerId === state.selfPeerId ||
        state.participants.has(member.peerId) ||
        !isValidResumeToken(resumeToken) ||
        state.blockedResumeTokens.has(resumeToken)
      ) {
        return;
      }
      state.participants.set(member.peerId, { ...member, reconnecting: true });
      state.memberResumeTokens.set(member.peerId, resumeToken);
      scheduleHostMemberRemoval(member.peerId, null, remaining);
    });
  }

  function removeGuestMember(peerId, announce) {
    const member = state.participants.get(peerId);
    if (!member || peerId === state.selfPeerId) return;

    state.participants.delete(peerId);
    state.participantOutputSettings.delete(peerId);
    closeMediaForPeer(peerId);
    renderParticipants();
    if (announce) showToast(`${member.name} saiu da sala.`);
  }

  function handleChatSubmit(event) {
    event.preventDefault();
    if (!state.joined || state.leaving) {
      setChatStatus("Entre na sala para enviar mensagens.", true);
      return;
    }

    const text = normalizeChatText(dom.chatInput.value);
    if (!text) return;
    if (text.length > CONFIG.maxChatLength) {
      setChatStatus(
        `A mensagem pode ter até ${CONFIG.maxChatLength} caracteres.`,
        true,
      );
      return;
    }

    if (state.isHost) {
      const result = publishChatMessage(state.selfPeerId, text);
      if (!result.ok) {
        setChatStatus(chatErrorMessage(result.reason), true);
        return;
      }
    } else {
      if (state.pendingChatSend) {
        setChatStatus("Aguarde a confirmação da mensagem anterior.", true);
        return;
      }
      const clientMessageId = generateChatClientId();
      const sent = sendControl(state.hostConnection, {
        type: "chat-send",
        version: CONFIG.protocolVersion,
        roomCode: state.roomCode,
        text,
        clientMessageId,
      });
      if (!sent) {
        setChatStatus(
          "Não foi possível enviar agora. Verifique sua conexão.",
          true,
        );
        return;
      }
      const timer = window.setTimeout(() => {
        if (state.pendingChatSend?.clientMessageId !== clientMessageId) return;
        state.pendingChatSend = null;
        updateChatComposer();
        setChatStatus(
          "A mensagem não foi confirmada. Tente enviá-la novamente.",
          true,
        );
        dom.chatInput.focus();
      }, CONFIG.chatSendTimeout);
      state.pendingChatSend = { clientMessageId, text, timer };
      setChatStatus("Enviando…");
      closeEmojiPicker();
      updateChatComposer();
      return;
    }

    dom.chatInput.value = "";
    setChatStatus("");
    closeEmojiPicker();
    updateChatComposer();
    dom.chatInput.focus();
  }

  function handleHostChatSend(connection, rawText, clientMessageId) {
    const result = publishChatMessage(
      connection.peer,
      rawText,
      clientMessageId,
    );
    if (result.ok) return;
    sendControl(connection, {
      type: "chat-error",
      version: CONFIG.protocolVersion,
      roomCode: state.roomCode,
      reason: result.reason,
      clientMessageId: isValidChatClientId(clientMessageId)
        ? clientMessageId
        : "",
    });
  }

  function publishChatMessage(peerId, rawText, clientMessageId = "") {
    const member = state.participants.get(peerId);
    const text = normalizeChatText(rawText);
    if (!member || !text) return { ok: false, reason: "invalid-message" };
    if (peerId !== state.selfPeerId && !isValidChatClientId(clientMessageId)) {
      return { ok: false, reason: "invalid-message" };
    }
    if (text.length > CONFIG.maxChatLength) {
      return { ok: false, reason: "message-too-long" };
    }
    if (!consumeChatRateLimit(peerId)) {
      return { ok: false, reason: "rate-limit" };
    }

    const chatMessage = {
      sequence: (state.chatSequence += 1),
      peerId,
      name: member.name,
      text,
      sentAt: Date.now(),
      clientMessageId: peerId === state.selfPeerId ? "" : clientMessageId,
    };
    receiveChatMessage(chatMessage);
    broadcastControl({
      type: "chat-message",
      version: CONFIG.protocolVersion,
      roomCode: state.roomCode,
      message: serializeChatMessage(chatMessage),
    });
    saveActiveSession();
    return { ok: true };
  }

  function consumeChatRateLimit(peerId) {
    const now = Date.now();
    const cutoff = now - CONFIG.chatRateWindow;
    const recent = (state.chatRateLimits.get(peerId) || []).filter(
      (timestamp) => timestamp > cutoff,
    );
    if (recent.length >= CONFIG.chatRateLimit) {
      state.chatRateLimits.set(peerId, recent);
      return false;
    }
    recent.push(now);
    state.chatRateLimits.set(peerId, recent);
    return true;
  }

  function sendChatHistory(connection) {
    const batches = [];
    for (let index = 0; index < state.chatMessages.length; ) {
      const end = index + CONFIG.chatHistoryBatchSize;
      batches.push(
        state.chatMessages.slice(index, end).map(serializeChatMessage),
      );
      index = end;
    }

    const sendBatch = (index, retryCount = 0) => {
      if (
        index >= batches.length ||
        !state.joined ||
        !state.isHost ||
        !connection.open ||
        state.controlConnections.get(connection.peer) !== connection
      ) {
        return;
      }

      const sent = sendControl(connection, {
        type: "chat-history",
        version: CONFIG.protocolVersion,
        roomCode: state.roomCode,
        messages: batches[index],
      });
      const nextIndex = sent ? index + 1 : index;
      const nextRetryCount = sent ? 0 : retryCount + 1;
      if (!sent && nextRetryCount > 2) return;

      scheduleChatHistoryStep(
        () => sendBatch(nextIndex, nextRetryCount),
        sent ? 12 : 100,
      );
    };

    sendBatch(0);
  }

  function scheduleChatHistoryStep(callback, delay) {
    const timer = window.setTimeout(() => {
      state.chatHistoryTimers.delete(timer);
      callback();
    }, delay);
    state.chatHistoryTimers.add(timer);
  }

  function receiveChatHistory(messages) {
    if (
      !Array.isArray(messages) ||
      messages.length > CONFIG.chatHistoryBatchSize
    ) {
      return;
    }
    messages.forEach(receiveChatMessage);
  }

  function receiveChatMessage(rawMessage) {
    const message = parseChatMessage(rawMessage);
    if (!message) return;
    if (message.peerId === state.selfPeerId && message.clientMessageId) {
      confirmPendingChatSend(message.clientMessageId);
    }
    if (state.chatMessageSequences.has(message.sequence)) return;

    state.chatMessageSequences.add(message.sequence);
    const insertionIndex = state.chatMessages.findIndex(
      (current) => current.sequence > message.sequence,
    );
    if (insertionIndex === -1) state.chatMessages.push(message);
    else state.chatMessages.splice(insertionIndex, 0, message);
    insertChatMessage(message, insertionIndex);

    while (state.chatMessages.length > CONFIG.maxChatMessages) {
      const removed = state.chatMessages.shift();
      state.chatMessageSequences.delete(removed.sequence);
      dom.chatMessages
        .querySelector(`[data-chat-sequence="${removed.sequence}"]`)
        ?.remove();
    }
  }

  function parseChatMessage(rawMessage) {
    if (
      !rawMessage ||
      typeof rawMessage !== "object" ||
      Array.isArray(rawMessage)
    ) {
      return null;
    }

    const sequence = Number(rawMessage.sequence);
    const peerId = rawMessage.peerId;
    const name = sanitizeName(rawMessage.name);
    const text = normalizeChatText(rawMessage.text);
    const clientMessageId = isValidChatClientId(rawMessage.clientMessageId)
      ? rawMessage.clientMessageId
      : "";
    if (
      !Number.isSafeInteger(sequence) ||
      sequence < 1 ||
      !isValidPeerId(peerId) ||
      name.length < 2 ||
      name.length > 24 ||
      !text ||
      text.length > CONFIG.maxChatLength
    ) {
      return null;
    }

    const now = Date.now();
    const sentAt =
      Number.isSafeInteger(rawMessage.sentAt) &&
      rawMessage.sentAt > 0 &&
      rawMessage.sentAt <= now + 60000
        ? rawMessage.sentAt
        : now;
    return { sequence, peerId, name, text, sentAt, clientMessageId };
  }

  function serializeChatMessage(message) {
    const serialized = {
      sequence: message.sequence,
      peerId: message.peerId,
      name: message.name,
      text: message.text,
      sentAt: message.sentAt,
    };
    if (message.clientMessageId) {
      serialized.clientMessageId = message.clientMessageId;
    }
    return serialized;
  }

  function insertChatMessage(message, insertionIndex) {
    const wasNearBottom =
      dom.chatMessages.scrollHeight -
        dom.chatMessages.scrollTop -
        dom.chatMessages.clientHeight <
      56;
    const isSelf = message.peerId === state.selfPeerId;
    dom.chatEmpty.hidden = true;
    dom.chatEmpty.remove();

    const item = document.createElement("article");
    item.className = `chat-message${isSelf ? " is-self" : ""}`;
    item.dataset.chatSequence = String(message.sequence);

    const meta = document.createElement("div");
    meta.className = "chat-message-meta";
    const author = document.createElement("strong");
    author.textContent = isSelf ? "Você" : message.name;
    const time = document.createElement("time");
    const date = new Date(message.sentAt);
    time.dateTime = date.toISOString();
    time.textContent = date.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
    meta.append(author, time);

    const bubble = document.createElement("p");
    bubble.className = "chat-message-bubble";
    bubble.textContent = message.text;
    item.append(meta, bubble);
    const nextMessage =
      insertionIndex >= 0 ? state.chatMessages[insertionIndex + 1] : null;
    const nextElement = nextMessage
      ? dom.chatMessages.querySelector(
          `[data-chat-sequence="${nextMessage.sequence}"]`,
        )
      : null;
    dom.chatMessages.insertBefore(item, nextElement);

    if (isSelf || wasNearBottom) {
      scrollChatToBottom();
    } else {
      dom.chatNewMessagesButton.hidden = false;
    }
  }

  function handleChatScroll() {
    const isNearBottom =
      dom.chatMessages.scrollHeight -
        dom.chatMessages.scrollTop -
        dom.chatMessages.clientHeight <
      40;
    if (isNearBottom) dom.chatNewMessagesButton.hidden = true;
  }

  function scrollChatToBottom() {
    requestAnimationFrame(() => {
      dom.chatMessages.scrollTop = dom.chatMessages.scrollHeight;
      dom.chatNewMessagesButton.hidden = true;
    });
  }

  function normalizeChatText(value) {
    if (typeof value !== "string") return "";
    return value
      .replace(/\r\n?/g, "\n")
      .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function generateChatClientId() {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
      "",
    );
  }

  function isValidChatClientId(value) {
    return typeof value === "string" && /^[a-f0-9]{16}$/.test(value);
  }

  function confirmPendingChatSend(clientMessageId) {
    const pending = state.pendingChatSend;
    if (!pending || pending.clientMessageId !== clientMessageId) return;
    clearTimeout(pending.timer);
    state.pendingChatSend = null;
    if (dom.chatInput.value === pending.text) dom.chatInput.value = "";
    setChatStatus("");
    updateChatComposer();
    dom.chatInput.focus();
  }

  function rejectPendingChatSend(clientMessageId, reason) {
    const pending = state.pendingChatSend;
    if (
      pending &&
      isValidChatClientId(clientMessageId) &&
      pending.clientMessageId === clientMessageId
    ) {
      clearTimeout(pending.timer);
      state.pendingChatSend = null;
      updateChatComposer();
      dom.chatInput.focus();
    }
    setChatStatus(chatErrorMessage(reason), true);
  }

  function updateChatComposer() {
    const text = normalizeChatText(dom.chatInput.value);
    const available =
      state.joined &&
      !state.leaving &&
      !state.guestReconnecting &&
      !state.pendingChatSend;
    dom.chatCounter.textContent = `${dom.chatInput.value.length}/${CONFIG.maxChatLength}`;
    dom.chatInput.disabled = !available;
    dom.emojiToggleButton.disabled = !available;
    dom.chatSendButton.disabled =
      !available || !text || text.length > CONFIG.maxChatLength;

    dom.chatInput.style.height = "auto";
    if (dom.chatInput.scrollHeight > 0) {
      dom.chatInput.style.height = `${Math.min(dom.chatInput.scrollHeight, 106)}px`;
    }
    if (dom.chatStatus.classList.contains("is-error")) setChatStatus("");
  }

  function handleChatInputKeydown(event) {
    if (event.key === "Escape" && !dom.emojiPicker.hidden) {
      event.preventDefault();
      closeEmojiPicker(true);
      return;
    }
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      dom.chatForm.requestSubmit();
    }
  }

  function toggleEmojiPicker() {
    if (dom.emojiPicker.hidden) {
      dom.emojiPicker.hidden = false;
      dom.emojiToggleButton.setAttribute("aria-expanded", "true");
      dom.emojiPicker.querySelector("button")?.focus();
    } else {
      closeEmojiPicker(true);
    }
  }

  function handleEmojiSelection(event) {
    const button = event.target.closest("button[data-emoji]");
    if (!button || !dom.emojiPicker.contains(button)) return;
    insertEmoji(button.dataset.emoji || "");
  }

  function insertEmoji(emoji) {
    if (!emoji || !state.joined) return;
    const start = dom.chatInput.selectionStart ?? dom.chatInput.value.length;
    const end = dom.chatInput.selectionEnd ?? start;
    const nextValue = `${dom.chatInput.value.slice(0, start)}${emoji}${dom.chatInput.value.slice(end)}`;
    if (nextValue.length > CONFIG.maxChatLength) {
      setChatStatus(
        `A mensagem pode ter até ${CONFIG.maxChatLength} caracteres.`,
        true,
      );
      return;
    }

    dom.chatInput.value = nextValue;
    const cursor = start + emoji.length;
    closeEmojiPicker();
    updateChatComposer();
    dom.chatInput.focus();
    dom.chatInput.setSelectionRange(cursor, cursor);
  }

  function handleEmojiPickerKeydown(event) {
    if (event.key !== "Escape") return;
    event.preventDefault();
    closeEmojiPicker(true);
  }

  function handleDocumentClick(event) {
    if (
      dom.emojiPicker.hidden ||
      dom.emojiPicker.contains(event.target) ||
      dom.emojiToggleButton.contains(event.target)
    ) {
      return;
    }
    closeEmojiPicker();
  }

  function closeEmojiPicker(returnFocus = false) {
    const wasOpen = !dom.emojiPicker.hidden;
    dom.emojiPicker.hidden = true;
    dom.emojiToggleButton.setAttribute("aria-expanded", "false");
    if (returnFocus && wasOpen) dom.emojiToggleButton.focus();
  }

  function setChatStatus(message, isError = false) {
    dom.chatStatus.textContent = message;
    dom.chatStatus.classList.toggle("is-error", isError);
  }

  function chatErrorMessage(reason) {
    const messages = {
      "rate-limit": "Muitas mensagens seguidas. Aguarde alguns segundos.",
      "message-too-long": `A mensagem pode ter até ${CONFIG.maxChatLength} caracteres.`,
      "invalid-message": "Essa mensagem não pôde ser enviada.",
    };
    return messages[reason] || "Não foi possível enviar a mensagem.";
  }

  function resetChat() {
    if (state.pendingChatSend) clearTimeout(state.pendingChatSend.timer);
    state.pendingChatSend = null;
    state.chatHistoryTimers.forEach(clearTimeout);
    state.chatHistoryTimers.clear();
    state.chatMessages = [];
    state.chatSequence = 0;
    state.chatMessageSequences.clear();
    state.chatRateLimits.clear();
    dom.chatInput.value = "";
    dom.chatInput.style.height = "";
    dom.chatEmpty.hidden = false;
    dom.chatMessages.replaceChildren(dom.chatEmpty);
    dom.chatNewMessagesButton.hidden = true;
    setChatStatus("");
    closeEmojiPicker();
    updateChatComposer();
  }

  function handleIncomingMediaCall(call) {
    const metadata = call.metadata || {};
    const mediaType = metadata.mediaType || "voice";
    const admissionPending =
      !state.joined && !state.isHost && Boolean(state.pendingReady);
    if (
      (!state.joined && !admissionPending) ||
      state.leaving ||
      metadata.version !== CONFIG.protocolVersion ||
      normalizeRoomCode(metadata.roomCode) !== state.roomCode ||
      !["voice", "screen"].includes(mediaType) ||
      !isValidPeerId(call.peer)
    ) {
      safeCloseCall(call);
      return;
    }

    const caller = state.participants.get(call.peer);
    if (mediaType === "screen") {
      if (!caller) {
        if (state.joined) queuePendingScreenCall(call);
        else safeCloseCall(call);
        return;
      }
      if (!state.joined) {
        queuePendingScreenCall(call, CONFIG.joinTimeout);
        return;
      }
      answerScreenShareCall(call);
      return;
    }

    if (!caller) {
      if (state.joined) queuePendingCall(call);
      else safeCloseCall(call);
      return;
    }

    if (!state.guestsCanSpeak && !caller.host) {
      safeCloseCall(call);
      return;
    }

    if (!state.joined) {
      queuePendingCall(call, CONFIG.joinTimeout);
      return;
    }

    answerMediaCall(call);
  }

  function queuePendingCall(call, timeout = CONFIG.pendingCallTimeout) {
    const pendingCount = Array.from(state.pendingMediaCalls.values()).reduce(
      (total, calls) => total + calls.length,
      0,
    );
    if (pendingCount >= state.roomCapacity * 2) {
      safeCloseCall(call);
      return;
    }

    let timer = 0;
    const removePendingEntry = () => {
      const calls = state.pendingMediaCalls.get(call.peer) || [];
      state.pendingMediaCalls.set(
        call.peer,
        calls.filter((entry) => entry.call !== call),
      );
      if (!state.pendingMediaCalls.get(call.peer)?.length) {
        state.pendingMediaCalls.delete(call.peer);
      }
    };
    const discardPendingCall = () => {
      clearTimeout(timer);
      removePendingEntry();
    };
    timer = window.setTimeout(() => {
      discardPendingCall();
      safeCloseCall(call);
    }, timeout);
    call.on("close", discardPendingCall);
    call.on("error", discardPendingCall);

    const calls = state.pendingMediaCalls.get(call.peer) || [];
    calls.push({ call, timer });
    state.pendingMediaCalls.set(call.peer, calls);
  }

  function answerPendingCalls(peerId) {
    const pending = state.pendingMediaCalls.get(peerId) || [];
    state.pendingMediaCalls.delete(peerId);
    pending.forEach(({ call, timer }) => {
      clearTimeout(timer);
      answerMediaCall(call);
    });
  }

  function queuePendingScreenCall(call, timeout = CONFIG.pendingCallTimeout) {
    const pendingCount = Array.from(state.pendingScreenCalls.values()).reduce(
      (total, calls) => total + calls.length,
      0,
    );
    if (pendingCount >= state.roomCapacity) {
      safeCloseCall(call);
      return;
    }

    let timer = 0;
    const removePendingEntry = () => {
      const calls = state.pendingScreenCalls.get(call.peer) || [];
      state.pendingScreenCalls.set(
        call.peer,
        calls.filter((entry) => entry.call !== call),
      );
      if (!state.pendingScreenCalls.get(call.peer)?.length) {
        state.pendingScreenCalls.delete(call.peer);
      }
    };
    const discardPendingCall = () => {
      clearTimeout(timer);
      removePendingEntry();
    };
    timer = window.setTimeout(() => {
      discardPendingCall();
      safeCloseCall(call);
    }, timeout);
    call.on("close", discardPendingCall);
    call.on("error", discardPendingCall);

    const calls = state.pendingScreenCalls.get(call.peer) || [];
    calls.push({ call, timer });
    state.pendingScreenCalls.set(call.peer, calls);
  }

  function answerPendingScreenCalls(peerId) {
    const pending = state.pendingScreenCalls.get(peerId) || [];
    state.pendingScreenCalls.delete(peerId);
    pending.forEach(({ call, timer }) => {
      clearTimeout(timer);
      answerScreenShareCall(call);
    });
  }

  function answerMediaCall(call) {
    const caller = state.participants.get(call.peer);
    if (!caller || state.leaving || (!state.guestsCanSpeak && !caller.host)) {
      safeCloseCall(call);
      return;
    }

    try {
      call.answer(getOutboundStream());
      registerMediaCall(call);
    } catch (_) {
      safeCloseCall(call);
    }
  }

  function placeMediaCall(peerId) {
    if (
      !state.joined ||
      state.leaving ||
      !state.peer ||
      !state.participants.has(peerId) ||
      peerId === state.selfPeerId ||
      state.mediaCalls.has(peerId) ||
      getLocalListenerState()
    ) {
      return;
    }

    const outbound = getOutboundStream();
    if (!outbound.getAudioTracks().length) return;

    try {
      const call = state.peer.call(peerId, outbound, {
        metadata: {
          version: CONFIG.protocolVersion,
          roomCode: state.roomCode,
          mediaType: "voice",
        },
      });
      if (call) {
        state.outgoingMediaCalls.add(call);
        registerMediaCall(call);
      } else {
        scheduleMediaRetry(peerId);
      }
    } catch (_) {
      scheduleMediaRetry(peerId);
      showToast(
        "Não foi possível iniciar o áudio com uma pessoa da sala.",
        "error",
      );
    }
  }

  function registerMediaCall(call) {
    const existing = state.mediaCalls.get(call.peer);
    if (existing && existing !== call) safeCloseCall(existing);
    state.mediaCalls.set(call.peer, call);

    call.on("stream", (stream) => attachRemoteStream(call, stream));
    call.on("close", () => cleanupClosedCall(call.peer, call));
    call.on("error", () => cleanupClosedCall(call.peer, call));
  }

  function cleanupClosedCall(peerId, call) {
    if (state.mediaCalls.get(peerId) !== call) return;
    state.mediaCalls.delete(peerId);
    removeRemoteAudio(peerId);
    if (state.outgoingMediaCalls.has(call)) scheduleMediaRetry(peerId);
  }

  function scheduleMediaRetry(peerId) {
    if (
      !state.joined ||
      state.leaving ||
      getLocalListenerState() ||
      !state.participants.has(peerId)
    ) {
      clearMediaRetry(peerId);
      return;
    }

    const current = state.mediaRetryState.get(peerId) || {
      attempts: 0,
      timer: 0,
    };
    if (current.timer || current.attempts >= 3) return;

    const attempts = current.attempts + 1;
    const delay = 400 * 2 ** (attempts - 1) + Math.round(Math.random() * 250);
    const timer = window.setTimeout(() => {
      const pending = state.mediaRetryState.get(peerId);
      if (!pending || pending.timer !== timer) return;
      pending.timer = 0;
      if (
        !state.joined ||
        state.leaving ||
        getLocalListenerState() ||
        !state.participants.has(peerId)
      ) {
        clearMediaRetry(peerId);
        return;
      }
      if (!state.mediaCalls.has(peerId)) placeMediaCall(peerId);
      else clearMediaRetry(peerId);
    }, delay);
    state.mediaRetryState.set(peerId, { attempts, timer });
  }

  function clearMediaRetry(peerId) {
    const pending = state.mediaRetryState.get(peerId);
    if (pending?.timer) clearTimeout(pending.timer);
    state.mediaRetryState.delete(peerId);
  }

  async function attachRemoteStream(call, stream) {
    const peerId = call.peer;
    if (
      !state.joined ||
      state.leaving ||
      !state.participants.has(peerId) ||
      state.mediaCalls.get(peerId) !== call
    ) {
      return;
    }
    clearMediaRetry(peerId);
    removeRemoteAudio(peerId);

    const audio = document.createElement("audio");
    audio.autoplay = true;
    audio.playsInline = true;
    audio.dataset.peerId = peerId;
    audio.srcObject = stream;
    applyParticipantOutputSettings(peerId, audio);
    dom.remoteAudioContainer.appendChild(audio);
    state.remoteAudios.set(peerId, audio);
    applyParticipantVoiceGate(peerId, audio);
    addRemoteAnalysisNode(call, audio, stream);

    try {
      await audio.play();
      markRemoteMediaPlayback(audio, false);
    } catch (_) {
      if (
        state.mediaCalls.get(peerId) === call &&
        state.remoteAudios.get(peerId) === audio
      ) {
        markRemoteMediaPlayback(audio, true);
      }
    }
  }

  function applyParticipantVoiceGate(
    peerId,
    audio = state.remoteAudios.get(peerId),
  ) {
    if (!audio) return;
    const member = state.participants.get(peerId);
    const locallyMuted = Boolean(
      state.participantOutputSettings.get(peerId)?.muted,
    );
    audio.muted = !member || member.listener || locallyMuted;
    if (audio.muted) {
      markRemoteMediaPlayback(audio, false);
    } else if (member && !member.listener) {
      playParticipantOutput(peerId);
    }
  }

  async function addRemoteAnalysisNode(call, audio, stream) {
    const peerId = call.peer;
    const context = await ensureAudioContext();
    if (
      !context ||
      state.mediaCalls.get(peerId) !== call ||
      state.remoteAudios.get(peerId) !== audio
    ) {
      return;
    }
    addAnalysisNode(peerId, stream, context);
  }

  async function unlockRemoteAudio() {
    const remoteMedia = [
      ...Array.from(state.remoteAudios.values()),
      ...Array.from(state.remoteScreenVideos.values()).map((entry) => entry.video),
    ];
    const results = await Promise.allSettled(
      remoteMedia.map(async (media) => {
        await media.play();
        state.blockedRemoteMedia.delete(media);
      }),
    );
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        state.blockedRemoteMedia.add(remoteMedia[index]);
      }
    });
    await resumeAudioContext();
    updateMediaUnlockControl();
    if (dom.enableAudioButton.hidden) showToast("Mídia recebida ativada.");
  }

  function markRemoteMediaPlayback(media, blocked) {
    if (!media) return;
    if (blocked) state.blockedRemoteMedia.add(media);
    else state.blockedRemoteMedia.delete(media);
    updateMediaUnlockControl();
  }

  function updateMediaUnlockControl() {
    const voiceProcessingBlocked = Boolean(
      state.joined &&
        state.microphoneGranted &&
        !state.muted &&
        state.voiceEngine &&
        state.voiceEngine.context.state !== "running",
    );
    const remotePlaybackBlocked = state.blockedRemoteMedia.size > 0;
    dom.enableAudioButton.hidden =
      !voiceProcessingBlocked && !remotePlaybackBlocked;
    dom.enableAudioButton.textContent = voiceProcessingBlocked
      ? remotePlaybackBlocked
        ? "Ativar mídia e efeitos"
        : "Ativar áudio e efeitos"
      : "Ativar mídia recebida";
  }

  function closeMediaForPeer(peerId) {
    clearMediaRetry(peerId);
    const call = state.mediaCalls.get(peerId);
    state.mediaCalls.delete(peerId);
    safeCloseCall(call);

    const pending = state.pendingMediaCalls.get(peerId) || [];
    state.pendingMediaCalls.delete(peerId);
    pending.forEach(({ call: pendingCall, timer }) => {
      clearTimeout(timer);
      safeCloseCall(pendingCall);
    });

    removeRemoteAudio(peerId);
    closeScreenShareForPeer(peerId);
  }

  function removeRemoteAudio(peerId) {
    const audio = state.remoteAudios.get(peerId);
    if (audio) {
      state.blockedRemoteMedia.delete(audio);
      audio.pause();
      audio.srcObject = null;
      audio.remove();
      state.remoteAudios.delete(peerId);
      updateMediaUnlockControl();
    }
    removeAnalysisNode(peerId);
  }

  function normalizeScreenShareSettings(value) {
    const quality = String(value?.quality || "");
    const frameRate = Number(value?.frameRate);
    return {
      quality: Object.prototype.hasOwnProperty.call(
        SCREEN_SHARE_PROFILES,
        quality,
      )
        ? quality
        : DEFAULT_SCREEN_SHARE_SETTINGS.quality,
      frameRate: SCREEN_SHARE_FRAME_RATES.includes(frameRate)
        ? frameRate
        : DEFAULT_SCREEN_SHARE_SETTINGS.frameRate,
      shareAudio: typeof value?.shareAudio === "boolean" ? value.shareAudio : DEFAULT_SCREEN_SHARE_SETTINGS.shareAudio,
    };
  }

  function readStoredScreenShareSettings() {
    try {
      return normalizeScreenShareSettings(
        JSON.parse(localStorage.getItem(CONFIG.screenShareProfileKey) || "null"),
      );
    } catch (_) {
      return { ...DEFAULT_SCREEN_SHARE_SETTINGS };
    }
  }

  function saveScreenShareSettings(settings) {
    try {
      localStorage.setItem(
        CONFIG.screenShareProfileKey,
        JSON.stringify(normalizeScreenShareSettings(settings)),
      );
    } catch (_) {
      // A preferência continua válida apenas durante esta sessão.
    }
  }

  function getScreenShareProfile(settings = state.screenShareSettings) {
    return (
      SCREEN_SHARE_PROFILES[settings.quality] ||
      SCREEN_SHARE_PROFILES[DEFAULT_SCREEN_SHARE_SETTINGS.quality]
    );
  }

  function screenShareProfileLabel(settings = state.screenShareSettings) {
    const normalized = normalizeScreenShareSettings(settings);
    return `Até ${getScreenShareProfile(normalized).label} · ${normalized.frameRate} FPS`;
  }

  function getSelectedScreenShareSettings() {
    const selectedQuality = dom.screenShareForm.querySelector(
      'input[name="screen-share-quality"]:checked',
    )?.value;
    return normalizeScreenShareSettings({
      quality: selectedQuality,
      frameRate: dom.screenShareFrameRate.value,
      shareAudio: dom.screenShareAudio.checked,
    });
  }

  function syncScreenShareSettingsUI() {
    const settings = normalizeScreenShareSettings(state.screenShareSettings);
    const qualityInput = dom.screenShareForm.querySelector(
      `input[name="screen-share-quality"][value="${settings.quality}"]`,
    );
    if (qualityInput) qualityInput.checked = true;
    dom.screenShareFrameRate.value = String(settings.frameRate);
    dom.screenShareAudio.checked = settings.shareAudio;
    updateScreenShareProfileSummary();
  }

  function updateScreenShareProfileSummary() {
    const settings = getSelectedScreenShareSettings();
    const profile = getScreenShareProfile(settings);
    const fluidityNote =
      settings.frameRate === 60
        ? "60 FPS exige mais processamento e upload."
        : "30 FPS é recomendado para maior estabilidade.";
    dom.screenShareProfileSummary.textContent = `${profile.label} até ${profile.width} × ${profile.height}, com limite de ${settings.frameRate} FPS. ${fluidityNote} Se a conexão oscilar, o Cloak reduz temporariamente bitrate, FPS e resolução, usando 480p como o menor perfil-alvo.`;
  }

  function openScreenShareDialog() {
    if (!state.joined || state.leaving || state.screenShareStarting) return;
    if (!isScreenShareSupported()) {
      showToast(
        "Este navegador não permite compartilhar tela neste contexto.",
        "error",
      );
      updateScreenShareControl();
      return;
    }
    syncScreenShareSettingsUI();
    if (typeof dom.screenShareDialog.showModal === "function") {
      dom.screenShareDialog.showModal();
    } else {
      dom.screenShareDialog.setAttribute("open", "");
    }
    requestAnimationFrame(() => {
      dom.screenShareForm
        .querySelector('input[name="screen-share-quality"]:checked')
        ?.focus();
    });
  }

  function closeScreenShareDialog(restoreFocus = true) {
    if (
      !dom.screenShareDialog.open &&
      !dom.screenShareDialog.hasAttribute("open")
    ) {
      return;
    }
    state.screenShareDialogRestoreFocus = restoreFocus;
    if (typeof dom.screenShareDialog.close === "function") {
      dom.screenShareDialog.close();
    } else {
      dom.screenShareDialog.removeAttribute("open");
      state.screenShareDialogRestoreFocus = true;
      if (restoreFocus) focusScreenShareControl();
    }
  }

  function focusScreenShareControl() {
    if (dom.roomScreen.hidden || dom.screenShareButton.disabled) return;
    requestAnimationFrame(() => {
      if (!dom.roomScreen.hidden && !dom.screenShareButton.disabled) {
        dom.screenShareButton.focus({ preventScroll: true });
      }
    });
  }

  function confirmScreenShareSettings(event) {
    event.preventDefault();
    state.screenShareSettings = getSelectedScreenShareSettings();
    saveScreenShareSettings(state.screenShareSettings);
    closeScreenShareDialog(false);
    void startScreenShare();
  }

  function isScreenShareSupported() {
    return Boolean(
      window.isSecureContext &&
        navigator.mediaDevices &&
        typeof navigator.mediaDevices.getDisplayMedia === "function",
    );
  }

  function hasActiveScreenShare() {
    return Boolean(
      state.screenStream
        ?.getVideoTracks()
        .some((track) => track.readyState === "live"),
    );
  }

  function toggleScreenShare() {
    if (state.screenShareStarting) return;
    if (hasActiveScreenShare()) {
      stopScreenShare(true);
      return;
    }
    openScreenShareDialog();
  }

  async function startScreenShare() {
    if (!state.joined || state.leaving || state.screenShareStarting) return;
    if (!isScreenShareSupported()) {
      showToast(
        "Este navegador não permite compartilhar tela neste contexto.",
        "error",
      );
      updateScreenShareControl();
      return;
    }

    const generation = ++state.screenCaptureGeneration;
    state.screenShareStarting = true;
    updateScreenShareControl();

    const settings = normalizeScreenShareSettings(state.screenShareSettings);
    const profile = getScreenShareProfile(settings);
    const videoConstraints = {
      width: { ideal: profile.width, max: profile.width },
      height: { ideal: profile.height, max: profile.height },
      frameRate: { ideal: settings.frameRate, max: settings.frameRate },
    };

    let capture = null;
    try {
      capture = await navigator.mediaDevices.getDisplayMedia(
        screenAudio.captureOptions(videoConstraints, settings.shareAudio,
          navigator.mediaDevices.getSupportedConstraints?.() || {}),
      );
    } catch (error) {
      if (generation !== state.screenCaptureGeneration) return;
      state.screenShareStarting = false;
      updateScreenShareControl();
      const cancelled = ["AbortError", "NotAllowedError"].includes(error?.name);
      showToast(screenShareErrorMessage(error), cancelled ? "info" : "error");
      focusScreenShareControl();
      return;
    }

    if (
      generation !== state.screenCaptureGeneration ||
      !state.joined ||
      state.leaving ||
      state.pageHiding
    ) {
      capture.getTracks().forEach((track) => track.stop());
      if (generation === state.screenCaptureGeneration) {
        state.screenShareStarting = false;
        updateScreenShareControl();
        focusScreenShareControl();
      }
      return;
    }

    const videoTrack = capture.getVideoTracks()[0];
    if (!videoTrack || videoTrack.readyState !== "live") {
      capture.getTracks().forEach((track) => track.stop());
      state.screenShareStarting = false;
      updateScreenShareControl();
      showToast("A fonte escolhida não forneceu uma imagem.", "error");
      focusScreenShareControl();
      return;
    }

    try {
      videoTrack.contentHint = settings.frameRate === 60 ? "motion" : "detail";
    } catch (_) {
      // A dica de conteúdo não é reconhecida por todos os navegadores.
    }
    if (typeof videoTrack.applyConstraints === "function") {
      try {
        await videoTrack.applyConstraints(videoConstraints);
      } catch (_) {
        // A captura continua com os limites que o navegador conseguiu aplicar.
      }
    }

    if (
      generation !== state.screenCaptureGeneration ||
      !state.joined ||
      state.leaving ||
      state.pageHiding ||
      videoTrack.readyState !== "live"
    ) {
      capture.getTracks().forEach((track) => track.stop());
      if (generation === state.screenCaptureGeneration) {
        state.screenShareStarting = false;
        updateScreenShareControl();
        focusScreenShareControl();
      }
      return;
    }

    const capturedAudio = screenAudio.selectCaptureAudio(capture, settings.shareAudio);
    state.screenStream = new MediaStream([videoTrack, ...capturedAudio.tracks]);
    // If a supporting browser changes the source identity, do not rebroadcast the call.
    videoTrack.addEventListener("capturehandlechange", () => {
      for (const track of capturedAudio.tracks) {
        if (!screenAudio.isIsolated(videoTrack, track)) {
          track.stop();
          state.localScreenPreview?.screenAudioRefresh?.();
        }
      }
    });
    state.screenShareStarting = false;
    videoTrack.addEventListener(
      "ended",
      () => {
        if (state.screenStream?.getVideoTracks()[0] === videoTrack) {
          stopScreenShare(true);
        }
      },
      { once: true },
    );
    addLocalScreenPreview(state.screenStream, videoTrack);
    publishScreenShareToParticipants();
    updateScreenShareControl();
    renderParticipants();
    showToast(
      `${screenSurfaceLabel(videoTrack)} compartilhada com limite de ${profile.label} a ${settings.frameRate} FPS. ${
        capturedAudio.reason === "ready" ? "Som da transmissão ativado; vozes separadas." :
        capturedAudio.reason === "unsafe" ? "Som não enviado para evitar retorno da chamada. Compartilhe uma aba com áudio." :
        capturedAudio.reason === "unavailable" ? "A fonte não forneceu som. Selecione uma aba e marque Compartilhar áudio no navegador." : "Sem áudio da transmissão."
      }`,
    );
    focusScreenShareControl();
  }

  function screenShareErrorMessage(error) {
    if (["AbortError", "NotAllowedError"].includes(error?.name)) {
      return "Compartilhamento cancelado.";
    }
    if (error?.name === "InvalidStateError") {
      return "Mantenha esta página ativa e tente compartilhar novamente.";
    }
    if (error?.name === "NotFoundError") {
      return "Nenhuma aba, janela ou tela disponível foi encontrada.";
    }
    if (error?.name === "NotReadableError") {
      return "A fonte escolhida não pôde ser capturada pelo navegador.";
    }
    return "Não foi possível iniciar o compartilhamento de tela.";
  }

  function screenSurfaceLabel(track) {
    let surface = "";
    try {
      surface = track?.getSettings?.().displaySurface || "";
    } catch (_) {
      surface = "";
    }
    if (surface === "browser") return "Aba";
    if (surface === "window") return "Janela";
    if (surface === "monitor") return "Tela";
    return "Tela";
  }

  function stopScreenShare(announce = true) {
    const wasSharing = Boolean(state.screenStream || state.screenShareStarting);
    state.screenCaptureGeneration += 1;
    state.screenShareStarting = false;
    const stream = state.screenStream;
    state.screenStream = null;
    stream?.getTracks().forEach((track) => track.stop());

    state.screenShareRetryState.forEach(({ timer }) => clearTimeout(timer));
    state.screenShareRetryState.clear();
    stopScreenShareQualityMonitor();
    state.screenShareSenderStates.clear();
    state.screenShareAdaptiveLevels.clear();
    state.screenShareConnectionTimers.forEach(({ timer }) =>
      clearTimeout(timer),
    );
    state.screenShareConnectionTimers.clear();
    state.outgoingScreenCalls.forEach(safeCloseCall);
    state.outgoingScreenCalls.clear();
    removeLocalScreenPreview();
    syncScreenShareStage();
    updateScreenShareControl();
    if (state.joined) renderParticipants();
    if (announce && wasSharing) showToast("Compartilhamento de tela encerrado.");
  }

  function updateScreenShareControl() {
    const supported = isScreenShareSupported();
    const sharing = hasActiveScreenShare();
    dom.screenShareButton.disabled =
      !supported || !state.joined || state.leaving || state.screenShareStarting;
    dom.screenShareButton.classList.toggle("is-sharing", sharing);
    dom.screenShareButton.setAttribute("aria-pressed", String(sharing));
    dom.screenShareButton.setAttribute(
      "aria-busy",
      String(state.screenShareStarting),
    );
    if (sharing) {
      dom.screenShareButton.removeAttribute("aria-haspopup");
      dom.screenShareButton.removeAttribute("aria-controls");
    } else {
      dom.screenShareButton.setAttribute("aria-haspopup", "dialog");
      dom.screenShareButton.setAttribute(
        "aria-controls",
        "screen-share-dialog",
      );
    }
    dom.screenShareLabel.textContent = state.screenShareStarting
      ? "Escolhendo…"
      : sharing
        ? "Parar tela"
        : "Tela";
    const label = state.screenShareStarting
      ? "Escolhendo uma aba, janela ou tela para compartilhar"
      : sharing
        ? "Parar compartilhamento de tela"
        : supported
          ? "Compartilhar uma aba, janela ou tela"
          : "Compartilhamento de tela indisponível neste navegador";
    dom.screenShareButton.setAttribute("aria-label", label);
    dom.screenShareButton.title = label;
  }

  function publishScreenShareToParticipants() {
    if (!hasActiveScreenShare() || !state.joined || state.leaving) return;
    state.participants.forEach((_, peerId) => {
      if (peerId !== state.selfPeerId) placeScreenShareCall(peerId);
    });
  }

  function getScreenShareVideoSender(call, videoTrack) {
    const senders = call?.peerConnection?.getSenders?.() || [];
    return (
      senders.find((sender) => sender.track === videoTrack) ||
      senders.find((sender) => sender.track?.kind === "video") ||
      null
    );
  }

  function registerScreenShareSender(peerId, call, attempt = 0) {
    if (
      state.outgoingScreenCalls.get(peerId) !== call ||
      !hasActiveScreenShare()
    ) {
      return;
    }
    const videoTrack = state.screenStream?.getVideoTracks()[0];
    const sender = getScreenShareVideoSender(call, videoTrack);
    if (!sender) {
      if (attempt < 4) {
        window.setTimeout(
          () => registerScreenShareSender(peerId, call, attempt + 1),
          80 * 2 ** attempt,
        );
      }
      return;
    }

    const current = state.screenShareSenderStates.get(peerId);
    state.screenShareSenderStates.set(peerId, {
      call,
      sender,
      level:
        current?.call === call
          ? current.level
          : state.screenShareAdaptiveLevels.get(peerId) || 0,
      badSamples: 0,
      goodSamples: 0,
      updating: false,
      pendingUpdate: false,
      parameterAttempts: 0,
      applyFailures: 0,
      basicParametersOnly: false,
      sampling: false,
    });
    refreshScreenShareSenderLimits();
    startScreenShareQualityMonitor();
  }

  function getScreenShareEncodingLimits(level = 0) {
    const settings = normalizeScreenShareSettings(state.screenShareSettings);
    const profile = getScreenShareProfile(settings);
    const bitrateFactors = [1, 0.72, 0.5];
    const baseBitrate = profile.maxBitrates[settings.frameRate];
    const recipientCount = Math.max(1, state.outgoingScreenCalls.size);
    const perRecipientBudget = Math.floor(
      CONFIG.screenShareUploadBudget / recipientCount,
    );
    const budgetRatio = perRecipientBudget / baseBitrate;
    const budgetLevel = budgetRatio < 0.55 ? 2 : budgetRatio < 0.8 ? 1 : 0;
    const safeLevel = Math.max(
      budgetLevel,
      Math.max(
        0,
        Math.min(profile.adaptiveScales.length - 1, Number(level) || 0),
      ),
    );
    let captureScale = 1;
    try {
      const trackSettings = state.screenStream?.getVideoTracks()[0]?.getSettings();
      captureScale = Math.max(
        1,
        Number(trackSettings?.width) / profile.width || 1,
        Number(trackSettings?.height) / profile.height || 1,
      );
    } catch (_) {
      captureScale = 1;
    }
    return {
      maxBitrate: Math.max(
        250000,
        Math.min(
          Math.round(baseBitrate * bitrateFactors[safeLevel]),
          perRecipientBudget,
        ),
      ),
      maxFramerate:
        settings.frameRate === 60 && safeLevel > 0 ? 30 : settings.frameRate,
      scaleResolutionDownBy: Number(
        (captureScale * profile.adaptiveScales[safeLevel]).toFixed(3),
      ),
    };
  }

  async function applyScreenShareSenderLimits(peerId, entry) {
    if (
      !entry ||
      state.screenShareSenderStates.get(peerId) !== entry ||
      state.outgoingScreenCalls.get(peerId) !== entry.call
    ) {
      return;
    }
    if (entry.updating) {
      entry.pendingUpdate = true;
      return;
    }
    if (
      typeof entry.sender.getParameters !== "function" ||
      typeof entry.sender.setParameters !== "function"
    ) {
      return;
    }

    entry.updating = true;
    try {
      const parameters = entry.sender.getParameters();
      if (!parameters.encodings?.length) {
        if (entry.parameterAttempts < 4) {
          entry.parameterAttempts += 1;
          window.setTimeout(
            () => void applyScreenShareSenderLimits(peerId, entry),
            80 * 2 ** (entry.parameterAttempts - 1),
          );
        }
        return;
      }
      entry.parameterAttempts = 0;
      const limits = getScreenShareEncodingLimits(entry.level);
      parameters.encodings.forEach((encoding) => {
        encoding.maxBitrate = limits.maxBitrate;
        if (!entry.basicParametersOnly) {
          encoding.maxFramerate = limits.maxFramerate;
          encoding.scaleResolutionDownBy = limits.scaleResolutionDownBy;
        }
      });
      if (!entry.basicParametersOnly) {
        parameters.degradationPreference = "maintain-framerate";
      }
      try {
        await entry.sender.setParameters(parameters);
      } catch (error) {
        if (entry.basicParametersOnly) throw error;
        entry.basicParametersOnly = true;
        const fallback = entry.sender.getParameters();
        if (!fallback.encodings?.length) throw error;
        fallback.encodings.forEach((encoding) => {
          encoding.maxBitrate = limits.maxBitrate;
        });
        await entry.sender.setParameters(fallback);
      }
      entry.applyFailures = 0;
    } catch (_) {
      if (entry.applyFailures < 3) {
        entry.applyFailures += 1;
        window.setTimeout(
          () => void applyScreenShareSenderLimits(peerId, entry),
          250 * 2 ** (entry.applyFailures - 1),
        );
      }
    } finally {
      entry.updating = false;
      if (entry.pendingUpdate) {
        entry.pendingUpdate = false;
        void applyScreenShareSenderLimits(peerId, entry);
      }
    }
  }

  function refreshScreenShareSenderLimits() {
    state.screenShareSenderStates.forEach((entry, peerId) => {
      void applyScreenShareSenderLimits(peerId, entry);
    });
  }

  function startScreenShareQualityMonitor() {
    if (state.screenShareStatsTimer || !state.screenShareSenderStates.size) {
      return;
    }
    state.screenShareStatsTimer = window.setInterval(() => {
      state.screenShareSenderStates.forEach((entry, peerId) => {
        void sampleScreenShareSender(peerId, entry);
      });
    }, CONFIG.screenShareStatsInterval);
  }

  function stopScreenShareQualityMonitor() {
    clearInterval(state.screenShareStatsTimer);
    state.screenShareStatsTimer = 0;
  }

  async function sampleScreenShareSender(peerId, entry) {
    if (
      state.screenShareSenderStates.get(peerId) !== entry ||
      state.outgoingScreenCalls.get(peerId) !== entry.call ||
      entry.sampling
    ) {
      return;
    }

    entry.sampling = true;
    try {
      let reports = null;
      try {
        if (typeof entry.sender.getStats === "function") {
          try {
            reports = await entry.sender.getStats();
          } catch (senderError) {
            if (typeof entry.call.peerConnection?.getStats !== "function") {
              throw senderError;
            }
            reports = await entry.call.peerConnection.getStats(
              entry.sender.track,
            );
          }
        } else if (typeof entry.call.peerConnection?.getStats === "function") {
          reports = await entry.call.peerConnection.getStats(
            entry.sender.track,
          );
        }
      } catch (_) {
        return;
      }

      if (
        !reports ||
        state.screenShareSenderStates.get(peerId) !== entry ||
        state.outgoingScreenCalls.get(peerId) !== entry.call ||
        !hasActiveScreenShare()
      ) {
        return;
      }

      let outbound = null;
      let remoteInbound = null;
      reports.forEach((report) => {
        const mediaKind = report.kind || report.mediaType;
        if (
          report.type === "outbound-rtp" &&
          !report.isRemote &&
          mediaKind === "video"
        ) {
          outbound = report;
        } else if (
          report.type === "remote-inbound-rtp" &&
          mediaKind === "video"
        ) {
          remoteInbound = report;
        }
      });
      if (!outbound) return;

      const limitationIsKnown =
        typeof outbound.qualityLimitationReason === "string";
      const limitationReason = outbound.qualityLimitationReason || "none";
      const fractionLost = Number(remoteInbound?.fractionLost);
      const roundTripTime = Number(remoteInbound?.roundTripTime);
      const lossIsKnown =
        Number.isFinite(fractionLost) && fractionLost >= 0;
      const roundTripIsKnown =
        Number.isFinite(roundTripTime) && roundTripTime >= 0;
      const healthIsObservable =
        limitationIsKnown || lossIsKnown || roundTripIsKnown;
      const constrained =
        ["bandwidth", "cpu"].includes(limitationReason) ||
        (lossIsKnown && fractionLost >= 0.05) ||
        (roundTripIsKnown && roundTripTime >= 0.5);
      const healthy =
        healthIsObservable &&
        (!["bandwidth", "cpu", "other"].includes(limitationReason) ||
          !limitationIsKnown) &&
        (!lossIsKnown || fractionLost < 0.02) &&
        (!roundTripIsKnown || roundTripTime < 0.25);

      if (constrained) {
        entry.badSamples += 1;
        entry.goodSamples = 0;
        if (entry.badSamples >= 2 && entry.level < 2) {
          entry.level += 1;
          state.screenShareAdaptiveLevels.set(peerId, entry.level);
          entry.badSamples = 0;
          void applyScreenShareSenderLimits(peerId, entry);
        }
        return;
      }

      if (!healthy) {
        entry.badSamples = 0;
        entry.goodSamples = 0;
        return;
      }

      entry.badSamples = 0;
      entry.goodSamples += 1;
      if (entry.goodSamples >= 5 && entry.level > 0) {
        entry.level -= 1;
        state.screenShareAdaptiveLevels.set(peerId, entry.level);
        entry.goodSamples = 0;
        void applyScreenShareSenderLimits(peerId, entry);
      }
    } finally {
      entry.sampling = false;
    }
  }

  function clearScreenShareConnectionTimer(peerId, expectedCall = null) {
    const pending = state.screenShareConnectionTimers.get(peerId);
    if (!pending || (expectedCall && pending.call !== expectedCall)) return;
    clearTimeout(pending.timer);
    state.screenShareConnectionTimers.delete(peerId);
  }

  function armScreenShareConnectionTimer(
    peerId,
    call,
    timeout = CONFIG.connectionTimeout,
  ) {
    if (state.outgoingScreenCalls.get(peerId) !== call) return;
    clearScreenShareConnectionTimer(peerId);
    const timer = window.setTimeout(() => {
      const pending = state.screenShareConnectionTimers.get(peerId);
      if (!pending || pending.call !== call || pending.timer !== timer) return;
      state.screenShareConnectionTimers.delete(peerId);
      if (state.outgoingScreenCalls.get(peerId) !== call) return;
      cleanupOutgoingScreenShareCall(peerId, call);
      safeCloseCall(call);
    }, timeout);
    state.screenShareConnectionTimers.set(peerId, { call, timer });
  }

  function placeScreenShareCall(peerId) {
    const videoTrack = state.screenStream?.getVideoTracks()[0];
    if (
      !state.joined ||
      state.leaving ||
      !state.peer ||
      !videoTrack ||
      videoTrack.readyState !== "live" ||
      !state.participants.has(peerId) ||
      peerId === state.selfPeerId ||
      state.outgoingScreenCalls.has(peerId)
    ) {
      return;
    }

    try {
      const call = state.peer.call(peerId, state.screenStream, {
        metadata: {
          version: CONFIG.protocolVersion,
          roomCode: state.roomCode,
          mediaType: "screen",
        },
      });
      if (!call) {
        scheduleScreenShareRetry(peerId);
        return;
      }
      state.outgoingScreenCalls.set(peerId, call);
      refreshScreenShareSenderLimits();
      const cleanup = () => cleanupOutgoingScreenShareCall(peerId, call);
      call.on("close", cleanup);
      call.on("error", cleanup);
      const connection = call.peerConnection;
      if (connection?.addEventListener) {
        armScreenShareConnectionTimer(peerId, call);
        const handleConnectionState = () => {
          if (state.outgoingScreenCalls.get(peerId) !== call) return;
          const connected =
            connection.connectionState === "connected" ||
            ["connected", "completed"].includes(connection.iceConnectionState);
          if (connected) {
            clearScreenShareConnectionTimer(peerId, call);
            clearScreenShareRetry(peerId);
            const senderState = state.screenShareSenderStates.get(peerId);
            if (senderState?.call === call) {
              senderState.parameterAttempts = 0;
              senderState.applyFailures = 0;
              senderState.basicParametersOnly = false;
              void applyScreenShareSenderLimits(peerId, senderState);
            } else {
              registerScreenShareSender(peerId, call);
            }
            return;
          }
          const failed =
            ["failed", "closed"].includes(connection.connectionState) ||
            ["failed", "closed"].includes(connection.iceConnectionState);
          if (failed) {
            cleanup();
            safeCloseCall(call);
            return;
          }
          if (
            connection.connectionState === "disconnected" ||
            connection.iceConnectionState === "disconnected"
          ) {
            armScreenShareConnectionTimer(peerId, call, 5000);
          }
        };
        connection.addEventListener(
          "connectionstatechange",
          handleConnectionState,
        );
        connection.addEventListener("iceconnectionstatechange", handleConnectionState);
        handleConnectionState();
      }
      registerScreenShareSender(peerId, call);
    } catch (_) {
      scheduleScreenShareRetry(peerId);
    }
  }

  function cleanupOutgoingScreenShareCall(peerId, call) {
    if (state.outgoingScreenCalls.get(peerId) !== call) return;
    clearScreenShareConnectionTimer(peerId, call);
    state.outgoingScreenCalls.delete(peerId);
    if (state.screenShareSenderStates.get(peerId)?.call === call) {
      state.screenShareSenderStates.delete(peerId);
    }
    if (state.screenShareSenderStates.size) refreshScreenShareSenderLimits();
    else stopScreenShareQualityMonitor();
    if (
      hasActiveScreenShare() &&
      state.joined &&
      !state.leaving &&
      state.participants.has(peerId)
    ) {
      scheduleScreenShareRetry(peerId);
    }
  }

  function scheduleScreenShareRetry(peerId) {
    if (
      !hasActiveScreenShare() ||
      !state.joined ||
      state.leaving ||
      !state.participants.has(peerId)
    ) {
      clearScreenShareRetry(peerId);
      return;
    }
    const current = state.screenShareRetryState.get(peerId) || {
      attempts: 0,
      timer: 0,
    };
    if (current.timer || current.attempts >= 3) return;
    const attempts = current.attempts + 1;
    const timer = window.setTimeout(() => {
      const pending = state.screenShareRetryState.get(peerId);
      if (!pending || pending.timer !== timer) return;
      pending.timer = 0;
      state.screenShareRetryState.set(peerId, pending);
      placeScreenShareCall(peerId);
    }, 500 * 2 ** (attempts - 1));
    state.screenShareRetryState.set(peerId, { attempts, timer });
  }

  function clearScreenShareRetry(peerId) {
    const pending = state.screenShareRetryState.get(peerId);
    if (pending?.timer) clearTimeout(pending.timer);
    state.screenShareRetryState.delete(peerId);
  }

  function answerScreenShareCall(call) {
    const caller = state.participants.get(call.peer);
    if (
      !caller ||
      !state.joined ||
      state.leaving ||
      call.metadata?.mediaType !== "screen"
    ) {
      safeCloseCall(call);
      return;
    }

    const existing = state.incomingScreenCalls.get(call.peer);
    if (existing && existing !== call) {
      state.incomingScreenCalls.delete(call.peer);
      safeCloseCall(existing);
      removeRemoteScreenShare(call.peer, existing);
    }
    state.incomingScreenCalls.set(call.peer, call);
    const cleanup = () => cleanupIncomingScreenShareCall(call.peer, call);
    call.on("stream", (stream) => void attachRemoteScreenShare(call, stream));
    call.on("close", cleanup);
    call.on("error", cleanup);
    try {
      call.answer();
    } catch (_) {
      cleanup();
      safeCloseCall(call);
    }
  }

  async function attachRemoteScreenShare(call, stream) {
    const peerId = call.peer;
    const videoTrack = stream?.getVideoTracks?.()[0];
    if (
      !videoTrack ||
      videoTrack.readyState !== "live" ||
      !state.joined ||
      state.leaving ||
      !state.participants.has(peerId) ||
      state.incomingScreenCalls.get(peerId) !== call
    ) {
      safeCloseCall(call);
      return;
    }

    const current = state.remoteScreenVideos.get(peerId);
    if (current?.call === call && current.videoTrack === videoTrack) {
      if (current.stream !== stream) {
        current.stream = stream;
        current.screenAudioOutput.setStream(stream);
      }
      return;
    }
    removeRemoteScreenShare(peerId, null, new Set(stream.getTracks()));
    // One video element plays the screen stream. Never send it to the voice output.
    const safeStream = stream;
    const entry = createScreenShareCard(peerId, safeStream, false);
    entry.call = call;
    entry.videoTrack = videoTrack;
    state.remoteScreenVideos.set(peerId, entry);
    dom.screenShareGrid.appendChild(entry.card);
    bindScreenTrackStatus(videoTrack, entry);
    videoTrack.addEventListener(
      "ended",
      () => {
        if (state.incomingScreenCalls.get(peerId) === call) {
          safeCloseCall(call);
          cleanupIncomingScreenShareCall(peerId, call);
        }
      },
      { once: true },
    );
    syncScreenShareStage();
    renderParticipants();
    const member = state.participants.get(peerId);
    if (member) showToast(`${member.name} começou a compartilhar a tela.`);
    try {
      await entry.video.play();
      markRemoteMediaPlayback(entry.video, false);
    } catch (_) {
      if (state.remoteScreenVideos.get(peerId) === entry) {
        markRemoteMediaPlayback(entry.video, true);
      }
    }
  }

  function cleanupIncomingScreenShareCall(peerId, call) {
    if (state.incomingScreenCalls.get(peerId) !== call) return;
    state.incomingScreenCalls.delete(peerId);
    const removed = removeRemoteScreenShare(peerId, call);
    if (removed && state.joined && state.participants.has(peerId)) {
      const member = state.participants.get(peerId);
      showToast(`${member.name} parou de compartilhar a tela.`);
    }
  }

  function createScreenShareCard(peerId, stream, local) {
    const member = state.participants.get(peerId);
    const presenterName = member?.name || (local ? state.displayName : "Participante");
    const card = document.createElement("article");
    card.className = `screen-share-card${local ? " is-local" : ""}`;
    card.dataset.peerId = peerId;

    const header = document.createElement("header");
    header.className = "screen-share-card-header";
    const presenter = document.createElement("div");
    presenter.className = "screen-share-presenter";
    const name = document.createElement("strong");
    name.textContent = local ? `${presenterName} (você)` : presenterName;
    const badge = document.createElement("span");
    badge.className = "screen-share-live-badge";
    badge.dataset.status = "live";
    badge.textContent = "Ao vivo";
    presenter.append(name, badge);
    header.appendChild(presenter);

    if (local) {
      const actions = document.createElement("div");
      actions.className = "screen-share-card-actions";
      const profileBadge = document.createElement("span");
      profileBadge.className = "screen-share-profile-badge";
      profileBadge.textContent = screenShareProfileLabel();
      profileBadge.setAttribute(
        "aria-label",
        `Limite da transmissão: ${screenShareProfileLabel()}`,
      );
      const stopButton = document.createElement("button");
      stopButton.className = "screen-share-stop-button";
      stopButton.type = "button";
      stopButton.textContent = "Parar";
      stopButton.setAttribute("aria-label", "Parar seu compartilhamento de tela");
      stopButton.addEventListener("click", () => stopScreenShare(true));
      actions.append(profileBadge, stopButton);
      header.appendChild(actions);
    }

    const frame = document.createElement("div");
    frame.className = "screen-share-video-frame";
    const video = document.createElement("video");
    video.autoplay = true;
    video.playsInline = true;
    video.muted = true;
    video.defaultMuted = true;
    video.controls = !local;
    video.srcObject = stream;
    video.setAttribute(
      "aria-label",
      local
        ? "Prévia da tela que você está compartilhando"
        : `Tela compartilhada por ${presenterName}`,
    );
    frame.appendChild(video);
    card.append(header, frame);
    const entry = { card, video, badge, stream };
    addScreenAudioControls(entry, presenterName, local);
    return entry;
  }

  function addScreenAudioControls(entry, presenterName, local) {
    const controls = document.createElement("div");
    controls.className = "screen-audio-controls";
    const status = document.createElement("span");
    status.className = "screen-audio-status";
    status.setAttribute("role", "status");
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "screen-audio-toggle";
    toggle.hidden = local;
    const volumeLabel = document.createElement("label");
    volumeLabel.className = "screen-audio-volume";
    volumeLabel.hidden = local;
    const label = document.createElement("span");
    label.textContent = "Volume da tela";
    const range = document.createElement("input");
    range.type = "range";
    range.min = "0"; range.max = "100"; range.step = "1"; range.value = "100";
    range.setAttribute("aria-label", `Volume da transmissão de ${presenterName}`);
    const value = document.createElement("output");
    value.textContent = "100%";
    volumeLabel.append(label, range, value);
    controls.append(toggle, volumeLabel, status);
    entry.card.appendChild(controls);
    const update = (output) => {
      toggle.disabled = !output.available;
      toggle.textContent = !output.available ? "Sem áudio" : output.blocked ? "Tentar ouvir" : output.enabled ? "Silenciar tela" : "Ouvir transmissão";
      toggle.setAttribute("aria-label", `${toggle.textContent}: ${presenterName}`);
      toggle.setAttribute("aria-pressed", String(output.enabled && !output.blocked));
      range.disabled = !output.available;
      range.value = String(Math.round(output.volume * 100));
      value.textContent = `${range.value}%`;
      range.setAttribute("aria-valuetext", value.textContent);
      status.textContent = local
        ? output.available ? "Som enviado • sua prévia fica muda" : "Transmissão sem som"
        : !output.available ? "O apresentador não está enviando som." : output.blocked
          ? "Clique para liberar o áudio." : "Vozes e som da tela têm volumes separados.";
    };
    entry.screenAudioOutput = screenAudio.createOutput(entry.video, entry.stream, {
      local, onChange: update,
      onBlocked: (blocked) => { if (!local) markRemoteMediaPlayback(entry.video, blocked); },
    });
    entry.screenAudioRefresh = () => update(entry.screenAudioOutput.snapshot());
    toggle.addEventListener("click", () => void entry.screenAudioOutput.toggle());
    range.addEventListener("input", () => entry.screenAudioOutput.setVolume(Number(range.value) / 100));
  }

  function addLocalScreenPreview(stream, videoTrack) {
    removeLocalScreenPreview();
    const entry = createScreenShareCard(state.selfPeerId, stream, true);
    entry.videoTrack = videoTrack;
    state.localScreenPreview = entry;
    dom.screenShareGrid.prepend(entry.card);
    bindScreenTrackStatus(videoTrack, entry);
    syncScreenShareStage();
    try {
      const playback = entry.video.play();
      playback?.catch(() => {});
    } catch (_) {
      // A prévia local continua disponível após a próxima interação.
    }
  }

  function bindScreenTrackStatus(track, entry) {
    const setPaused = (paused) => {
      if (!entry.card.isConnected) return;
      entry.badge.dataset.status = paused ? "paused" : "live";
      entry.badge.textContent = paused ? "Pausado" : "Ao vivo";
    };
    track.addEventListener("mute", () => setPaused(true));
    track.addEventListener("unmute", () => setPaused(false));
  }

  function removeLocalScreenPreview() {
    const entry = state.localScreenPreview;
    if (!entry) return;
    entry.screenAudioOutput?.dispose();
    entry.video.pause();
    entry.video.srcObject = null;
    entry.card.remove();
    state.localScreenPreview = null;
  }

  function removeRemoteScreenShare(peerId, expectedCall = null, retainedTracks = new Set()) {
    const entry = state.remoteScreenVideos.get(peerId);
    if (!entry || (expectedCall && entry.call !== expectedCall)) return false;
    entry.screenAudioOutput?.dispose();
    state.blockedRemoteMedia.delete(entry.video);
    entry.video.pause();
    entry.video.srcObject = null;
    entry.stream.getTracks().forEach((track) => {
      if (!retainedTracks.has(track)) track.stop();
    });
    entry.card.remove();
    state.remoteScreenVideos.delete(peerId);
    updateMediaUnlockControl();
    syncScreenShareStage();
    if (state.joined) renderParticipants();
    return true;
  }

  function closeScreenShareForPeer(peerId) {
    clearScreenShareRetry(peerId);
    state.screenShareAdaptiveLevels.delete(peerId);
    const outgoing = state.outgoingScreenCalls.get(peerId);
    clearScreenShareConnectionTimer(peerId, outgoing);
    state.outgoingScreenCalls.delete(peerId);
    if (state.screenShareSenderStates.get(peerId)?.call === outgoing) {
      state.screenShareSenderStates.delete(peerId);
      if (state.screenShareSenderStates.size) refreshScreenShareSenderLimits();
      else stopScreenShareQualityMonitor();
    }
    safeCloseCall(outgoing);
    const incoming = state.incomingScreenCalls.get(peerId);
    state.incomingScreenCalls.delete(peerId);
    safeCloseCall(incoming);

    const pending = state.pendingScreenCalls.get(peerId) || [];
    state.pendingScreenCalls.delete(peerId);
    pending.forEach(({ call, timer }) => {
      clearTimeout(timer);
      safeCloseCall(call);
    });
    removeRemoteScreenShare(peerId);
  }

  function closeAllRemoteScreenShares() {
    state.pendingScreenCalls.forEach((entries) => {
      entries.forEach(({ call, timer }) => {
        clearTimeout(timer);
        safeCloseCall(call);
      });
    });
    state.pendingScreenCalls.clear();
    state.incomingScreenCalls.forEach(safeCloseCall);
    state.incomingScreenCalls.clear();
    Array.from(state.remoteScreenVideos.keys()).forEach((peerId) =>
      removeRemoteScreenShare(peerId),
    );
    syncScreenShareStage();
  }

  function syncScreenShareStage() {
    const count = dom.screenShareGrid.children.length;
    dom.screenShareStage.hidden = count === 0;
    dom.roomLayout.classList.toggle("has-screen-share", count > 0);
    dom.screenShareCount.textContent = `${count} ${count === 1 ? "tela" : "telas"}`;
  }

  async function activateRoom() {
    const restored = state.restoring;
    dom.enableAudioButton.textContent = "Ativar mídia recebida";
    updateRoomUrl();
    updateRoomDetails();
    renderParticipants();
    updateMuteControl();
    updateScreenShareControl();
    updateAudioInputSelectorState();
    updateChatComposer();
    setConnectionStatus("connected", "Conectado");
    showScreen("room");
    requestAnimationFrame(() => {
      dom.chatMessages.scrollTop = dom.chatMessages.scrollHeight;
    });
    await resumeAudioContext();
    updateMediaUnlockControl();

    if (state.microphoneGranted && state.localStream?.getAudioTracks().length) {
      addAnalysisNode(
        state.selfPeerId,
        getProcessedVoiceStream() || state.localStream,
      );
      refreshAudioInputDevices();
    }
    syncVoiceEqualizerUI();

    document.title = `${state.roomName} — Cloak`;
    showToast(
      restored
        ? "Sala recuperada após a atualização."
        : state.isHost
          ? "Sala criada. Seu convite já está pronto."
          : "Você entrou na sala.",
    );
    saveActiveSession();
  }

  function updateRoomDetails() {
    const formatted = formatRoomCode(state.roomCode);
    dom.sidebarRoomCode.textContent = formatted;
    dom.roomKicker.textContent = state.isHost
      ? "Sua sala"
      : "Sala compartilhada";
    dom.roomTitle.textContent = state.roomName || "Sala de voz e tela";
    document.querySelector("#studio-room-name").textContent = state.roomName || "Sua sala";
    dom.roomScreenTitle.textContent = state.roomName || "Sala de voz e tela";
    dom.roomCapacitySummary.textContent = `${state.roomCapacity} lugares`;
    dom.roomVoicePolicySummary.textContent = state.guestsCanSpeak
      ? "Participantes podem falar"
      : "Somente o anfitrião pode falar";
    dom.capacityLimit.textContent = String(state.roomCapacity);
  }

  function normalizeOutputVolume(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 100;
    return Math.min(100, Math.max(0, Math.round(number)));
  }

  function getParticipantOutputSettings(peerId) {
    let settings = state.participantOutputSettings.get(peerId);
    if (!settings) {
      settings = { volume: 100, muted: false };
      state.participantOutputSettings.set(peerId, settings);
    }
    return settings;
  }

  function applyParticipantOutputSettings(
    peerId,
    audio = state.remoteAudios.get(peerId),
  ) {
    if (!audio) return;
    const settings = getParticipantOutputSettings(peerId);
    audio.volume = Math.min(1, Math.max(0, settings.volume / 100));
    applyParticipantVoiceGate(peerId, audio);
  }

  function handleParticipantOutputInput(event) {
    const range = event.target.closest(".participant-volume-range");
    if (!range || !dom.participantsGrid.contains(range)) return;
    const peerId = range.dataset.peerId || "";
    const member = state.participants.get(peerId);
    if (!member || peerId === state.selfPeerId) return;

    const settings = getParticipantOutputSettings(peerId);
    settings.volume = normalizeOutputVolume(range.value);
    range.value = String(settings.volume);
    updateVolumeRangeFill(range, settings.volume);
    range.setAttribute("aria-valuetext", `${settings.volume}%`);
    const value = range
      .closest(".participant-output-controls")
      ?.querySelector(".participant-volume-value");
    if (value) {
      value.value = `${settings.volume}%`;
      value.textContent = `${settings.volume}%`;
    }
    applyParticipantOutputSettings(peerId);
  }

  function handleParticipantOutputClick(event) {
    const removeButton = event.target.closest(".participant-remove-button");
    if (removeButton && dom.participantsGrid.contains(removeButton)) {
      openRemoveParticipantDialog(removeButton.dataset.peerId || "");
      return;
    }
    const button = event.target.closest(".participant-mute-button");
    if (!button || !dom.participantsGrid.contains(button)) return;
    const peerId = button.dataset.peerId || "";
    const member = state.participants.get(peerId);
    if (!member || peerId === state.selfPeerId) return;

    const settings = getParticipantOutputSettings(peerId);
    settings.muted = !settings.muted;
    applyParticipantVoiceGate(peerId);
    const card = button.closest(".participant-card");
    card?.classList.toggle("is-locally-muted", settings.muted);
    syncParticipantOutputControls(button.parentElement, member, settings);
    const status = card?.querySelector(".participant-state");
    if (status) {
      const speaking =
        state.speakingPeers.has(peerId) && !member.muted && !member.listener;
      status.textContent = participantStatusText(member, speaking);
    }
    if (!settings.muted) playParticipantOutput(peerId);
    showToast(
      settings.muted
        ? `${member.name} foi silenciado somente para você.`
        : `Você voltou a ouvir ${member.name}.`,
    );
  }

  function openRemoveParticipantDialog(peerId) {
    const member = state.participants.get(peerId);
    if (
      !state.isHost ||
      !member ||
      member.host ||
      peerId === state.selfPeerId
    ) {
      return;
    }
    state.pendingRemovalPeerId = peerId;
    dom.removeParticipantDescription.textContent = `${member.name} será desconectado desta sala. O chat continuará disponível para as outras pessoas.`;
    if (typeof dom.removeParticipantDialog.showModal === "function") {
      dom.removeParticipantDialog.returnValue = "cancel";
      dom.removeParticipantDialog.showModal();
    } else if (window.confirm(`Remover ${member.name} da sala?`)) {
      state.pendingRemovalPeerId = "";
      kickParticipant(peerId);
    }
  }

  function kickParticipant(peerId) {
    const member = state.participants.get(peerId);
    if (!state.isHost || !state.joined || !member || member.host) return;
    const token = state.memberResumeTokens.get(peerId);
    if (isValidResumeToken(token)) state.blockedResumeTokens.add(token);
    const connection = state.controlConnections.get(peerId);
    sendControl(connection, {
      type: "removed",
      version: CONFIG.protocolVersion,
      roomCode: state.roomCode,
    });
    broadcastControl(
      {
        type: "member-removed",
        version: CONFIG.protocolVersion,
        roomCode: state.roomCode,
        peerId,
      },
      peerId,
    );
    saveActiveSession();
    window.setTimeout(() => {
      removeHostMember(peerId, false, "removed");
    }, 180);
  }

  function playParticipantOutput(peerId) {
    const audio = state.remoteAudios.get(peerId);
    if (!audio || audio.muted) return;
    try {
      const playback = audio.play();
      playback
        ?.then(() => markRemoteMediaPlayback(audio, false))
        .catch(() => markRemoteMediaPlayback(audio, true));
    } catch (_) {
      markRemoteMediaPlayback(audio, true);
    }
  }

  function resetParticipantOutputSettings() {
    state.participantOutputSettings.clear();
  }

  function renderParticipants() {
    const members = Array.from(state.participants.values()).sort((a, b) => {
      if (a.host !== b.host) return a.host ? -1 : 1;
      if ((a.peerId === state.selfPeerId) !== (b.peerId === state.selfPeerId)) {
        return a.peerId === state.selfPeerId ? -1 : 1;
      }
      return a.name.localeCompare(b.name, "pt-BR");
    });

    const activeCardIds = new Set();
    members.forEach((member, index) => {
      const cardId = participantCardId(member.peerId);
      activeCardIds.add(cardId);
      let card = document.getElementById(cardId);
      if (!card || card.parentElement !== dom.participantsGrid) {
        card = createParticipantCard(member);
      } else {
        syncParticipantCard(card, member);
      }
      if (dom.participantsGrid.children[index] !== card) {
        dom.participantsGrid.insertBefore(
          card,
          dom.participantsGrid.children[index] || null,
        );
      }
    });
    Array.from(dom.participantsGrid.children).forEach((card) => {
      if (!activeCardIds.has(card.id)) card.remove();
    });
    dom.participantCount.textContent = String(members.length);
    dom.capacityCount.textContent = String(members.length);
    dom.capacityLimit.textContent = String(state.roomCapacity);
    dom.waitingCard.hidden = members.length !== 1;
  }

  function createParticipantCard(member) {
    const card = document.createElement("article");
    card.className = "participant-card";
    card.id = participantCardId(member.peerId);
    card.dataset.peerId = member.peerId;

    const avatar = document.createElement("div");
    avatar.className = "participant-avatar";
    const dot = document.createElement("span");
    dot.className = "participant-status-dot";
    dot.setAttribute("aria-hidden", "true");
    avatar.appendChild(dot);

    const info = document.createElement("div");
    info.className = "participant-info";
    const nameRow = document.createElement("div");
    nameRow.className = "participant-name-row";
    const name = document.createElement("strong");
    name.className = "participant-name";
    name.id = `${card.id}-name`;
    nameRow.appendChild(name);

    const status = document.createElement("p");
    status.className = "participant-state";

    info.append(nameRow, status);
    card.append(avatar, info);
    syncParticipantCard(card, member);
    return card;
  }

  function syncParticipantCard(card, member) {
    const isSelf = member.peerId === state.selfPeerId;
    const isSpeaking =
      state.speakingPeers.has(member.peerId) &&
      !member.muted &&
      !member.listener;
    const settings = isSelf
      ? null
      : getParticipantOutputSettings(member.peerId);
    card.dataset.color = String(hashString(member.peerId) % 4);
    card.classList.toggle("is-speaking", isSpeaking);
    card.classList.toggle("is-muted", member.muted || member.listener);
    card.classList.toggle("has-output-controls", !isSelf && !member.listener);
    const canRemove = state.isHost && !isSelf && !member.host;
    card.classList.toggle("has-remove-control", canRemove);
    card.classList.toggle("is-locally-muted", Boolean(settings?.muted));
    card.setAttribute("aria-labelledby", `${card.id}-name`);
    card.removeAttribute("aria-label");

    const avatar = card.querySelector(".participant-avatar");
    if (avatar?.firstChild?.nodeType === Node.TEXT_NODE) {
      avatar.firstChild.textContent = getInitials(member.name);
    } else if (avatar) {
      avatar.prepend(document.createTextNode(getInitials(member.name)));
    }

    const nameRow = card.querySelector(".participant-name-row");
    const name = card.querySelector(".participant-name");
    name.textContent = member.name;
    nameRow.replaceChildren(name);
    if (isSelf) nameRow.appendChild(createBadge("Você"));
    if (member.host) nameRow.appendChild(createBadge("Anfitrião", "host"));
    card.querySelector(".participant-state").textContent =
      participantStatusText(member, isSpeaking);

    syncParticipantRemoveControl(card, member, canRemove);

    const currentOutput = card.querySelector(
      ".participant-output-controls, .participant-output-unavailable",
    );
    if (isSelf) {
      currentOutput?.remove();
      return;
    }

    if (member.listener) {
      currentOutput?.remove();
      return;
    }

    let controls = currentOutput;
    if (!controls?.classList.contains("participant-output-controls")) {
      controls?.remove();
      controls = createParticipantOutputControls(member);
      card.appendChild(controls);
    }
    syncParticipantOutputControls(controls, member, settings);
  }

  function syncParticipantRemoveControl(card, member, canRemove) {
    let button = card.querySelector(".participant-remove-button");
    if (!canRemove) {
      button?.remove();
      return;
    }
    if (!button) {
      button = document.createElement("button");
      button.className = "participant-remove-button";
      button.type = "button";
      const icon = document.createElement("img");
      icon.src = "src/icons/exit.png";
      icon.alt = "";
      icon.width = 17;
      icon.height = 17;
      icon.setAttribute("aria-hidden", "true");
      button.appendChild(icon);
      card.appendChild(button);
    }
    button.dataset.peerId = member.peerId;
    button.setAttribute("aria-label", `Remover ${member.name} da sala`);
    button.title = `Remover ${member.name} da sala`;
  }

  function createParticipantOutputControls(member) {
    const controls = document.createElement("div");
    controls.className = "participant-output-controls";

    const rangeId = `participant-volume-${member.peerId}`;
    const label = document.createElement("label");
    label.className = "visually-hidden";
    label.htmlFor = rangeId;
    label.textContent = `Volume de ${member.name} somente para você`;

    const range = document.createElement("input");
    range.className = "volume-range participant-volume-range";
    range.id = rangeId;
    range.type = "range";
    range.min = "0";
    range.max = "100";
    range.step = "1";
    range.dataset.peerId = member.peerId;

    const value = document.createElement("output");
    value.className = "participant-volume-value";
    value.setAttribute("for", rangeId);

    const muteButton = document.createElement("button");
    muteButton.className = "participant-mute-button";
    muteButton.type = "button";
    muteButton.dataset.peerId = member.peerId;

    controls.append(label, range, value, muteButton);
    return controls;
  }

  function syncParticipantOutputControls(controls, member, settings) {
    const range = controls.querySelector(".participant-volume-range");
    const value = controls.querySelector(".participant-volume-value");
    const muteButton = controls.querySelector(".participant-mute-button");
    const label = controls.querySelector("label");
    range.value = String(settings.volume);
    updateVolumeRangeFill(range, settings.volume);
    range.setAttribute("aria-valuetext", `${settings.volume}%`);
    value.value = `${settings.volume}%`;
    value.textContent = `${settings.volume}%`;
    label.textContent = `Volume de ${member.name} somente para você`;
    muteButton.setAttribute("aria-pressed", String(settings.muted));
    muteButton.setAttribute(
      "aria-label",
      settings.muted
        ? `Voltar a ouvir ${member.name} somente para você`
        : `Silenciar ${member.name} somente para você`,
    );
    const icon = document.createElement("span");
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = settings.muted ? "×" : "◖";
    const text = document.createElement("span");
    text.textContent = settings.muted ? "Ouvir" : "Silenciar";
    muteButton.replaceChildren(icon, text);
  }

  function updateVolumeRangeFill(range, volume) {
    range.style.setProperty(
      "--volume-fill",
      `${normalizeOutputVolume(volume)}%`,
    );
  }

  function createBadge(label, extraClass = "") {
    const badge = document.createElement("span");
    badge.className = `participant-badge ${extraClass}`.trim();
    badge.textContent = label;
    return badge;
  }

  function participantStatusText(member, speaking = false) {
    const locallyMuted =
      member.peerId !== state.selfPeerId &&
      state.participantOutputSettings.get(member.peerId)?.muted;
    if (member.reconnecting) return "Reconectando…";
    if (
      (member.peerId === state.selfPeerId && hasActiveScreenShare()) ||
      state.remoteScreenVideos.has(member.peerId)
    ) {
      return "Compartilhando tela";
    }
    if (locallyMuted) return "Silenciado por você";
    if (member.listener) return "Somente ouvindo";
    if (member.muted) return "Microfone silenciado";
    if (speaking) return "Falando agora";
    return "Na sala";
  }

  function toggleMute() {
    if (!isLocalVoiceAllowed()) {
      showToast(
        "O anfitrião definiu esta sala apenas para ouvir. Seu microfone não será enviado.",
        "error",
      );
      return;
    }
    const track = state.localStream?.getAudioTracks()[0];
    if (!track || !state.microphoneGranted) {
      void requestMicrophone();
      return;
    }

    state.muted = !state.muted;
    syncLocalAudioGates();
    void publishCurrentVoiceTrackToCalls();
    const self = state.participants.get(state.selfPeerId);
    if (self) self.muted = state.muted;
    if (state.muted) setSpeaking(state.selfPeerId, false);

    updateMuteControl();
    renderParticipants();
    sendLocalMemberState();
    saveActiveSession();
    showToast(state.muted ? "Microfone silenciado." : "Microfone ativado.");
  }

  function updateMuteControl() {
    const voiceBlocked = !isLocalVoiceAllowed();
    const listener = getLocalListenerState();
    const roomUnavailable = !state.joined || state.restoring;
    const microphoneBusy = state.switchingMicrophone;
    const microphoneEnabled = !listener && !state.muted;
    dom.muteButton.classList.toggle("is-muted", state.muted && !listener);
    dom.muteButton.classList.toggle("is-listener", listener);
    dom.muteButton.dataset.microphoneState = microphoneEnabled ? "on" : "off";
    dom.muteButtonIcon.src = microphoneEnabled
      ? ICON_PATHS.microphoneOn
      : ICON_PATHS.microphoneOff;
    dom.muteButtonLabel.textContent = roomUnavailable
      ? state.restoring
        ? "Restaurando…"
        : "Indisponível"
      : microphoneBusy
        ? listener
          ? "Permitindo…"
          : "Trocando…"
        : listener
          ? voiceBlocked
            ? "Voz bloqueada"
            : "Ativar"
          : state.muted
            ? "Ativar"
            : "Silenciar";
    dom.muteButton.setAttribute(
      "aria-label",
      roomUnavailable
        ? state.restoring
          ? "Restaurando a conexão com a sala"
          : "Microfone indisponível fora da sala"
        : microphoneBusy
          ? listener
            ? "Aguardando permissão para usar o microfone"
            : "Trocando o microfone"
          : listener
            ? voiceBlocked
              ? "O anfitrião não permitiu microfone aos participantes"
              : "Ativar microfone"
            : state.muted
              ? "Ativar microfone"
              : "Silenciar microfone",
    );
    dom.muteButton.setAttribute(
      "aria-pressed",
      String(!listener && state.muted),
    );
    dom.muteButton.setAttribute(
      "aria-busy",
      String(microphoneBusy || state.restoring),
    );
    dom.muteButton.disabled = voiceBlocked || roomUnavailable || microphoneBusy;
  }

  function sendLocalMemberState() {
    const self = state.participants.get(state.selfPeerId);
    if (!self) return;
    self.listener = getLocalListenerState();
    self.muted = self.listener ? true : state.muted;

    if (state.isHost) {
      broadcastControl({
        type: "member-state",
        version: CONFIG.protocolVersion,
        roomCode: state.roomCode,
        peerId: state.selfPeerId,
        muted: self.muted,
        listener: self.listener,
      });
    } else {
      sendControl(state.hostConnection, {
        type: "state",
        version: CONFIG.protocolVersion,
        roomCode: state.roomCode,
        muted: self.muted,
        listener: self.listener,
      });
    }
  }

  function handleLocalMicrophoneEnded() {
    if (state.pageHiding) return;
    stopVoiceMonitor();
    detachVoiceInput(state.localStream);
    state.microphoneGranted = false;
    state.muted = true;
    syncLocalAudioGates();
    removeAnalysisNode(state.selfPeerId);
    const self = state.participants.get(state.selfPeerId);
    if (self) {
      self.muted = true;
      self.listener = true;
      sendLocalMemberState();
      renderParticipants();
      updateMuteControl();
      showToast("O microfone foi desconectado.", "error");
    }
    setAudioInputStatus(
      "O microfone atual foi desconectado. Escolha outra entrada.",
      true,
    );
    updateAudioInputSelectorState();
    syncVoiceEqualizerUI();
    refreshAudioInputDevices();
    saveActiveSession();
  }

  async function ensureVoiceEngine(inputStream) {
    const expectedGeneration = state.mediaGeneration;
    const context = await ensureAudioContext();
    if (!context?.createMediaStreamDestination) return null;

    let engine = state.voiceEngine;
    if (
      !engine ||
      engine.context !== context ||
      engine.outputTrack.readyState !== "live"
    ) {
      if (engine) {
        stopVoiceEngine();
        engine = null;
      }
      if (!state.voiceEnginePromise) {
        const engineGeneration = ++state.voiceEngineGeneration;
        const promise = createVoiceEngine(
          context,
          inputStream,
          engineGeneration,
        );
        state.voiceEnginePromise = promise;
        promise.then(
          () => {
            if (state.voiceEnginePromise === promise)
              state.voiceEnginePromise = null;
          },
          () => {
            if (state.voiceEnginePromise === promise)
              state.voiceEnginePromise = null;
          },
        );
      }
      engine = await state.voiceEnginePromise;
    }

    if (!engine) return null;
    if (
      expectedGeneration !== state.mediaGeneration ||
      state.pageHiding ||
      !inputStream
        ?.getAudioTracks()
        .some((track) => track.readyState === "live")
    ) {
      window.setTimeout(() => {
        if (state.voiceEngine === engine && !engine.inputStream)
          stopVoiceEngine();
      }, 0);
      return null;
    }
    if (engine.inputStream !== inputStream)
      attachVoiceInput(engine, inputStream);
    applyVoiceSettingsToEngine();
    syncLocalAudioGates();
    return engine;
  }

  async function createVoiceEngine(
    context,
    inputStream = null,
    engineGeneration = state.voiceEngineGeneration,
  ) {
    const highpass = context.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.value = 70;
    highpass.Q.value = 0.7;

    const bass = context.createBiquadFilter();
    bass.type = "lowshelf";
    bass.frequency.value = 180;
    const mid = context.createBiquadFilter();
    mid.type = "peaking";
    mid.frequency.value = 1100;
    mid.Q.value = 0.82;
    const treble = context.createBiquadFilter();
    treble.type = "highshelf";
    treble.frequency.value = 3800;

    const fallbackGain = context.createGain();
    fallbackGain.gain.value = 1;
    const effectGain = context.createGain();
    effectGain.gain.value = 0;
    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -10;
    compressor.knee.value = 5;
    compressor.ratio.value = 12;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.16;
    const outboundGain = context.createGain();
    outboundGain.gain.value = 0;
    const monitorGain = context.createGain();
    monitorGain.gain.value = 0;
    const destination = context.createMediaStreamDestination();
    const outputTrack = destination.stream.getAudioTracks()[0];
    if (!outputTrack) throw new Error("voice-output-unavailable");

    highpass.connect(bass);
    bass.connect(mid);
    mid.connect(treble);
    treble.connect(fallbackGain);
    fallbackGain.connect(compressor);
    compressor.connect(outboundGain);
    outboundGain.connect(destination);
    compressor.connect(monitorGain);
    monitorGain.connect(context.destination);

    const engine = {
      context,
      source: null,
      inputStream: null,
      highpass,
      bass,
      mid,
      treble,
      fallbackGain,
      effectGain,
      worklet: null,
      workletAvailable: false,
      compressor,
      outboundGain,
      monitorGain,
      destination,
      outboundStream: destination.stream,
      outputTrack,
      contextStateHandler: null,
    };

    if (engineGeneration !== state.voiceEngineGeneration) {
      destroyDetachedVoiceEngine(engine);
      return null;
    }
    state.voiceEngine = engine;
    if (inputStream?.getAudioTracks().length)
      attachVoiceInput(engine, inputStream);

    try {
      await loadVoiceWorklet(context);
      if (engineGeneration !== state.voiceEngineGeneration) {
        destroyDetachedVoiceEngine(engine);
        return null;
      }
      const worklet = new AudioWorkletNode(context, "cloak-voice-effects", {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [1],
        channelCount: 1,
        channelCountMode: "explicit",
      });
      engine.worklet = worklet;
      engine.workletAvailable = true;
      treble.connect(worklet);
      worklet.connect(effectGain);
      effectGain.connect(compressor);
      worklet.addEventListener("processorerror", () => {
        if (state.voiceEngine !== engine) return;
        engine.workletAvailable = false;
        fadeAudioParam(engine.effectGain.gain, 0, 0.012);
        fadeAudioParam(engine.fallbackGain.gain, 1, 0.012);
        syncVoiceEqualizerUI();
        setEqualizerStatus(
          "Os efeitos especiais pararam. Sua voz natural continua ativa.",
          true,
        );
      });
      fadeAudioParam(fallbackGain.gain, 0, 0.012);
      fadeAudioParam(effectGain.gain, 1, 0.012);
    } catch (_) {
      engine.workletAvailable = false;
    }

    if (engineGeneration !== state.voiceEngineGeneration) {
      destroyDetachedVoiceEngine(engine);
      return null;
    }

    engine.contextStateHandler = () => {
      if (state.voiceEngine === engine && state.joined) {
        updateMediaUnlockControl();
        void publishCurrentVoiceTrackToCalls();
      }
    };
    context.addEventListener("statechange", engine.contextStateHandler);
    return engine;
  }

  function loadVoiceWorklet(context) {
    if (!context.audioWorklet?.addModule) {
      return Promise.reject(new Error("audio-worklet-unavailable"));
    }
    if (state.voiceWorkletPromise?.context === context) {
      return state.voiceWorkletPromise.promise;
    }
    const promise = context.audioWorklet.addModule(
      new URL("voice-effects-processor.js?v=1", document.baseURI),
    );
    state.voiceWorkletPromise = { context, promise };
    promise.catch(() => {
      if (state.voiceWorkletPromise?.promise === promise) {
        state.voiceWorkletPromise = null;
      }
    });
    return promise;
  }

  function attachVoiceInput(engine, stream) {
    if (!stream?.getAudioTracks().length) {
      throw new Error("microphone-missing-track");
    }
    const nextSource = engine.context.createMediaStreamSource(stream);
    nextSource.connect(engine.highpass);
    const previousSource = engine.source;
    engine.source = nextSource;
    engine.inputStream = stream;
    try {
      previousSource?.disconnect();
    } catch (_) {
      // A fonte anterior pode já ter sido desconectada pelo navegador.
    }
  }

  function detachVoiceInput(stream = null) {
    const engine = state.voiceEngine;
    if (!engine || (stream && engine.inputStream !== stream)) return;
    try {
      engine.source?.disconnect();
    } catch (_) {
      // A fonte já estava desconectada.
    }
    engine.source = null;
    engine.inputStream = null;
    fadeAudioParam(engine.outboundGain.gain, 0, 0.006);
  }

  function voiceEffectParameters(settings) {
    const amount = settings.intensity / 100;
    const parameters = {
      pitchSemitones: 0,
      robotAmount: 0,
      robotFrequency: 45,
      electronicAmount: 0,
      effectMix: 1,
      outputGain: 0.9,
    };
    if (settings.preset === "thin") {
      parameters.pitchSemitones = 7 * amount;
    } else if (settings.preset === "deep") {
      parameters.pitchSemitones = -7 * amount;
    } else if (settings.preset === "robot") {
      parameters.pitchSemitones = -1.2 * amount;
      parameters.robotAmount = 0.9 * amount;
      parameters.robotFrequency = 45;
      parameters.electronicAmount = 0.1 * amount;
    } else if (settings.preset === "electronic") {
      parameters.pitchSemitones = 2.5 * amount;
      parameters.robotAmount = 0.16 * amount;
      parameters.robotFrequency = 72;
      parameters.electronicAmount = 0.84 * amount;
    }
    return parameters;
  }

  function applyVoiceSettingsToEngine() {
    const engine = state.voiceEngine;
    if (!engine) return;
    const settings = parseVoiceSettings(state.voiceSettings);
    if (!settings) return;
    state.voiceSettings = settings;
    fadeAudioParam(engine.bass.gain, settings.bass, 0.025);
    fadeAudioParam(engine.mid.gain, settings.mid, 0.025);
    fadeAudioParam(engine.treble.gain, settings.treble, 0.025);
    if (engine.workletAvailable && engine.worklet) {
      const parameters = voiceEffectParameters(settings);
      Object.entries(parameters).forEach(([name, value]) => {
        const parameter = engine.worklet.parameters.get(name);
        if (parameter) fadeAudioParam(parameter, value, 0.025);
      });
    }
  }

  function fadeAudioParam(parameter, value, timeConstant = 0.02) {
    if (!parameter) return;
    const context = state.audioContext || state.voiceEngine?.context;
    const now = context?.currentTime || 0;
    try {
      parameter.cancelScheduledValues(now);
      parameter.setTargetAtTime(value, now, timeConstant);
    } catch (_) {
      parameter.value = value;
    }
  }

  function getProcessedVoiceStream() {
    const engine = state.voiceEngine;
    return engine?.outputTrack?.readyState === "live"
      ? engine.outboundStream
      : null;
  }

  function getPreferredVoiceTrack() {
    if (!isLocalVoiceAllowed()) return null;
    const engine = state.voiceEngine;
    const processedTrack = engine?.outputTrack;
    const rawTrack = state.localStream?.getAudioTracks()[0];
    if (
      processedTrack?.readyState === "live" &&
      engine.context?.state === "running"
    ) {
      return processedTrack;
    }
    if (state.voicePreparing) return null;
    return rawTrack?.readyState === "live" ? rawTrack : null;
  }

  function syncLocalAudioGates() {
    const voiceAllowed = isLocalVoiceAllowed();
    const rawTrack = state.localStream?.getAudioTracks()[0];
    if (rawTrack?.readyState === "live") {
      rawTrack.enabled =
        (voiceAllowed && !state.muted) || state.voiceMonitoring;
    }
    const engine = state.voiceEngine;
    if (!engine) return;
    const hasInput = Boolean(
      engine.inputStream
        ?.getAudioTracks()
        .some((track) => track.readyState === "live"),
    );
    engine.outputTrack.enabled = hasInput && voiceAllowed && !state.muted;
    fadeAudioParam(
      engine.outboundGain.gain,
      hasInput && voiceAllowed && !state.muted ? 1 : 0,
      0.006,
    );
    fadeAudioParam(
      engine.monitorGain.gain,
      hasInput && state.voiceMonitoring ? 0.42 : 0,
      0.012,
    );
  }

  async function publishCurrentVoiceTrackToCalls() {
    const track = getOutboundStream().getAudioTracks()[0];
    if (!track || !state.joined || state.leaving) return false;
    let published = true;
    await Promise.allSettled(
      Array.from(state.mediaCalls.entries()).map(async ([peerId, call]) => {
        if (state.mediaCalls.get(peerId) !== call) return;
        const sender = getAudioSender(call);
        if (!sender?.replaceTrack) {
          published = false;
          closeMediaForPeer(peerId);
          return;
        }
        if (sender.track !== track) {
          try {
            await sender.replaceTrack(track);
          } catch (_) {
            published = false;
            if (state.mediaCalls.get(peerId) === call)
              closeMediaForPeer(peerId);
          }
        }
      }),
    );
    return published;
  }

  function stopVoiceEngine() {
    stopVoiceMonitor();
    const engine = state.voiceEngine;
    state.voiceEngineGeneration += 1;
    state.voiceEngine = null;
    state.voiceEnginePromise = null;
    if (!engine) return;
    if (engine.contextStateHandler) {
      engine.context.removeEventListener(
        "statechange",
        engine.contextStateHandler,
      );
    }
    [
      engine.source,
      engine.highpass,
      engine.bass,
      engine.mid,
      engine.treble,
      engine.fallbackGain,
      engine.effectGain,
      engine.worklet,
      engine.compressor,
      engine.outboundGain,
      engine.monitorGain,
      engine.destination,
    ].forEach((node) => {
      try {
        node?.disconnect();
      } catch (_) {
        // O nó já pode estar desconectado.
      }
    });
    try {
      engine.worklet?.port?.close();
    } catch (_) {
      // O processador já foi finalizado.
    }
    engine.outboundStream.getTracks().forEach((track) => track.stop());
  }

  function destroyDetachedVoiceEngine(engine) {
    if (!engine) return;
    [
      engine.source,
      engine.highpass,
      engine.bass,
      engine.mid,
      engine.treble,
      engine.fallbackGain,
      engine.effectGain,
      engine.worklet,
      engine.compressor,
      engine.outboundGain,
      engine.monitorGain,
      engine.destination,
    ].forEach((node) => {
      try {
        node?.disconnect();
      } catch (_) {
        // O nó obsoleto já pode estar desconectado.
      }
    });
    try {
      engine.worklet?.port?.close();
    } catch (_) {
      // O processador obsoleto já foi finalizado.
    }
    engine.outboundStream?.getTracks().forEach((track) => track.stop());
  }

  function openVoiceEqualizer() {
    syncVoiceEqualizerUI();
    if (typeof dom.equalizerDialog.showModal === "function") {
      dom.equalizerDialog.showModal();
    } else {
      dom.equalizerDialog.setAttribute("open", "");
    }
    requestAnimationFrame(() => {
      dom.voicePresets.querySelector("input:checked")?.focus();
    });
  }

  function handleVoicePresetChange(event) {
    const input = event.target.closest('input[name="voice-preset"]');
    if (
      !input ||
      !Object.prototype.hasOwnProperty.call(VOICE_PRESETS, input.value)
    )
      return;
    const preset = VOICE_PRESETS[input.value];
    state.voiceSettings = {
      preset: input.value,
      bass: preset.bass,
      mid: preset.mid,
      treble: preset.treble,
      intensity: preset.intensity,
    };
    applyVoiceSettingsToEngine();
    syncVoiceEqualizerUI();
    saveActiveSession();
    if (
      input.value !== "natural" &&
      state.voiceEngine &&
      !state.voiceEngine.workletAvailable
    ) {
      setEqualizerStatus(
        "Este navegador aplicará o ajuste de tom, mas não o efeito especial.",
        true,
      );
    } else {
      setEqualizerStatus(`Estilo ${preset.label} aplicado à sua voz.`);
    }
  }

  function handleVoiceAdjustmentInput() {
    state.voiceSettings = {
      ...state.voiceSettings,
      bass: clampVoiceValue(dom.voiceBass.value, -12, 12),
      mid: clampVoiceValue(dom.voiceMid.value, -12, 12),
      treble: clampVoiceValue(dom.voiceTreble.value, -12, 12),
      intensity: clampVoiceValue(dom.voiceIntensity.value, 0, 100),
    };
    applyVoiceSettingsToEngine();
    syncVoiceEqualizerUI();
    saveActiveSession();
  }

  function announceVoiceAdjustment() {
    setEqualizerStatus(
      `Ajuste personalizado do estilo ${VOICE_PRESETS[state.voiceSettings.preset].label}.`,
    );
  }

  function resetVoiceEqualizer() {
    state.voiceSettings = createNaturalVoiceSettings();
    applyVoiceSettingsToEngine();
    syncVoiceEqualizerUI();
    saveActiveSession();
    setEqualizerStatus("Voz natural restaurada.");
  }

  function saveVoiceProfile() {
    const saved = storeVoiceProfile();
    setEqualizerStatus(
      saved
        ? "Padrão salvo neste dispositivo para as próximas salas."
        : "O navegador não permitiu salvar o padrão.",
      !saved,
    );
    if (saved) showToast("Equalizador definido como padrão.");
  }

  async function toggleVoiceMonitor() {
    if (state.voiceMonitoring) {
      stopVoiceMonitor();
      setEqualizerStatus("Teste de voz encerrado.");
      return;
    }
    const rawTrack = state.localStream?.getAudioTracks()[0];
    if (
      !state.microphoneGranted ||
      !rawTrack ||
      rawTrack.readyState !== "live"
    ) {
      setEqualizerStatus(
        "Ative um microfone para ouvir o teste da sua voz.",
        true,
      );
      return;
    }
    try {
      const engine = await ensureVoiceEngine(state.localStream);
      await resumeAudioContext();
      if (!engine || engine.context.state !== "running") {
        throw new Error("voice-monitor-blocked");
      }
      if (state.muted && state.joined) {
        await publishCurrentVoiceTrackToCalls();
      }
      state.voiceMonitoring = true;
      syncLocalAudioGates();
      syncVoiceEqualizerUI();
      setEqualizerStatus("Teste ativo. Use fones para evitar eco.");
    } catch (_) {
      stopVoiceMonitor();
      setEqualizerStatus(
        "Não foi possível iniciar o teste de voz neste navegador.",
        true,
      );
    }
  }

  function stopVoiceMonitor() {
    state.voiceMonitoring = false;
    if (state.voiceEngine) {
      fadeAudioParam(state.voiceEngine.monitorGain.gain, 0, 0.008);
    }
    syncLocalAudioGates();
    if (dom.voiceMonitorButton) {
      dom.voiceMonitorButton.setAttribute("aria-pressed", "false");
      dom.voiceMonitorLabel.textContent = "Ouvir minha voz";
    }
  }

  function syncVoiceEqualizerUI() {
    const settings =
      parseVoiceSettings(state.voiceSettings) || createNaturalVoiceSettings();
    state.voiceSettings = settings;
    const preset = VOICE_PRESETS[settings.preset];
    dom.voicePresets
      .querySelectorAll('input[name="voice-preset"]')
      .forEach((input) => {
        input.checked = input.value === settings.preset;
      });
    const ranges = [
      [dom.voiceBass, dom.voiceBassValue, settings.bass, "dB"],
      [dom.voiceMid, dom.voiceMidValue, settings.mid, "dB"],
      [dom.voiceTreble, dom.voiceTrebleValue, settings.treble, "dB"],
      [dom.voiceIntensity, dom.voiceIntensityValue, settings.intensity, "%"],
    ];
    ranges.forEach(([range, output, value, unit]) => {
      range.value = String(value);
      output.textContent =
        unit === "dB" ? `${value > 0 ? "+" : ""}${value} dB` : `${value}%`;
      updateVoiceRangeFill(range, value);
    });

    const active =
      (settings.preset !== "natural" && settings.intensity > 0) ||
      settings.bass !== 0 ||
      settings.mid !== 0 ||
      settings.treble !== 0;
    dom.voiceEqualizerButton.classList.toggle("has-active-effect", active);
    dom.voiceEqualizerButton.setAttribute(
      "aria-label",
      `Abrir equalizador de voz, estilo ${preset.label}`,
    );
    dom.voiceEqualizerButton.title = `Equalizador: ${preset.label}`;
    dom.voiceMonitorButton.disabled = !(
      state.microphoneGranted &&
      state.localStream
        ?.getAudioTracks()
        .some((track) => track.readyState === "live")
    );
    dom.voiceMonitorButton.setAttribute(
      "aria-pressed",
      String(state.voiceMonitoring),
    );
    dom.voiceMonitorLabel.textContent = state.voiceMonitoring
      ? "Parar teste"
      : "Ouvir minha voz";
  }

  function updateVoiceRangeFill(range, value) {
    const minimum = Number(range.min) || 0;
    const maximum = Number(range.max) || 100;
    const progress = ((Number(value) - minimum) / (maximum - minimum)) * 100;
    range.style.setProperty(
      "--effect-fill",
      `${Math.min(100, Math.max(0, progress))}%`,
    );
    range.setAttribute(
      "aria-valuetext",
      range === dom.voiceIntensity
        ? `${value}%`
        : `${value > 0 ? "+" : ""}${value} decibéis`,
    );
  }

  function setEqualizerStatus(message, isError = false) {
    dom.equalizerStatus.textContent = message;
    dom.equalizerStatus.classList.toggle("is-error", isError);
  }

  async function ensureAudioContext() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!state.audioContext || state.audioContext.state === "closed") {
      state.audioContext = new AudioContextClass();
    }
    await resumeAudioContext();
    return state.audioContext;
  }

  async function resumeAudioContext() {
    if (state.audioContext?.state === "suspended") {
      try {
        await state.audioContext.resume();
      } catch (_) {
        // O botão de desbloqueio continuará disponível se necessário.
      }
    }
    if (
      state.joined &&
      state.voiceEngine?.context.state === "running" &&
      !state.leaving
    ) {
      void publishCurrentVoiceTrackToCalls();
    }
  }

  async function addAnalysisNode(peerId, stream, readyContext = null) {
    removeAnalysisNode(peerId);
    if (!stream?.getAudioTracks().length) return;
    const context = readyContext || (await ensureAudioContext());
    if (!context) return;

    try {
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.78;
      source.connect(analyser);
      state.analysisNodes.set(peerId, {
        source,
        analyser,
        data: new Uint8Array(analyser.fftSize),
        activeFrames: 0,
        quietFrames: 0,
      });
      startAnalysisLoop();
    } catch (_) {
      // Indicador de fala é apenas um aprimoramento visual.
    }
  }

  function startAnalysisLoop() {
    if (state.analysisFrame) return;

    const analyse = () => {
      if (!state.analysisNodes.size) {
        state.analysisFrame = 0;
        return;
      }

      state.analysisNodes.forEach((node, peerId) => {
        const member = state.participants.get(peerId);
        if (!member || member.muted || member.listener) {
          node.activeFrames = 0;
          node.quietFrames += 1;
          if (node.quietFrames > 2) setSpeaking(peerId, false);
          return;
        }

        const level = getAudioLevel(node.analyser, node.data);
        if (level > 0.038) {
          node.activeFrames += 1;
          node.quietFrames = 0;
          if (node.activeFrames >= 2) setSpeaking(peerId, true);
        } else {
          node.activeFrames = 0;
          node.quietFrames += 1;
          if (node.quietFrames >= 7) setSpeaking(peerId, false);
        }
      });

      state.analysisFrame = window.requestAnimationFrame(analyse);
    };

    state.analysisFrame = window.requestAnimationFrame(analyse);
  }

  function getAudioLevel(analyser, data) {
    analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (let index = 0; index < data.length; index += 1) {
      const sample = (data[index] - 128) / 128;
      sum += sample * sample;
    }
    return Math.sqrt(sum / data.length);
  }

  function setSpeaking(peerId, speaking) {
    const wasSpeaking = state.speakingPeers.has(peerId);
    if (speaking === wasSpeaking) return;
    if (speaking) state.speakingPeers.add(peerId);
    else state.speakingPeers.delete(peerId);

    const card = document.getElementById(participantCardId(peerId));
    const member = state.participants.get(peerId);
    if (!card || !member) return;
    card.classList.toggle("is-speaking", speaking);
    const status = card.querySelector(".participant-state");
    if (status) status.textContent = participantStatusText(member, speaking);
  }

  function removeAnalysisNode(peerId) {
    const node = state.analysisNodes.get(peerId);
    if (node) {
      try {
        node.source.disconnect();
        node.analyser.disconnect();
      } catch (_) {
        // Nós já desconectados.
      }
      state.analysisNodes.delete(peerId);
    }
    setSpeaking(peerId, false);
  }

  function stopAllAnalysis(closeContext) {
    cancelAnimationFrame(state.analysisFrame);
    state.analysisFrame = 0;
    Array.from(state.analysisNodes.keys()).forEach(removeAnalysisNode);
    state.speakingPeers.clear();
    if (closeContext && state.audioContext) {
      const context = state.audioContext;
      state.audioContext = null;
      state.voiceWorkletPromise = null;
      context.close().catch(() => {});
    }
  }

  function openLeaveDialog() {
    dom.leaveDialogDescription.textContent = state.isHost
      ? "Como você criou esta sala, a conversa será encerrada e todo o chat será apagado."
      : "Você deixará esta conversa, e o chat deste dispositivo será apagado.";

    if (typeof dom.leaveDialog.showModal === "function") {
      dom.leaveDialog.returnValue = "cancel";
      dom.leaveDialog.showModal();
    } else if (window.confirm(dom.leaveDialogDescription.textContent)) {
      leaveCurrentRoom(true);
    }
  }

  function leaveCurrentRoom(notify) {
    if (!state.joined && !state.peer && !state.restoring) return;
    const previousCode = state.roomCode;
    const allowDepartureMessage = notify && state.joined;

    clearActiveSession();
    if (allowDepartureMessage) notifyDeparture();
    state.restoring = false;
    state.leaving = true;
    state.guestReconnectGeneration += 1;
    clearTimeout(state.guestReconnectTimer);
    clearRoomHash();
    showScreen("home");
    document.title = "Cloak — Voz e tela em salas privadas";
    showToast("Você saiu da sala.");

    const finishDeparture = () => {
      closeNetworkConnections(true);
      resetMicrophoneControls();
      resetSessionIdentity();
      dom.roomCode.value = formatRoomCode(previousCode);
    };
    if (allowDepartureMessage) window.setTimeout(finishDeparture, 180);
    else finishDeparture();
  }

  function remoteRoomClosed(message) {
    if (state.leaving) return;
    const previousCode = state.roomCode;
    clearActiveSession();
    closeNetworkConnections(true);
    clearRoomHash();
    resetMicrophoneControls();
    resetSessionIdentity();
    dom.roomCode.value = formatRoomCode(previousCode);
    showScreen("home");
    document.title = "Cloak — Voz e tela em salas privadas";
    showToast(message, "error");
  }

  function notifyDeparture() {
    if (!state.joined || state.leaving) return;

    if (state.isHost) {
      broadcastControl({
        type: "room-closed",
        version: CONFIG.protocolVersion,
        roomCode: state.roomCode,
      });
    } else {
      sendControl(state.hostConnection, {
        type: "leave",
        version: CONFIG.protocolVersion,
        roomCode: state.roomCode,
      });
    }
  }

  function closeNetworkConnections(stopMedia) {
    const previousLeaving = state.leaving;
    state.leaving = true;
    state.joined = false;
    stopScreenShare(false);
    closeAllRemoteScreenShares();
    clearTimeout(state.reconnectTimer);
    clearTimeout(state.guestReconnectTimer);
    state.guestReconnectTimer = 0;
    state.guestReconnectGeneration += 1;
    state.guestReconnecting = false;

    if (state.pendingJoin) {
      const pendingJoin = state.pendingJoin;
      state.pendingJoin = null;
      pendingJoin.reject(createAppError("cancelled", "Entrada cancelada."));
    }

    if (state.pendingReady) {
      const pendingReady = state.pendingReady;
      state.pendingReady = null;
      pendingReady.reject(createAppError("cancelled", "Entrada cancelada."));
    }

    state.pendingMembers.forEach((pending) => {
      clearTimeout(pending.readyTimer);
      try {
        pending.connection.close();
      } catch (_) {
        // Conexão já encerrada.
      }
    });
    state.pendingMembers.clear();
    state.memberReconnectTimers.forEach(clearTimeout);
    state.memberReconnectTimers.clear();
    state.memberResumeTokens.clear();

    state.pendingMediaCalls.forEach((entries) => {
      entries.forEach(({ call, timer }) => {
        clearTimeout(timer);
        safeCloseCall(call);
      });
    });
    state.pendingMediaCalls.clear();

    state.pendingScreenCalls.forEach((entries) => {
      entries.forEach(({ call, timer }) => {
        clearTimeout(timer);
        safeCloseCall(call);
      });
    });
    state.pendingScreenCalls.clear();

    state.mediaRetryState.forEach(({ timer }) => clearTimeout(timer));
    state.mediaRetryState.clear();

    state.mediaCalls.forEach(safeCloseCall);
    state.mediaCalls.clear();
    state.outgoingScreenCalls.forEach(safeCloseCall);
    state.outgoingScreenCalls.clear();
    state.incomingScreenCalls.forEach(safeCloseCall);
    state.incomingScreenCalls.clear();
    state.remoteAudios.forEach((audio) => {
      audio.pause();
      audio.srcObject = null;
      audio.remove();
    });
    state.remoteAudios.clear();
    state.blockedRemoteMedia.clear();
    resetParticipantOutputSettings();

    state.controlConnections.forEach((connection) => {
      try {
        connection.close();
      } catch (_) {
        // Conexão já encerrada.
      }
    });
    state.controlConnections.clear();

    if (state.hostConnection) {
      try {
        state.hostConnection.close();
      } catch (_) {
        // Conexão já encerrada.
      }
      state.hostConnection = null;
    }

    safeDestroyPeer(state.peer);
    state.peer = null;
    state.selfPeerId = "";
    state.hostPeerId = "";
    state.participants.clear();
    resetChat();
    dom.remoteAudioContainer.replaceChildren();
    dom.screenShareGrid.replaceChildren();
    syncScreenShareStage();
    dom.enableAudioButton.hidden = true;
    dom.enableAudioButton.textContent = "Ativar mídia recebida";
    if (stopMedia) stopVoiceEngine();
    stopAllAnalysis(stopMedia);

    if (stopMedia) {
      cancelAllMediaCapture();
      stopSilentStream();
      state.silentStream = null;
      state.microphoneGranted = false;
      state.enteredWithMicrophone = false;
      state.selectedAudioInputId = "";
      state.audioInputDevices = [];
      state.muted = true;
    }

    state.leaving = previousLeaving;
  }

  function stopLocalTracks() {
    stopVoiceEngine();
    const streams = new Set(
      [state.localStream, state.pendingLocalStream].filter(Boolean),
    );
    streams.forEach((stream) =>
      stream.getTracks().forEach((track) => track.stop()),
    );
    state.localStream = null;
    state.pendingLocalStream = null;
  }

  function cancelAllMediaCapture() {
    state.mediaGeneration += 1;
    state.switchingMicrophone = false;
    state.voicePreparing = false;
    clearTimeout(state.deviceRefreshTimer);
    stopLocalTracks();
  }

  function resetSessionIdentity() {
    state.mode = null;
    state.roomCode = "";
    state.displayName = "";
    state.roomName = "";
    state.roomCapacity = CONFIG.defaultRoomCapacity;
    state.guestsCanSpeak = true;
    state.isHost = false;
    state.leaving = false;
    state.entryInProgress = false;
    state.microphoneGranted = false;
    state.enteredWithMicrophone = false;
    state.selectedAudioInputId = "";
    state.audioInputDevices = [];
    state.switchingMicrophone = false;
    state.muted = true;
    state.guestReconnecting = false;
    state.restoring = false;
    state.pendingOfflineRestore = null;
    state.resumePeerId = "";
    state.resumeToken = "";
    state.blockedResumeTokens.clear();
    state.pendingRemovalPeerId = "";
    state.pageHiding = false;
    state.voiceMonitoring = false;
    state.voicePreparing = false;
    state.screenShareStarting = false;
    state.screenCaptureGeneration += 1;
    state.voiceSettings = readStoredVoiceProfile();
    syncVoiceEqualizerUI();
    updateScreenShareControl();
  }

  function resetMicrophoneControls() {
    dom.roomMicrophoneSelect.replaceChildren(
      createAudioInputOption("", "Microfone atual"),
    );
    dom.roomMicrophoneSelect.disabled = true;
    setAudioInputStatus(
      "Use Ativar microfone nos controles da sala para permitir o acesso.",
    );
  }

  function setButtonBusy(button, busy, busyText = "Aguarde…") {
    if (!button.dataset.originalHtml)
      button.dataset.originalHtml = button.innerHTML;
    button.disabled = busy;
    button.setAttribute("aria-busy", String(busy));
    button.innerHTML = busy
      ? `<span>${busyText}</span>`
      : button.dataset.originalHtml;
  }

  function setEntryActionsBusy(actionButton, busy, busyText = "Aguarde…") {
    setButtonBusy(actionButton, busy, busyText);
    [dom.createRoomButton, dom.joinRoomButton].forEach((button) => {
      if (button !== actionButton) button.disabled = busy;
    });
  }

  function setupGuestRejectedMessage(reason) {
    const messages = {
      "room-full": "A sala atingiu o limite definido pelo anfitrião.",
      "invalid-room": "O convite não pertence a esta sala.",
      duplicate: "Você já está conectado a esta sala.",
      "join-timeout": "A entrada não foi concluída a tempo.",
      "invalid-member": "O nome ou os dados de entrada são inválidos.",
      removed: "Você foi removido pelo anfitrião.",
    };
    return messages[reason] || "A entrada na sala foi recusada.";
  }

  function sessionErrorMessage(error) {
    const code = error?.code || error?.type;
    if (code === "offline") {
      return "Conecte-se à internet para criar ou entrar em uma sala.";
    }
    if (code === "room-not-found" || code === "peer-unavailable") {
      return "Não encontramos essa sala. Confira o código e veja se quem criou ainda está conectado.";
    }
    if (code === "room-full")
      return error?.message || setupGuestRejectedMessage(code);
    if (code === "removed") return setupGuestRejectedMessage(code);
    if (code === "unavailable-id")
      return "O código da sala já está em uso. Tente criar novamente.";
    if (code === "join-timeout" || code === "connection-timeout") {
      return "A conexão demorou demais. Verifique sua internet e tente novamente.";
    }
    if (code === "library-unavailable") {
      return "O serviço de conexão não carregou. Verifique sua internet e recarregue a página.";
    }
    if (["network", "server", "socket-error"].includes(code)) {
      return "Não foi possível acessar o serviço de salas. Verifique sua internet e tente novamente.";
    }
    if (code === "browser-incompatible") {
      return "Este navegador não oferece suporte ao chat de voz.";
    }
    if (code && code !== "cancelled") return setupGuestRejectedMessage(code);
    return (
      error?.message || "Não foi possível conectar à sala. Tente novamente."
    );
  }

  function microphoneErrorMessage(error) {
    const name = error?.name || error?.message;
    if (name === "NotAllowedError" || name === "PermissionDeniedError") {
      return "O acesso ao microfone foi bloqueado. Altere a permissão no navegador e tente novamente.";
    }
    if (name === "NotFoundError" || name === "DevicesNotFoundError") {
      return "Nenhum microfone foi encontrado. Conecte um dispositivo e tente novamente.";
    }
    if (name === "NotReadableError" || name === "TrackStartError") {
      return "Seu microfone parece estar sendo usado por outro aplicativo. Feche-o e tente novamente.";
    }
    if (name === "OverconstrainedError") {
      return "O microfone não é compatível com as configurações solicitadas.";
    }
    return "Não foi possível ativar o microfone. Você continua na sala apenas para ouvir.";
  }

  function reportMicrophoneActivationError(message) {
    setAudioInputStatus(message, true);
    if (state.joined && !state.leaving) showToast(message, "error");
  }

  function peerErrorMessage(error) {
    const messages = {
      network: "A conexão com o serviço de salas foi interrompida.",
      server: "O serviço de salas está indisponível no momento.",
      "socket-error": "Houve um problema de rede na sala.",
      webrtc: "Não foi possível estabelecer uma das conexões de áudio.",
    };
    return messages[error?.type] || "Houve um problema na conexão de áudio.";
  }

  function openRoomMenuDialog() {
    if (
      dom.copyInviteButton.hidden ||
      dom.roomScreen.hidden ||
      dom.roomMenuDialog.open
    ) {
      return;
    }

    dom.copyInviteButton.setAttribute("aria-expanded", "true");
    try {
      if (typeof dom.roomMenuDialog.showModal === "function") {
        dom.roomMenuDialog.showModal();
      } else {
        dom.roomMenuDialog.setAttribute("open", "");
      }
    } catch (_) {
      dom.roomMenuDialog.setAttribute("open", "");
    }

    requestAnimationFrame(() => {
      dom.roomMenuBody.scrollTop = 0;
      dom.roomMenuClose.focus({ preventScroll: true });
    });
  }

  function closeRoomMenuDialog() {
    if (!dom.roomMenuDialog.open && !dom.roomMenuDialog.hasAttribute("open")) {
      return;
    }
    if (typeof dom.roomMenuDialog.close === "function") {
      dom.roomMenuDialog.close();
      return;
    }
    dom.roomMenuDialog.removeAttribute("open");
    finishRoomMenuDialogClose();
  }

  function finishRoomMenuDialogClose() {
    dom.copyInviteButton.setAttribute("aria-expanded", "false");
    if (!dom.copyInviteButton.hidden && !dom.roomScreen.hidden) {
      requestAnimationFrame(() =>
        dom.copyInviteButton.focus({ preventScroll: true }),
      );
    }
  }

  function showScreen(name) {
    const showingRoom = name === "room";
    dom.homeScreen.hidden = showingRoom;
    dom.roomScreen.hidden = !showingRoom;
    dom.roomControls.hidden = !showingRoom;
    dom.copyInviteButton.hidden = !showingRoom;
    document.body.classList.toggle("room-active", showingRoom);

    if (
      !showingRoom &&
      (dom.roomMenuDialog.open || dom.roomMenuDialog.hasAttribute("open"))
    ) {
      closeRoomMenuDialog();
    }
    if (
      !showingRoom &&
      (dom.screenShareDialog.open ||
        dom.screenShareDialog.hasAttribute("open"))
    ) {
      closeScreenShareDialog();
    }

    if (name === "home") {
      requestAnimationFrame(() =>
        document.querySelector("#home-title")?.focus({ preventScroll: true }),
      );
    } else if (name === "room") {
      requestAnimationFrame(() =>
        dom.roomScreenTitle.focus({ preventScroll: true }),
      );
    }
  }

  function setConnectionStatus(status, label) {
    document.querySelector("#studio-connection").dataset.status = status;
    document.querySelector("#studio-connection span").textContent = label;
    dom.connectionStatus.dataset.status = status;
    dom.connectionStatusText.textContent = label;
    dom.copyInviteButton.dataset.status = status;
    dom.copyInviteButton.setAttribute(
      "aria-label",
      `Abrir informações e configurações da sala. Estado: ${label}`,
    );
  }

  async function copyRoomCode() {
    const copied = await copyText(formatRoomCode(state.roomCode));
    showToast(
      copied ? "Código da sala copiado." : "Não foi possível copiar o código.",
      copied ? "info" : "error",
    );
  }

  async function copyInviteLink() {
    const copied = await copyText(createInviteUrl());
    showToast(
      copied
        ? "Link do convite copiado."
        : "Não foi possível copiar o convite.",
      copied ? "info" : "error",
    );
  }

  async function copyText(text) {
    if (!text) return false;
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) {
      const helper = document.createElement("textarea");
      helper.className = "clipboard-helper";
      helper.value = text;
      helper.setAttribute("readonly", "");
      document.body.appendChild(helper);
      helper.select();
      let copied = false;
      try {
        copied = document.execCommand("copy");
      } catch (_) {
        copied = false;
      }
      helper.remove();
      return copied;
    }
  }

  function showToast(message, type = "info") {
    const toast = document.createElement("div");
    toast.className = `toast${type === "error" ? " is-error" : ""}`;
    toast.textContent = message;
    dom.toastRegion.appendChild(toast);

    window.setTimeout(() => {
      toast.classList.add("is-leaving");
      window.setTimeout(() => toast.remove(), 220);
    }, 3800);
  }

  function broadcastControl(message, exceptPeerId = "") {
    state.controlConnections.forEach((connection, peerId) => {
      if (peerId !== exceptPeerId) sendControl(connection, message);
    });
  }

  function sendControl(connection, message) {
    if (!connection?.open) return false;
    try {
      connection.send(message);
      return true;
    } catch (_) {
      return false;
    }
  }

  function isSafeControlMessage(message) {
    if (!message || typeof message !== "object" || Array.isArray(message))
      return false;
    try {
      return JSON.stringify(message).length <= CONFIG.messageSizeLimit;
    } catch (_) {
      return false;
    }
  }

  function parseMemberList(members, expectedCapacity = state.roomCapacity) {
    const capacity = normalizeRoomCapacity(expectedCapacity);
    if (
      !capacity ||
      !Array.isArray(members) ||
      members.length > capacity ||
      members.length > CONFIG.maxParticipants
    ) {
      throw createAppError(
        "invalid-room",
        "A lista de participantes é inválida.",
      );
    }

    const parsed = members.map(parseMember).filter(Boolean);
    const peerIds = new Set(parsed.map((member) => member.peerId));
    if (parsed.length !== members.length || peerIds.size !== parsed.length) {
      throw createAppError(
        "invalid-room",
        "A lista de participantes é inválida.",
      );
    }
    return parsed;
  }

  function parseMember(member) {
    if (!member || typeof member !== "object") return null;
    const peerId = typeof member.peerId === "string" ? member.peerId : "";
    const name = sanitizeName(member.name);
    if (!isValidPeerId(peerId) || name.length < 2 || name.length > 24)
      return null;
    return {
      peerId,
      name,
      muted: Boolean(member.muted),
      listener: Boolean(member.listener),
      host: Boolean(member.host),
    };
  }

  function serializeMember(member) {
    return {
      peerId: member.peerId,
      name: member.name,
      muted: Boolean(member.muted),
      listener: Boolean(member.listener),
      host: Boolean(member.host),
    };
  }

  function rejectUnexpectedConnection(connection) {
    connection.on("open", () => {
      try {
        connection.close();
      } catch (_) {
        // Sem ação necessária.
      }
    });
  }

  function getOutboundStream() {
    const preferredTrack = getPreferredVoiceTrack();
    if (preferredTrack) {
      const processedStream = getProcessedVoiceStream();
      if (processedStream?.getAudioTracks()[0] === preferredTrack) {
        return processedStream;
      }
      if (state.localStream?.getAudioTracks()[0] === preferredTrack) {
        return state.localStream;
      }
      return new MediaStream([preferredTrack]);
    }
    if (state.voicePreparing && state.localStream?.getAudioTracks().length) {
      if (!state.silentStream?.getAudioTracks().length) {
        stopSilentStream();
        state.silentStream = createSilentStream();
      }
      if (state.silentStream.getAudioTracks().length) return state.silentStream;
    }
    if (!state.silentStream) state.silentStream = createSilentStream();
    return state.silentStream;
  }

  function createSilentStream() {
    if (typeof window.MediaStream !== "function") {
      return { getAudioTracks: () => [], getTracks: () => [] };
    }
    try {
      const context = state.audioContext;
      if (!context?.createMediaStreamDestination)
        return new window.MediaStream();
      const destination = context.createMediaStreamDestination();
      const gain = context.createGain();
      const oscillator = context.createOscillator();
      gain.gain.value = 0;
      oscillator.connect(gain);
      gain.connect(destination);
      oscillator.start();
      const [track] = destination.stream.getAudioTracks();
      if (track) {
        track.addEventListener(
          "ended",
          () => {
            try {
              oscillator.stop();
              oscillator.disconnect();
              gain.disconnect();
            } catch (_) {
              // O placeholder silencioso já foi finalizado.
            }
          },
          { once: true },
        );
      }
      return destination.stream;
    } catch (_) {
      return new window.MediaStream();
    }
  }

  function stopSilentStream() {
    state.silentStream?.getTracks().forEach((track) => track.stop());
    state.silentStream = null;
  }

  function generateRoomCode() {
    const bytes = new Uint8Array(CONFIG.roomCodeLength);
    crypto.getRandomValues(bytes);
    return Array.from(
      bytes,
      (byte) => CONFIG.roomAlphabet[byte % CONFIG.roomAlphabet.length],
    ).join("");
  }

  function generateResumeToken() {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
      "",
    );
  }

  function isValidResumeToken(value) {
    return typeof value === "string" && /^[a-f0-9]{32}$/.test(value);
  }

  function normalizeRoomCode(value) {
    return String(value || "")
      .toUpperCase()
      .replace(/[^A-Z2-9]/g, "")
      .replace(/[IO]/g, "")
      .slice(0, CONFIG.roomCodeLength);
  }

  function extractRoomCodeInput(value) {
    const text = String(value || "");
    const inviteMatch = text.match(/(?:#|[?&])room=([A-Z0-9-]+)/i);
    return normalizeRoomCode(inviteMatch ? inviteMatch[1] : text);
  }

  function formatRoomCode(code) {
    return normalizeRoomCode(code).replace(/(.{4})(?=.)/g, "$1-");
  }

  function isValidRoomCode(code) {
    return (
      code.length === CONFIG.roomCodeLength &&
      Array.from(code).every((character) =>
        CONFIG.roomAlphabet.includes(character),
      )
    );
  }

  function roomPeerId(code) {
    return `${CONFIG.peerPrefix}${normalizeRoomCode(code).toLowerCase()}`;
  }

  function sanitizeName(value) {
    return String(value || "")
      .replace(/[\u0000-\u001f\u007f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 24);
  }

  function sanitizeRoomName(value) {
    return String(value || "")
      .replace(/[\u0000-\u001f\u007f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, CONFIG.maxRoomNameLength);
  }

  function normalizeRoomCapacity(value) {
    const capacity = Number(value);
    return CONFIG.allowedRoomCapacities.includes(capacity) ? capacity : 0;
  }

  function parseRoomSettings(value) {
    if (!value || typeof value !== "object" || Array.isArray(value))
      return null;
    const name = sanitizeRoomName(value.name);
    const capacity = normalizeRoomCapacity(value.capacity);
    if (
      name.length < 2 ||
      !capacity ||
      typeof value.guestsCanSpeak !== "boolean"
    ) {
      return null;
    }
    return { name, capacity, guestsCanSpeak: value.guestsCanSpeak };
  }

  function serializeRoomSettings() {
    return {
      name: state.roomName,
      capacity: state.roomCapacity,
      guestsCanSpeak: Boolean(state.guestsCanSpeak),
    };
  }

  function applyRoomSettings(value) {
    const settings = parseRoomSettings(value);
    if (!settings) {
      throw createAppError(
        "invalid-room",
        "As configurações da sala são inválidas.",
      );
    }
    state.roomName = settings.name;
    state.roomCapacity = settings.capacity;
    state.guestsCanSpeak = settings.guestsCanSpeak;
    return settings;
  }

  function isLocalVoiceAllowed() {
    return state.isHost || state.mode === "create" || state.guestsCanSpeak;
  }

  function canLocalTransmitVoice() {
    return isLocalVoiceAllowed() && state.microphoneGranted;
  }

  function getLocalListenerState() {
    return !canLocalTransmitVoice();
  }

  function isValidPeerId(peerId) {
    return (
      typeof peerId === "string" &&
      /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(peerId)
    );
  }

  function getInitials(name) {
    return sanitizeName(name)
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => Array.from(part)[0] || "")
      .join("")
      .toUpperCase();
  }

  function hashString(value) {
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
      hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
    }
    return hash;
  }

  function participantCardId(peerId) {
    return `participant-${peerId}`;
  }

  function isSecureMicrophoneContext() {
    return (
      window.isSecureContext ||
      location.protocol === "https:" ||
      ["localhost", "127.0.0.1", "::1"].includes(location.hostname)
    );
  }

  function createInviteUrl() {
    const url = new URL(location.href);
    url.hash = `room=${state.roomCode}`;
    return url.toString();
  }

  function updateRoomUrl() {
    const url = new URL(location.href);
    url.hash = `room=${state.roomCode}`;
    history.replaceState(null, "", url);
  }

  function clearRoomHash() {
    const url = new URL(location.href);
    url.hash = "";
    history.replaceState(null, "", url);
  }

  function applyInviteFromHash() {
    const params = new URLSearchParams(location.hash.replace(/^#/, ""));
    const code = normalizeRoomCode(params.get("room") || "");
    if (!isValidRoomCode(code)) return;
    dom.roomCode.value = formatRoomCode(code);
    dom.inviteArrival.hidden = false;
    clearFieldError(dom.roomCode, dom.codeError);
  }

  function createAppError(code, message) {
    const error = new Error(message);
    error.code = code;
    return error;
  }

  function safeDestroyPeer(peer) {
    if (!peer || peer.destroyed) return;
    try {
      peer.destroy();
    } catch (_) {
      // Peer já encerrado.
    }
  }

  function safeCloseCall(call) {
    if (!call) return;
    try {
      call.close();
    } catch (_) {
      // Chamada já encerrada.
    }
  }

  function removeEmitterListener(emitter, event, handler) {
    if (typeof emitter?.off === "function") emitter.off(event, handler);
    else if (typeof emitter?.removeListener === "function")
      emitter.removeListener(event, handler);
  }

  init();
})();
