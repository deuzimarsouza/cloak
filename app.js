(function () {
  "use strict";

  const CONFIG = Object.freeze({
    protocolVersion: 1,
    maxParticipants: 6,
    roomCodeLength: 12,
    roomAlphabet: "ABCDEFGHJKLMNPQRSTUVWXYZ23456789",
    peerPrefix: "cloak-room-",
    connectionTimeout: 12000,
    joinTimeout: 10000,
    pendingCallTimeout: 1800,
    messageSizeLimit: 4096,
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

  const dom = {
    brandLink: document.querySelector("#brand-link"),
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
    volumeMeter: document.querySelector("#volume-meter"),
    volumeMeterFill: document.querySelector("#volume-meter-fill"),
    enterRoomButton: document.querySelector("#enter-room-button"),
    permissionError: document.querySelector("#permission-error"),
    roomTitle: document.querySelector("#room-title"),
    roomCodeDisplay: document.querySelector("#room-code-display"),
    sidebarRoomCode: document.querySelector("#sidebar-room-code"),
    connectionStatus: document.querySelector("#connection-status"),
    connectionStatusText: document.querySelector("#connection-status-text"),
    participantCount: document.querySelector("#participant-count"),
    capacityCount: document.querySelector("#capacity-count"),
    participantsGrid: document.querySelector("#participants-grid"),
    waitingCard: document.querySelector("#waiting-card"),
    copyCodeButton: document.querySelector("#copy-code-button"),
    sidebarCodeButton: document.querySelector("#sidebar-code-button"),
    sidebarInviteButton: document.querySelector("#sidebar-invite-button"),
    copyInviteButton: document.querySelector("#copy-invite-button"),
    muteButton: document.querySelector("#mute-button"),
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
    silentStream: null,
    microphoneGranted: false,
    muted: true,
    hostConnection: null,
    controlConnections: new Map(),
    pendingMembers: new Map(),
    participants: new Map(),
    mediaCalls: new Map(),
    pendingMediaCalls: new Map(),
    remoteAudios: new Map(),
    audioContext: null,
    permissionSource: null,
    permissionAnalyser: null,
    permissionMeterFrame: 0,
    analysisNodes: new Map(),
    analysisFrame: 0,
    speakingPeers: new Set(),
    pendingJoin: null,
    reconnectTimer: 0,
  };

  function init() {
    bindEvents();
    updateNameCounter();
    applyInviteFromHash();
    showScreen("home");
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
    dom.listenOnlyButton.addEventListener("click", enterAsListener);
    dom.enterRoomButton.addEventListener("click", startPreparedSession);
    dom.copyCodeButton.addEventListener("click", copyRoomCode);
    dom.sidebarCodeButton.addEventListener("click", copyRoomCode);
    dom.sidebarInviteButton.addEventListener("click", copyInviteLink);
    dom.copyInviteButton.addEventListener("click", copyInviteLink);
    dom.muteButton.addEventListener("click", toggleMute);
    dom.leaveRoomButton.addEventListener("click", openLeaveDialog);
    dom.enableAudioButton.addEventListener("click", unlockRemoteAudio);

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
      if (state.joined) {
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

    window.addEventListener("beforeunload", notifyDeparture);
    window.addEventListener("pagehide", stopLocalTracks);
  }

  function prepareCreateRoom() {
    if (!validateName()) return;

    state.mode = "create";
    state.displayName = sanitizeName(dom.displayName.value);
    state.roomCode = generateRoomCode();
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
      state.localStream = await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const [track] = state.localStream.getAudioTracks();
      if (!track) throw new Error("microphone-missing-track");

      state.microphoneGranted = true;
      state.muted = false;
      track.enabled = true;
      track.addEventListener("ended", handleLocalMicrophoneEnded);

      dom.microphoneLabel.textContent = track.label || "Dispositivo padrão";
      dom.permissionInitial.hidden = true;
      dom.microphoneReady.hidden = false;
      await startPermissionMeter(state.localStream);
      dom.enterRoomButton.focus();
    } catch (error) {
      stopLocalTracks();
      state.microphoneGranted = false;
      state.muted = true;
      dom.permissionError.textContent = microphoneErrorMessage(error);
      setButtonBusy(dom.allowMicrophoneButton, false);
      dom.listenOnlyButton.disabled = false;
    }
  }

  async function enterAsListener() {
    stopPermissionMeter();
    stopLocalTracks();
    state.silentStream = createSilentStream();
    state.localStream = state.silentStream;
    state.microphoneGranted = false;
    state.muted = true;
    await startPreparedSession(dom.listenOnlyButton);
  }

  async function startPreparedSession(triggerButton = dom.enterRoomButton) {
    dom.permissionError.textContent = "";
    setPermissionActionsDisabled(true);
    setButtonBusy(
      triggerButton,
      true,
      state.mode === "create" ? "Criando sala…" : "Procurando sala…",
    );
    stopPermissionMeter();

    try {
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
      setButtonBusy(triggerButton, false);

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
    state.hostPeerId = roomPeerId(state.roomCode);

    const peer = await openPeer();
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
    members.forEach((member) => state.participants.set(member.peerId, member));
    state.participants.set(state.selfPeerId, {
      peerId: state.selfPeerId,
      name: state.displayName,
      muted: state.muted,
      listener: !state.microphoneGranted,
      host: false,
    });

    state.joined = true;
    sendControl(connection, {
      type: "ready",
      version: CONFIG.protocolVersion,
      roomCode: state.roomCode,
    });
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
      });
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
      if (state.joined && !state.leaving) {
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
      if (pending) {
        clearTimeout(pending.readyTimer);
        state.pendingMembers.delete(connection.peer);
      }

      if (state.controlConnections.has(connection.peer) && !state.leaving) {
        removeHostMember(connection.peer, true);
      }
    });

    connection.on("error", () => {
      if (state.controlConnections.has(connection.peer) && !state.leaving) {
        removeHostMember(connection.peer, true);
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
      if (
        state.participants.has(connection.peer) ||
        state.pendingMembers.has(connection.peer)
      ) {
        reject("duplicate", "Esta pessoa já está na sala.");
        return;
      }

      if (
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
        !isValidPeerId(connection.peer)
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
    if (message.type === "ready" && pending) {
      clearTimeout(pending.readyTimer);
      state.pendingMembers.delete(connection.peer);

      const existingMembers = Array.from(state.participants.values());
      state.participants.set(connection.peer, pending.member);
      state.controlConnections.set(connection.peer, connection);

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
      showToast(`${pending.member.name} entrou na sala.`);
      return;
    }

    if (!state.controlConnections.has(connection.peer)) return;

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
      handleGuestControlMessage(message);
    });

    connection.on("close", () => {
      if (state.pendingJoin) {
        state.pendingJoin.reject(
          createAppError("room-closed", "A sala foi encerrada."),
        );
      } else if (state.joined && !state.leaving) {
        remoteRoomClosed("A sala foi encerrada por quem a criou.");
      }
    });

    connection.on("error", () => {
      if (state.pendingJoin) {
        state.pendingJoin.reject(
          createAppError("room-not-found", "Não foi possível entrar."),
        );
      } else if (state.joined && !state.leaving) {
        setConnectionStatus("offline", "Conexão perdida");
        showToast("A conexão com a sala foi perdida.", "error");
      }
    });
  }

  function handleGuestControlMessage(message) {
    if (message.type === "accepted" && state.pendingJoin) {
      state.pendingJoin.resolve(message);
      return;
    }

    if (message.type === "rejected" && state.pendingJoin) {
      state.pendingJoin.reject(
        createAppError(
          message.reason || "join-rejected",
          message.message || "Entrada recusada.",
        ),
      );
      return;
    }

    if (!state.joined) return;

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

    const connection = state.controlConnections.get(peerId);
    state.participants.delete(peerId);
    state.controlConnections.delete(peerId);
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
  }

  function removeGuestMember(peerId, announce) {
    const member = state.participants.get(peerId);
    if (!member || peerId === state.selfPeerId) return;

    state.participants.delete(peerId);
    closeMediaForPeer(peerId);
    renderParticipants();
    if (announce) showToast(`${member.name} saiu da sala.`);
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

    call.on("stream", (stream) => attachRemoteStream(call.peer, stream));
    call.on("close", () => cleanupClosedCall(call.peer, call));
    call.on("error", () => cleanupClosedCall(call.peer, call));
  }

  function cleanupClosedCall(peerId, call) {
    if (state.mediaCalls.get(peerId) !== call) return;
    state.mediaCalls.delete(peerId);
    removeRemoteAudio(peerId);
  }

  async function attachRemoteStream(peerId, stream) {
    removeRemoteAudio(peerId);

    const audio = document.createElement("audio");
    audio.autoplay = true;
    audio.playsInline = true;
    audio.dataset.peerId = peerId;
    audio.srcObject = stream;
    dom.remoteAudioContainer.appendChild(audio);
    state.remoteAudios.set(peerId, audio);
    addAnalysisNode(peerId, stream);

    try {
      await audio.play();
    } catch (_) {
      dom.enableAudioButton.hidden = false;
    }
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
    stopPermissionMeter();
    updateRoomUrl();
    updateRoomDetails();
    renderParticipants();
    updateMuteControl();
    setConnectionStatus("connected", "Conectado");
    showScreen("room");
    await resumeAudioContext();

    if (state.microphoneGranted && state.localStream?.getAudioTracks().length) {
      addAnalysisNode(state.selfPeerId, state.localStream);
    }

    document.title = `Sala ${formatRoomCode(state.roomCode)} — Cloak`;
    showToast(
      state.isHost
        ? "Sala criada. Seu convite já está pronto."
        : "Você entrou na sala.",
    );
  }

  function updateRoomDetails() {
    const formatted = formatRoomCode(state.roomCode);
    const host = state.participants.get(state.hostPeerId);
    dom.roomCodeDisplay.textContent = formatted;
    dom.sidebarRoomCode.textContent = formatted;
    dom.roomTitle.textContent = state.isHost
      ? "Sua sala"
      : `Sala de ${host?.name || "voz"}`;
  }

  function renderParticipants() {
    const members = Array.from(state.participants.values()).sort((a, b) => {
      if (a.host !== b.host) return a.host ? -1 : 1;
      if ((a.peerId === state.selfPeerId) !== (b.peerId === state.selfPeerId)) {
        return a.peerId === state.selfPeerId ? -1 : 1;
      }
      return a.name.localeCompare(b.name, "pt-BR");
    });

    dom.participantsGrid.replaceChildren();
    members.forEach((member) =>
      dom.participantsGrid.appendChild(createParticipantCard(member)),
    );
    dom.participantCount.textContent = String(members.length);
    dom.capacityCount.textContent = String(members.length);
    dom.waitingCard.hidden = members.length !== 1;
  }

  function createParticipantCard(member) {
    const isSelf = member.peerId === state.selfPeerId;
    const isSpeaking =
      state.speakingPeers.has(member.peerId) &&
      !member.muted &&
      !member.listener;
    const card = document.createElement("article");
    card.className = "participant-card";
    card.id = participantCardId(member.peerId);
    card.dataset.color = String(hashString(member.peerId) % 4);
    card.classList.toggle("is-speaking", isSpeaking);
    card.classList.toggle("is-muted", member.muted || member.listener);

    const avatar = document.createElement("div");
    avatar.className = "participant-avatar";
    avatar.textContent = getInitials(member.name);
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
    name.textContent = member.name;
    nameRow.appendChild(name);

    if (isSelf) nameRow.appendChild(createBadge("Você"));
    if (member.host) nameRow.appendChild(createBadge("Anfitrião", "host"));

    const status = document.createElement("p");
    status.className = "participant-state";
    status.textContent = participantStatusText(member, isSpeaking);

    info.append(nameRow, status);
    card.append(avatar, info);
    card.setAttribute(
      "aria-label",
      `${member.name}${isSelf ? ", você" : ""}. ${participantStatusText(member, isSpeaking)}.`,
    );
    return card;
  }

  function createBadge(label, extraClass = "") {
    const badge = document.createElement("span");
    badge.className = `participant-badge ${extraClass}`.trim();
    badge.textContent = label;
    return badge;
  }

  function participantStatusText(member, speaking = false) {
    if (member.listener) return "Somente ouvindo";
    if (member.muted) return "Microfone silenciado";
    if (speaking) return "Falando agora";
    return "Na sala";
  }

  function toggleMute() {
    const track = state.localStream?.getAudioTracks()[0];
    if (!track || !state.microphoneGranted) {
      showToast(
        "Você entrou apenas para ouvir. Saia e entre novamente para usar o microfone.",
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
    showToast(state.muted ? "Microfone silenciado." : "Microfone ativado.");
  }

  function updateMuteControl() {
    const listener = !state.microphoneGranted;
    dom.muteButton.classList.toggle("is-muted", state.muted && !listener);
    dom.muteButton.classList.toggle("is-listener", listener);
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
    state.microphoneGranted = false;
    state.muted = true;
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
        "O microfone foi desconectado. Conecte-o e tente novamente.";
      dom.microphoneReady.hidden = true;
      dom.permissionInitial.hidden = false;
    }
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

  async function addAnalysisNode(peerId, stream) {
    removeAnalysisNode(peerId);
    if (!stream?.getAudioTracks().length) return;
    const context = await ensureAudioContext();
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
      ? "Como você criou esta sala, a conversa será encerrada para todas as pessoas."
      : "Você deixará esta conversa e seu microfone será desligado.";

    if (typeof dom.leaveDialog.showModal === "function") {
      dom.leaveDialog.returnValue = "cancel";
      dom.leaveDialog.showModal();
    } else if (window.confirm(dom.leaveDialogDescription.textContent)) {
      leaveCurrentRoom(true);
    }
  }

  function leaveCurrentRoom(notify) {
    if (!state.joined && !state.peer) return;
    const previousCode = state.roomCode;

    if (notify) notifyDeparture();
    closeNetworkConnections(true);
    clearRoomHash();
    resetPermissionUI();
    resetSessionIdentity();
    dom.roomCode.value = formatRoomCode(previousCode);
    showScreen("home");
    document.title = "Cloak — Salas de voz privadas";
    showToast("Você saiu da sala.");
  }

  function remoteRoomClosed(message) {
    if (state.leaving) return;
    const previousCode = state.roomCode;
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

    if (state.pendingJoin) {
      const pendingJoin = state.pendingJoin;
      state.pendingJoin = null;
      pendingJoin.reject(createAppError("cancelled", "Entrada cancelada."));
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
    dom.remoteAudioContainer.replaceChildren();
    dom.enableAudioButton.hidden = true;
    stopPermissionMeter();
    stopAllAnalysis(stopMedia);

    if (stopMedia) {
      stopLocalTracks();
      state.silentStream = null;
      state.microphoneGranted = false;
      state.muted = true;
    }

    state.leaving = previousLeaving;
  }

  function stopLocalTracks() {
    if (state.localStream) {
      state.localStream.getTracks().forEach((track) => track.stop());
    }
    state.localStream = null;
  }

  function resetSessionIdentity() {
    state.mode = null;
    state.roomCode = "";
    state.displayName = "";
    state.isHost = false;
    state.leaving = false;
    state.microphoneGranted = false;
    state.muted = true;
  }

  function resetPermissionUI() {
    stopPermissionMeter();
    dom.permissionInitial.hidden = false;
    dom.microphoneReady.hidden = true;
    dom.permissionError.textContent = "";
    dom.microphoneLabel.textContent = "Pronto para usar";
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
