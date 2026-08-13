(function () {
  "use strict";

  const CONFIG = Object.freeze({
    protocolVersion: 2,
    maxParticipants: 6,
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
    messageSizeLimit: 4096,
    activeSessionKey: "cloak-active-room-v2",
    activeSessionMaxAge: 45000,
    restoreRetryWindow: 45000,
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

  const ICON_PATHS = Object.freeze({
    microphoneOff: "src/icons/microphone%20red%20off.png",
    microphoneOn: "src/icons/microphone%20green%20on.png",
  });

  const dom = {
    brandLink: document.querySelector("#brand-link"),
    roomControls: document.querySelector("#room-controls"),
    homeScreen: document.querySelector("#home-screen"),
    permissionScreen: document.querySelector("#permission-screen"),
    roomScreen: document.querySelector("#room-screen"),
    homeForm: document.querySelector("#home-form"),
    displayName: document.querySelector("#display-name"),
    nameCounter: document.querySelector("#name-counter"),
    nameError: document.querySelector("#name-error"),
    roomCode: document.querySelector("#room-code"),
    codeError: document.querySelector("#code-error"),
    createRoomButton: document.querySelector("#create-room-button"),
    joinRoomButton: document.querySelector("#join-room-button"),
    inviteArrival: document.querySelector("#invite-arrival"),
    permissionBackButton: document.querySelector("#permission-back-button"),
    permissionEyebrow: document.querySelector("#permission-eyebrow"),
    permissionTitle: document.querySelector("#permission-title"),
    pendingActionLabel: document.querySelector("#pending-action-label"),
    pendingRoomCode: document.querySelector("#pending-room-code"),
    pendingDisplayName: document.querySelector("#pending-display-name"),
    permissionInitial: document.querySelector("#permission-initial"),
    allowMicrophoneButton: document.querySelector("#allow-microphone-button"),
    listenOnlyButton: document.querySelector("#listen-only-button"),
    microphoneReady: document.querySelector("#microphone-ready"),
    microphoneLabel: document.querySelector("#microphone-label"),
    microphoneSelect: document.querySelector("#microphone-select"),
    microphoneSelectStatus: document.querySelector("#microphone-select-status"),
    volumeMeter: document.querySelector("#volume-meter"),
    volumeMeterFill: document.querySelector("#volume-meter-fill"),
    enterRoomButton: document.querySelector("#enter-room-button"),
    permissionError: document.querySelector("#permission-error"),
    roomTitle: document.querySelector("#room-title"),
    sidebarRoomCode: document.querySelector("#sidebar-room-code"),
    connectionStatus: document.querySelector("#connection-status"),
    connectionStatusText: document.querySelector("#connection-status-text"),
    participantCount: document.querySelector("#participant-count"),
    capacityCount: document.querySelector("#capacity-count"),
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
    leaveRoomButton: document.querySelector("#leave-room-button"),
    enableAudioButton: document.querySelector("#enable-audio-button"),
    remoteAudioContainer: document.querySelector("#remote-audio-container"),
    toastRegion: document.querySelector("#toast-region"),
    leaveDialog: document.querySelector("#leave-dialog"),
    leaveDialogDescription: document.querySelector("#leave-dialog-description"),
  };

  const state = {
    mode: null,
    roomCode: "",
    displayName: "",
    peer: null,
    selfPeerId: "",
    hostPeerId: "",
    isHost: false,
    joined: false,
    leaving: false,
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
    pendingMediaCalls: new Map(),
    remoteAudios: new Map(),
    participantOutputSettings: new Map(),
    audioContext: null,
    permissionSource: null,
    permissionAnalyser: null,
    permissionMeterFrame: 0,
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
    resumePeerId: "",
    resumeToken: "",
    memberResumeTokens: new Map(),
    memberReconnectTimers: new Map(),
    pageHiding: false,
    chatMessages: [],
    chatSequence: 0,
    chatMessageSequences: new Set(),
    chatRateLimits: new Map(),
    chatHistoryTimers: new Set(),
    pendingChatSend: null,
  };

  function init() {
    bindEvents();
    updateNameCounter();
    resetChat();
    resetParticipantOutputSettings();
    applyInviteFromHash();
    const activeSession = readActiveSession();
    if (activeSession) {
      void restoreActiveSession(activeSession);
    } else {
      showScreen("home");
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
      if (
        saved?.version !== 2 ||
        !Number.isFinite(age) ||
        age < 0 ||
        age > CONFIG.activeSessionMaxAge ||
        !["create", "join"].includes(mode) ||
        !isValidRoomCode(roomCode) ||
        displayName.length < 2 ||
        displayName.length > 24 ||
        (mode === "join" &&
          (!isValidPeerId(peerId) || !isValidResumeToken(resumeToken)))
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
              .slice(0, CONFIG.maxParticipants - 1)
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
        listener: Boolean(saved.listener),
        muted: Boolean(saved.muted),
        selectedAudioInputId:
          typeof saved.selectedAudioInputId === "string"
            ? saved.selectedAudioInputId.slice(0, 512)
            : "",
        chatMessages,
        chatSequence,
        reservedMembers,
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
        version: 2,
        savedAt: Date.now(),
        mode: state.isHost ? "create" : "join",
        roomCode: state.roomCode,
        displayName: state.displayName,
        peerId: state.selfPeerId,
        resumeToken: state.resumeToken,
        listener: !state.microphoneGranted,
        muted: state.muted,
        selectedAudioInputId: state.selectedAudioInputId,
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
              .filter((reservation) =>
                isValidResumeToken(reservation.resumeToken),
              )
          : [],
      };
      sessionStorage.setItem(CONFIG.activeSessionKey, JSON.stringify(snapshot));
    } catch (_) {
      // A recuperação é um aprimoramento; a sala continua funcionando sem ela.
    }
  }

  function clearActiveSession() {
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
    state.resumePeerId = saved.peerId;
    state.resumeToken = saved.resumeToken || generateResumeToken();
    state.isHost = saved.mode === "create";
    state.hostPeerId = roomPeerId(saved.roomCode);
    state.muted = saved.muted;
    dom.displayName.value = saved.displayName;
    dom.roomCode.value = formatRoomCode(saved.roomCode);
    updateNameCounter();

    state.silentStream = createSilentStream();
    state.localStream = state.silentStream;
    state.microphoneGranted = false;
    state.enteredWithMicrophone = false;
    updateRoomDetails();
    updateMuteControl();
    updateAudioInputSelectorState();
    setConnectionStatus("connecting", "Restaurando…");
    showScreen("room");
    document.title = `Sala ${formatRoomCode(state.roomCode)} — Cloak`;

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
        saveActiveSession();
        if (!saved.listener) void restoreMicrophoneAfterReconnect(saved);
        return;
      } catch (error) {
        if (!state.restoring) {
          closeNetworkConnections(true);
          return;
        }
        lastError = error;
        closeNetworkConnections(false);
        state.restoring = true;
        state.mode = saved.mode;
        state.roomCode = saved.roomCode;
        state.displayName = saved.displayName;
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
    resetPermissionUI();
    resetSessionIdentity();
    dom.displayName.value = saved.displayName;
    dom.roomCode.value = formatRoomCode(saved.roomCode);
    updateNameCounter();
    showScreen("home");
    document.title = "Cloak — Salas de voz privadas";
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

    state.localStream = stream;
    state.microphoneGranted = true;
    state.enteredWithMicrophone = true;
    state.muted = saved.muted;
    track.enabled = !state.muted;
    watchLocalMicrophoneTrack(track);
    state.selectedAudioInputId = getTrackDeviceId(track);
    dom.microphoneLabel.textContent = track.label || "Microfone atual";
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
    const self = state.participants.get(state.selfPeerId);
    if (self) {
      self.listener = !state.microphoneGranted;
      self.muted = state.muted;
      renderParticipants();
      sendLocalMemberState();
    }
    if (restored && state.microphoneGranted) {
      await publishRestoredMicrophoneTrack();
      await addAnalysisNode(state.selfPeerId, state.localStream);
      await refreshAudioInputDevices();
    }
    saveActiveSession();
  }

  async function publishRestoredMicrophoneTrack() {
    const track = state.localStream?.getAudioTracks()[0];
    if (!track || track.readyState !== "live") return;

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

    dom.roomCode.addEventListener("input", () => {
      const normalized = extractRoomCodeInput(dom.roomCode.value);
      dom.roomCode.value = formatRoomCode(normalized);
      clearFieldError(dom.roomCode, dom.codeError);
    });

    dom.createRoomButton.addEventListener("click", prepareCreateRoom);
    dom.homeForm.addEventListener("submit", prepareJoinRoom);
    dom.permissionBackButton.addEventListener(
      "click",
      returnToHomeFromPermission,
    );
    dom.allowMicrophoneButton.addEventListener("click", requestMicrophone);
    dom.microphoneSelect.addEventListener("change", handleMicrophoneSelection);
    dom.roomMicrophoneSelect.addEventListener(
      "change",
      handleMicrophoneSelection,
    );
    dom.listenOnlyButton.addEventListener("click", enterAsListener);
    dom.enterRoomButton.addEventListener("click", () => {
      void startPreparedSession(dom.enterRoomButton);
    });
    dom.sidebarCodeButton.addEventListener("click", copyRoomCode);
    dom.sidebarInviteButton.addEventListener("click", copyInviteLink);
    dom.copyInviteButton.addEventListener("click", copyInviteLink);
    dom.muteButton.addEventListener("click", toggleMute);
    dom.participantsGrid.addEventListener(
      "input",
      handleParticipantOutputInput,
    );
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
      if (state.joined && !state.guestReconnecting) {
        setConnectionStatus("connected", "Conectado");
      }
    });

    window.addEventListener("offline", () => {
      if (state.joined) {
        setConnectionStatus("offline", "Sem conexão");
        showToast(
          "Sua conexão caiu. As chamadas podem ser interrompidas.",
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
      cancelAllMediaCapture();
    });
    window.addEventListener("pageshow", (event) => {
      if (event.persisted) location.reload();
    });

    if (navigator.mediaDevices?.addEventListener) {
      navigator.mediaDevices.addEventListener(
        "devicechange",
        scheduleAudioInputRefresh,
      );
    }
  }

  function prepareCreateRoom() {
    if (!validateName()) return;

    state.mode = "create";
    state.displayName = sanitizeName(dom.displayName.value);
    state.roomCode = generateRoomCode();
    state.resumeToken = generateResumeToken();
    preparePermissionScreen();
  }

  function prepareJoinRoom(event) {
    event.preventDefault();
    const nameIsValid = validateName();
    const codeIsValid = validateCode();
    if (!nameIsValid || !codeIsValid) return;

    state.mode = "join";
    state.displayName = sanitizeName(dom.displayName.value);
    state.roomCode = extractRoomCodeInput(dom.roomCode.value);
    state.resumeToken = generateResumeToken();
    preparePermissionScreen();
  }

  function preparePermissionScreen() {
    resetPermissionUI();
    dom.pendingRoomCode.textContent = formatRoomCode(state.roomCode);
    dom.pendingDisplayName.textContent = state.displayName;

    if (state.mode === "create") {
      dom.permissionEyebrow.textContent = "Sua sala está quase pronta";
      dom.pendingActionLabel.textContent = "Nova sala";
    } else {
      dom.permissionEyebrow.textContent = "Convite confirmado";
      dom.pendingActionLabel.textContent = "Entrar na sala";
    }

    showScreen("permission");
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

  async function requestMicrophone() {
    dom.permissionError.textContent = "";
    const mediaGeneration = ++state.mediaGeneration;

    if (!isSecureMicrophoneContext()) {
      dom.permissionError.textContent =
        "O microfone exige uma conexão segura. Abra o Cloak por HTTPS ou em localhost.";
      return;
    }

    if (
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== "function"
    ) {
      dom.permissionError.textContent =
        "Este navegador não oferece acesso ao microfone. Tente uma versão recente do Chrome, Edge, Firefox ou Safari.";
      return;
    }

    setButtonBusy(dom.allowMicrophoneButton, true, "Solicitando acesso…");
    dom.listenOnlyButton.disabled = true;

    try {
      stopLocalTracks();
      const capturedStream = await captureMicrophone();
      if (mediaGeneration !== state.mediaGeneration) {
        capturedStream.getTracks().forEach((track) => track.stop());
        return;
      }
      state.localStream = capturedStream;

      const [track] = state.localStream.getAudioTracks();
      if (!track || track.readyState !== "live") {
        throw new Error("microphone-missing-track");
      }

      state.microphoneGranted = true;
      state.enteredWithMicrophone = true;
      state.muted = false;
      track.enabled = true;
      watchLocalMicrophoneTrack(track);
      state.selectedAudioInputId = getTrackDeviceId(track);

      dom.microphoneLabel.textContent = track.label || "Dispositivo padrão";
      dom.permissionInitial.hidden = true;
      dom.microphoneReady.hidden = false;
      await refreshAudioInputDevices();
      if (mediaGeneration !== state.mediaGeneration) return;
      if (track.readyState !== "live") {
        if (state.microphoneGranted) handleLocalMicrophoneEnded();
        return;
      }
      await startPermissionMeter(state.localStream);
      if (mediaGeneration !== state.mediaGeneration) return;
      if (track.readyState !== "live") {
        if (state.microphoneGranted) handleLocalMicrophoneEnded();
        return;
      }
      dom.enterRoomButton.focus();
    } catch (error) {
      if (mediaGeneration !== state.mediaGeneration) return;
      stopLocalTracks();
      state.microphoneGranted = false;
      state.enteredWithMicrophone = false;
      state.muted = true;
      dom.permissionError.textContent = microphoneErrorMessage(error);
      setButtonBusy(dom.allowMicrophoneButton, false);
      dom.listenOnlyButton.disabled = false;
    }
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

  async function switchMicrophone(deviceId) {
    if (
      state.switchingMicrophone ||
      !state.enteredWithMicrophone ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      synchronizeAudioInputSelectors();
      return;
    }

    const previousStream = state.localStream;
    const previousTrack = previousStream?.getAudioTracks()[0];
    const previousDeviceId = state.selectedAudioInputId;
    const previousMicrophoneGranted = state.microphoneGranted;
    const previousMicrophoneLabel = dom.microphoneLabel.textContent;
    const previousMuted = state.muted;
    const previousMember = state.participants.get(state.selfPeerId);
    const previousMemberState = previousMember
      ? { muted: previousMember.muted, listener: previousMember.listener }
      : null;
    const mediaGeneration = ++state.mediaGeneration;
    let nextStream = null;
    let localAnalysisChanged = false;
    const replacedSenders = [];

    state.switchingMicrophone = true;
    updateAudioInputSelectorState();
    if (!dom.permissionScreen.hidden) dom.enterRoomButton.disabled = true;
    setAudioInputStatus("Trocando o microfone…");

    try {
      nextStream = await captureMicrophone(deviceId);
      if (mediaGeneration !== state.mediaGeneration) {
        nextStream.getTracks().forEach((track) => track.stop());
        return;
      }
      const nextTrack = nextStream.getAudioTracks()[0];
      if (!nextTrack || nextTrack.readyState !== "live") {
        throw createAppError("microphone-missing-track", "");
      }

      nextTrack.enabled = !state.muted;
      watchLocalMicrophoneTrack(nextTrack);
      state.pendingLocalStream = nextStream;

      if (state.joined) {
        for (const call of Array.from(state.mediaCalls.values())) {
          if (
            !state.mediaCalls.has(call.peer) ||
            call.peerConnection?.signalingState === "closed"
          ) {
            continue;
          }
          const sender = getAudioSender(call);
          if (!sender || typeof sender.replaceTrack !== "function") {
            throw createAppError("microphone-switch-unsupported", "");
          }
          await sender.replaceTrack(nextTrack);
          replacedSenders.push(sender);
        }

        for (const call of Array.from(state.mediaCalls.values())) {
          if (
            !state.mediaCalls.has(call.peer) ||
            call.peerConnection?.signalingState === "closed"
          ) {
            continue;
          }
          const sender = getAudioSender(call);
          if (!sender || typeof sender.replaceTrack !== "function") {
            throw createAppError("microphone-switch-unsupported", "");
          }
          if (sender.track !== nextTrack) {
            await sender.replaceTrack(nextTrack);
            replacedSenders.push(sender);
          }
        }
      }

      if (mediaGeneration !== state.mediaGeneration) {
        nextStream.getTracks().forEach((track) => track.stop());
        return;
      }
      if (nextTrack.readyState !== "live") {
        throw createAppError("microphone-ended", "");
      }

      stopPermissionMeter();
      removeAnalysisNode(state.selfPeerId);
      localAnalysisChanged = true;
      state.localStream = nextStream;
      state.pendingLocalStream = null;
      state.selectedAudioInputId = getTrackDeviceId(nextTrack) || deviceId;
      state.microphoneGranted = true;
      state.enteredWithMicrophone = true;
      state.muted = previousMuted;
      nextTrack.enabled = !state.muted;
      dom.microphoneLabel.textContent =
        nextTrack.label || "Dispositivo selecionado";

      if (state.joined) await addAnalysisNode(state.selfPeerId, nextStream);
      else await startPermissionMeter(nextStream);
      if (mediaGeneration !== state.mediaGeneration) return;
      if (nextTrack.readyState !== "live") {
        throw createAppError("microphone-ended", "");
      }

      const self = state.participants.get(state.selfPeerId);
      if (self) {
        self.listener = false;
        self.muted = state.muted;
        updateMuteControl();
        renderParticipants();
        sendLocalMemberState();
      }

      await refreshAudioInputDevices();
      if (mediaGeneration !== state.mediaGeneration) return;
      if (nextTrack.readyState !== "live") {
        throw createAppError("microphone-ended", "");
      }
      previousStream?.getTracks().forEach((track) => track.stop());
      setAudioInputStatus(
        "Microfone alterado. A nova entrada já está sendo usada.",
      );
      saveActiveSession();
      if (state.joined) showToast("Microfone alterado com sucesso.");
    } catch (error) {
      if (mediaGeneration !== state.mediaGeneration) {
        nextStream?.getTracks().forEach((track) => track.stop());
        return;
      }
      const nextTrack = nextStream?.getAudioTracks()[0] || null;
      const rollbackTrack =
        previousTrack?.readyState === "live" ? previousTrack : null;

      state.pendingLocalStream = null;
      state.localStream = rollbackTrack
        ? previousStream
        : (state.silentStream ||= createSilentStream());
      state.selectedAudioInputId = rollbackTrack ? previousDeviceId : "";
      state.microphoneGranted = Boolean(
        rollbackTrack && previousMicrophoneGranted,
      );
      state.muted = rollbackTrack ? previousMuted : true;
      dom.microphoneLabel.textContent = rollbackTrack
        ? previousMicrophoneLabel
        : "Microfone desconectado";

      const rollbackSenders = async () => {
        const senders = new Set(replacedSenders);
        state.mediaCalls.forEach((call) => {
          const sender = getAudioSender(call);
          if (sender?.track === nextTrack) senders.add(sender);
        });
        await Promise.allSettled(
          Array.from(senders).map((sender) =>
            sender.replaceTrack(rollbackTrack),
          ),
        );
      };

      await rollbackSenders();
      await rollbackSenders();
      nextStream?.getTracks().forEach((track) => track.stop());
      if (
        localAnalysisChanged &&
        state.microphoneGranted &&
        previousStream?.getAudioTracks().length
      ) {
        if (state.joined)
          await addAnalysisNode(state.selfPeerId, previousStream);
        else await startPermissionMeter(previousStream);
      }
      const self = state.participants.get(state.selfPeerId);
      if (self) {
        self.listener = rollbackTrack
          ? previousMemberState?.listener || false
          : true;
        self.muted = rollbackTrack ? previousMemberState?.muted || false : true;
        updateMuteControl();
        renderParticipants();
        sendLocalMemberState();
      }
      synchronizeAudioInputSelectors();
      setAudioInputStatus(microphoneSwitchErrorMessage(error), true);
      if (state.joined) showToast(microphoneSwitchErrorMessage(error), "error");
    } finally {
      if (mediaGeneration === state.mediaGeneration) {
        state.switchingMicrophone = false;
        updateAudioInputSelectorState();
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
      populateAudioInputSelect(dom.microphoneSelect, currentTrack);
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
    [dom.microphoneSelect, dom.roomMicrophoneSelect].forEach((select) => {
      if (
        state.selectedAudioInputId &&
        Array.from(select.options).some(
          (option) => option.value === state.selectedAudioInputId,
        )
      ) {
        select.value = state.selectedAudioInputId;
      }
    });
  }

  function updateAudioInputSelectorState() {
    const disabled =
      !state.enteredWithMicrophone ||
      state.switchingMicrophone ||
      !state.audioInputDevices.length;
    dom.microphoneSelect.disabled = disabled;
    dom.roomMicrophoneSelect.disabled = disabled;

    if (!state.enteredWithMicrophone) {
      setAudioInputStatus(
        "Você entrou apenas para ouvir. Nenhum microfone está ativo.",
      );
    }

    if (
      !dom.permissionScreen.hidden &&
      dom.enterRoomButton.getAttribute("aria-busy") !== "true"
    ) {
      dom.enterRoomButton.disabled =
        state.switchingMicrophone || !state.microphoneGranted;
    }
  }

  function setAudioInputStatus(message, isError = false) {
    [dom.microphoneSelectStatus, dom.roomMicrophoneStatus].forEach((target) => {
      target.textContent = message;
      target.classList.toggle("is-error", isError);
    });
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

  async function enterAsListener() {
    stopPermissionMeter();
    stopLocalTracks();
    state.silentStream = createSilentStream();
    state.localStream = state.silentStream;
    state.microphoneGranted = false;
    state.enteredWithMicrophone = false;
    state.selectedAudioInputId = "";
    state.audioInputDevices = [];
    state.muted = true;
    await startPreparedSession(dom.listenOnlyButton);
  }

  async function startPreparedSession(triggerButton = dom.enterRoomButton) {
    const actionButton = triggerButton?.dataset
      ? triggerButton
      : dom.enterRoomButton;

    try {
      resetChat();
      dom.permissionError.textContent = "";
      setPermissionActionsDisabled(true);
      setButtonBusy(
        actionButton,
        true,
        state.mode === "create" ? "Criando sala…" : "Procurando sala…",
      );
      stopPermissionMeter();

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
    } catch (error) {
      closeNetworkConnections(false);
      dom.permissionError.textContent = sessionErrorMessage(error);
      setPermissionActionsDisabled(false);
      setButtonBusy(actionButton, false);

      if (
        state.microphoneGranted &&
        state.localStream?.getAudioTracks().length
      ) {
        dom.permissionInitial.hidden = true;
        dom.microphoneReady.hidden = false;
        startPermissionMeter(state.localStream);
      } else {
        dom.permissionInitial.hidden = false;
        dom.microphoneReady.hidden = true;
      }
    }
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
          listener: !state.microphoneGranted,
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
          dom.pendingRoomCode.textContent = formatRoomCode(state.roomCode);
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
    const members = parseMemberList(response.members);

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
      muted: state.muted,
      listener: !state.microphoneGranted,
      host: false,
    });

    await confirmRoomReady(connection);
    state.joined = true;
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
        listener: !state.microphoneGranted,
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
          CONFIG.maxParticipants
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
      const member = {
        peerId: connection.peer,
        name,
        muted: Boolean(message.muted),
        listener: Boolean(message.listener),
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
        maxParticipants: CONFIG.maxParticipants,
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
      member.muted = Boolean(message.muted);
      member.listener = Boolean(message.listener);
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
        const members = parseMemberList(response.members);
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
        self.muted = state.muted;
        self.listener = !state.microphoneGranted;
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
        renderParticipants();
        updateChatComposer();
        saveActiveSession();
        showToast("Você voltou à sala.");
      } catch (_) {
        if (state.hostConnection === connection) state.hostConnection = null;
        try {
          connection?.close();
        } catch (_) {
          // A tentativa já pode estar fechada.
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
      state.pendingReady.resolve();
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

      const self = state.participants.get(state.selfPeerId);
      if (self && !self.listener) {
        placeMediaCall(member.peerId);
      }
      showToast(`${member.name} entrou na sala.`);
      return;
    }

    if (message.type === "initiate-calls" && Array.isArray(message.peerIds)) {
      message.peerIds.slice(0, CONFIG.maxParticipants).forEach((peerId) => {
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

    if (message.type === "member-state" && isValidPeerId(message.peerId)) {
      const member = state.participants.get(message.peerId);
      if (!member) return;
      member.muted = Boolean(message.muted);
      member.listener = Boolean(message.listener);
      renderParticipants();
      return;
    }

    if (message.type === "room-closed") {
      remoteRoomClosed("A sala foi encerrada por quem a criou.");
    }
  }

  function removeHostMember(peerId, announce) {
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
        !isValidResumeToken(resumeToken)
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
    if (
      !state.joined ||
      state.leaving ||
      metadata.version !== CONFIG.protocolVersion ||
      normalizeRoomCode(metadata.roomCode) !== state.roomCode ||
      !isValidPeerId(call.peer)
    ) {
      safeCloseCall(call);
      return;
    }

    if (!state.participants.has(call.peer)) {
      queuePendingCall(call);
      return;
    }

    answerMediaCall(call);
  }

  function queuePendingCall(call) {
    const pendingCount = Array.from(state.pendingMediaCalls.values()).reduce(
      (total, calls) => total + calls.length,
      0,
    );
    if (pendingCount >= CONFIG.maxParticipants * 2) {
      safeCloseCall(call);
      return;
    }

    const timer = window.setTimeout(() => {
      const calls = state.pendingMediaCalls.get(call.peer) || [];
      state.pendingMediaCalls.set(
        call.peer,
        calls.filter((entry) => entry.call !== call),
      );
      if (!state.pendingMediaCalls.get(call.peer)?.length) {
        state.pendingMediaCalls.delete(call.peer);
      }
      safeCloseCall(call);
    }, CONFIG.pendingCallTimeout);

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

  function answerMediaCall(call) {
    if (!state.participants.has(call.peer) || state.leaving) {
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
      state.mediaCalls.has(peerId)
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
        },
      });
      if (call) registerMediaCall(call);
    } catch (_) {
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
    removeRemoteAudio(peerId);

    const audio = document.createElement("audio");
    audio.autoplay = true;
    audio.playsInline = true;
    audio.dataset.peerId = peerId;
    audio.srcObject = stream;
    applyParticipantOutputSettings(peerId, audio);
    dom.remoteAudioContainer.appendChild(audio);
    state.remoteAudios.set(peerId, audio);
    addRemoteAnalysisNode(call, audio, stream);

    try {
      await audio.play();
    } catch (_) {
      if (
        state.mediaCalls.get(peerId) === call &&
        state.remoteAudios.get(peerId) === audio
      ) {
        dom.enableAudioButton.hidden = false;
      }
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
    const results = await Promise.allSettled(
      Array.from(state.remoteAudios.values()).map((audio) => audio.play()),
    );
    await resumeAudioContext();
    dom.enableAudioButton.hidden = results.some(
      (result) => result.status === "rejected",
    )
      ? false
      : true;
    if (dom.enableAudioButton.hidden) showToast("Áudio recebido ativado.");
  }

  function closeMediaForPeer(peerId) {
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
  }

  function removeRemoteAudio(peerId) {
    const audio = state.remoteAudios.get(peerId);
    if (audio) {
      audio.pause();
      audio.srcObject = null;
      audio.remove();
      state.remoteAudios.delete(peerId);
    }
    removeAnalysisNode(peerId);
  }

  async function activateRoom() {
    const restored = state.restoring;
    stopPermissionMeter();
    updateRoomUrl();
    updateRoomDetails();
    renderParticipants();
    updateMuteControl();
    updateAudioInputSelectorState();
    updateChatComposer();
    setConnectionStatus("connected", "Conectado");
    showScreen("room");
    requestAnimationFrame(() => {
      dom.chatMessages.scrollTop = dom.chatMessages.scrollHeight;
    });
    await resumeAudioContext();

    if (state.microphoneGranted && state.localStream?.getAudioTracks().length) {
      addAnalysisNode(state.selfPeerId, state.localStream);
      refreshAudioInputDevices();
    }

    document.title = `Sala ${formatRoomCode(state.roomCode)} — Cloak`;
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
    const host = state.participants.get(state.hostPeerId);
    dom.sidebarRoomCode.textContent = formatted;
    dom.roomTitle.textContent = state.isHost
      ? "Sua sala"
      : `Sala de ${host?.name || "voz"}`;
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
    audio.muted = settings.muted;
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
    const button = event.target.closest(".participant-mute-button");
    if (!button || !dom.participantsGrid.contains(button)) return;
    const peerId = button.dataset.peerId || "";
    const member = state.participants.get(peerId);
    if (!member || peerId === state.selfPeerId) return;

    const settings = getParticipantOutputSettings(peerId);
    settings.muted = !settings.muted;
    applyParticipantOutputSettings(peerId);
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

  function playParticipantOutput(peerId) {
    const audio = state.remoteAudios.get(peerId);
    if (!audio || audio.muted) return;
    try {
      const playback = audio.play();
      playback?.catch(() => {
        dom.enableAudioButton.hidden = false;
      });
    } catch (_) {
      dom.enableAudioButton.hidden = false;
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
    if (locallyMuted) return "Silenciado por você";
    if (member.listener) return "Somente ouvindo";
    if (member.muted) return "Microfone silenciado";
    if (speaking) return "Falando agora";
    return "Na sala";
  }

  function toggleMute() {
    const track = state.localStream?.getAudioTracks()[0];
    if (!track || !state.microphoneGranted) {
      showToast(
        state.enteredWithMicrophone
          ? "O microfone atual está indisponível. Escolha outra entrada de áudio."
          : "Você entrou apenas para ouvir. Saia e entre novamente para usar o microfone.",
        "error",
      );
      return;
    }

    state.muted = !state.muted;
    track.enabled = !state.muted;
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
    const listener = !state.microphoneGranted;
    const microphoneEnabled = !listener && !state.muted;
    dom.muteButton.classList.toggle("is-muted", state.muted && !listener);
    dom.muteButton.classList.toggle("is-listener", listener);
    dom.muteButton.dataset.microphoneState = microphoneEnabled ? "on" : "off";
    dom.muteButtonIcon.src = microphoneEnabled
      ? ICON_PATHS.microphoneOn
      : ICON_PATHS.microphoneOff;
    dom.muteButtonLabel.textContent = listener
      ? "Só ouvindo"
      : state.muted
        ? "Ativar"
        : "Silenciar";
    dom.muteButton.setAttribute(
      "aria-label",
      listener
        ? "Você entrou sem microfone"
        : state.muted
          ? "Ativar microfone"
          : "Silenciar microfone",
    );
  }

  function sendLocalMemberState() {
    const self = state.participants.get(state.selfPeerId);
    if (!self) return;

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
    state.microphoneGranted = false;
    state.muted = true;
    removeAnalysisNode(state.selfPeerId);
    const self = state.participants.get(state.selfPeerId);
    if (self) {
      self.muted = true;
      self.listener = true;
      sendLocalMemberState();
      renderParticipants();
      updateMuteControl();
      showToast("O microfone foi desconectado.", "error");
    } else if (!dom.permissionScreen.hidden) {
      dom.permissionError.textContent =
        "O microfone foi desconectado. Escolha outra entrada para continuar.";
    }
    setAudioInputStatus(
      "O microfone atual foi desconectado. Escolha outra entrada.",
      true,
    );
    updateAudioInputSelectorState();
    refreshAudioInputDevices();
    saveActiveSession();
  }

  async function startPermissionMeter(stream) {
    stopPermissionMeter();
    const context = await ensureAudioContext();
    if (!context) return;

    try {
      state.permissionSource = context.createMediaStreamSource(stream);
      state.permissionAnalyser = context.createAnalyser();
      state.permissionAnalyser.fftSize = 256;
      state.permissionAnalyser.smoothingTimeConstant = 0.74;
      state.permissionSource.connect(state.permissionAnalyser);
      const data = new Uint8Array(state.permissionAnalyser.fftSize);

      const draw = () => {
        if (!state.permissionAnalyser) return;
        const level = getAudioLevel(state.permissionAnalyser, data);
        const visualLevel = Math.min(1, 0.08 + level * 4.8);
        dom.volumeMeterFill.style.transform = `scaleX(${visualLevel})`;
        dom.volumeMeter.setAttribute(
          "aria-valuenow",
          String(Math.round(visualLevel * 100)),
        );
        state.permissionMeterFrame = window.requestAnimationFrame(draw);
      };
      draw();
    } catch (_) {
      dom.volumeMeterFill.style.transform = "scaleX(0.18)";
    }
  }

  function stopPermissionMeter() {
    cancelAnimationFrame(state.permissionMeterFrame);
    state.permissionMeterFrame = 0;
    try {
      state.permissionSource?.disconnect();
      state.permissionAnalyser?.disconnect();
    } catch (_) {
      // Nós de áudio já desconectados.
    }
    state.permissionSource = null;
    state.permissionAnalyser = null;
    dom.volumeMeterFill.style.transform = "scaleX(0.08)";
    dom.volumeMeter.setAttribute("aria-valuenow", "0");
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
    document.title = "Cloak — Salas de voz privadas";
    showToast("Você saiu da sala.");

    const finishDeparture = () => {
      closeNetworkConnections(true);
      resetPermissionUI();
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
    resetPermissionUI();
    resetSessionIdentity();
    dom.roomCode.value = formatRoomCode(previousCode);
    showScreen("home");
    document.title = "Cloak — Salas de voz privadas";
    showToast(message, "error");
  }

  function returnToHomeFromPermission() {
    clearActiveSession();
    closeNetworkConnections(true);
    resetPermissionUI();
    resetSessionIdentity();
    showScreen("home");
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

    state.mediaCalls.forEach(safeCloseCall);
    state.mediaCalls.clear();
    state.remoteAudios.forEach((audio) => {
      audio.pause();
      audio.srcObject = null;
      audio.remove();
    });
    state.remoteAudios.clear();
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
    dom.enableAudioButton.hidden = true;
    stopPermissionMeter();
    stopAllAnalysis(stopMedia);

    if (stopMedia) {
      cancelAllMediaCapture();
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
    clearTimeout(state.deviceRefreshTimer);
    stopLocalTracks();
  }

  function resetSessionIdentity() {
    state.mode = null;
    state.roomCode = "";
    state.displayName = "";
    state.isHost = false;
    state.leaving = false;
    state.microphoneGranted = false;
    state.enteredWithMicrophone = false;
    state.selectedAudioInputId = "";
    state.audioInputDevices = [];
    state.switchingMicrophone = false;
    state.muted = true;
    state.guestReconnecting = false;
    state.restoring = false;
    state.resumePeerId = "";
    state.resumeToken = "";
    state.pageHiding = false;
  }

  function resetPermissionUI() {
    stopPermissionMeter();
    dom.permissionInitial.hidden = false;
    dom.microphoneReady.hidden = true;
    dom.permissionError.textContent = "";
    dom.microphoneLabel.textContent = "Pronto para usar";
    dom.microphoneSelect.replaceChildren(
      createAudioInputOption("", "Microfone atual"),
    );
    dom.roomMicrophoneSelect.replaceChildren(
      createAudioInputOption("", "Microfone atual"),
    );
    dom.microphoneSelect.disabled = true;
    dom.roomMicrophoneSelect.disabled = true;
    setAudioInputStatus(
      "Escolha qual entrada de áudio será enviada para a sala.",
    );
    setPermissionActionsDisabled(false);
    setButtonBusy(dom.allowMicrophoneButton, false);
    setButtonBusy(dom.listenOnlyButton, false);
    setButtonBusy(dom.enterRoomButton, false);
  }

  function setPermissionActionsDisabled(disabled) {
    dom.allowMicrophoneButton.disabled = disabled;
    dom.listenOnlyButton.disabled = disabled;
    dom.enterRoomButton.disabled = disabled;
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

  function setupGuestRejectedMessage(reason) {
    const messages = {
      "room-full": "A sala está cheia. O limite é de 6 pessoas.",
      "invalid-room": "O convite não pertence a esta sala.",
      duplicate: "Você já está conectado a esta sala.",
      "join-timeout": "A entrada não foi concluída a tempo.",
      "invalid-member": "O nome ou os dados de entrada são inválidos.",
    };
    return messages[reason] || "A entrada na sala foi recusada.";
  }

  function sessionErrorMessage(error) {
    const code = error?.code || error?.type;
    if (code === "room-not-found" || code === "peer-unavailable") {
      return "Não encontramos essa sala. Confira o código e veja se quem criou ainda está conectado.";
    }
    if (code === "room-full") return setupGuestRejectedMessage(code);
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
      return "O acesso ao microfone foi bloqueado. Altere a permissão no navegador ou entre apenas para ouvir.";
    }
    if (name === "NotFoundError" || name === "DevicesNotFoundError") {
      return "Nenhum microfone foi encontrado. Conecte um dispositivo ou entre apenas para ouvir.";
    }
    if (name === "NotReadableError" || name === "TrackStartError") {
      return "Seu microfone parece estar sendo usado por outro aplicativo. Feche-o e tente novamente.";
    }
    if (name === "OverconstrainedError") {
      return "O microfone não é compatível com as configurações solicitadas.";
    }
    return "Não foi possível ativar o microfone. Você ainda pode entrar apenas para ouvir.";
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

  function showScreen(name) {
    dom.homeScreen.hidden = name !== "home";
    dom.permissionScreen.hidden = name !== "permission";
    dom.roomScreen.hidden = name !== "room";
    dom.roomControls.hidden = name !== "room";

    if (name === "home") {
      requestAnimationFrame(() =>
        document.querySelector("#home-title")?.focus({ preventScroll: true }),
      );
    } else if (name === "permission") {
      requestAnimationFrame(() =>
        dom.permissionTitle.focus({ preventScroll: true }),
      );
    } else if (name === "room") {
      requestAnimationFrame(() => dom.roomTitle.focus({ preventScroll: true }));
    }
  }

  function setConnectionStatus(status, label) {
    dom.connectionStatus.dataset.status = status;
    dom.connectionStatusText.textContent = label;
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

  function parseMemberList(members) {
    if (!Array.isArray(members) || members.length > CONFIG.maxParticipants) {
      throw createAppError(
        "invalid-room",
        "A lista de participantes é inválida.",
      );
    }

    const parsed = members.map(parseMember).filter(Boolean);
    if (parsed.length !== members.length) {
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
    if (state.pendingLocalStream) return state.pendingLocalStream;
    if (state.localStream) return state.localStream;
    if (!state.silentStream) state.silentStream = createSilentStream();
    return state.silentStream;
  }

  function createSilentStream() {
    return typeof window.MediaStream === "function"
      ? new window.MediaStream()
      : { getAudioTracks: () => [], getTracks: () => [] };
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
