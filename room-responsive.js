/* Reuses the live controls/chat nodes, including their listeners and drafts. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory;
  else factory(root, root.document);
})(typeof window !== "undefined" ? window : globalThis, function (win, doc) {
  "use strict";

  const controls = doc.querySelector("#room-controls");
  const controlsSlot = doc.querySelector("#room-controls-slot");
  const controlsSection = doc.querySelector("#room-menu-call-controls");
  const menu = doc.querySelector("#room-menu-dialog");
  const menuButton = doc.querySelector("#copy-invite-button");
  const menuClose = doc.querySelector("#room-menu-close");
  const chat = doc.querySelector("#room-chat");
  const chatDialog = doc.querySelector("#mobile-chat-dialog");
  const chatButton = doc.querySelector("#mobile-chat-button");
  const chatClose = doc.querySelector("#mobile-chat-close");
  const messages = doc.querySelector("#chat-messages");
  const input = doc.querySelector("#chat-input");
  const unreadBadge = doc.querySelector("#chat-unread-count");
  const newMessages = doc.querySelector("#chat-new-messages-button");
  if (![controls, controlsSlot, controlsSection, menu, menuButton, menuClose,
    chat, chatDialog, chatButton, chatClose, messages, input, unreadBadge,
    newMessages].every(Boolean)) return;

  const media = win.matchMedia("(max-width: 1100px), (hover: none) and (pointer: coarse)");
  const controlsAnchor = doc.createComment("Call controls on desktop");
  const chatAnchor = doc.createComment("Text chat on desktop");
  controls.before(controlsAnchor);
  chat.before(chatAnchor);
  let compact = false;
  let unread = 0;
  let viewportFrame = 0;
  let wasInRoom = doc.body.classList.contains("room-active");

  const inRoom = () => doc.body.classList.contains("room-active");

  function updateButton() {
    chatButton.hidden = !compact || !inRoom() || chatDialog.open;
    chatButton.setAttribute("aria-expanded", String(chatDialog.open));
    chatButton.setAttribute("aria-label", unread
      ? `Abrir chat de texto, ${unread} ${unread === 1 ? "nova mensagem" : "novas mensagens"}`
      : "Abrir chat de texto");
    unreadBadge.hidden = unread === 0;
    unreadBadge.textContent = unread > 99 ? "99+" : String(unread);
  }

  function updateViewport() {
    if (!chatDialog.open || !compact) return;
    const viewport = win.visualViewport;
    const nearBottom = messages.scrollHeight - messages.scrollTop - messages.clientHeight < 56;
    // Follow the keyboard, but let the browser handle pinch zoom normally.
    if (viewport && Math.abs(viewport.scale - 1) < 0.01) {
      chatDialog.style.setProperty("--chat-height", `${Math.round(viewport.height)}px`);
      chatDialog.style.setProperty("--chat-top", `${Math.max(0, Math.round(viewport.offsetTop))}px`);
    } else {
      chatDialog.style.removeProperty("--chat-height");
      chatDialog.style.removeProperty("--chat-top");
    }
    if (nearBottom) messages.scrollTop = messages.scrollHeight;
  }

  function scheduleViewport() {
    if (viewportFrame || !chatDialog.open) return;
    viewportFrame = win.requestAnimationFrame(() => {
      viewportFrame = 0;
      updateViewport();
    });
  }

  function closeChat() {
    if (chatDialog.open) chatDialog.close();
    updateButton();
  }

  function finishClose() {
    // A native close event may arrive after the chat has already reopened.
    if (chatDialog.open) return;
    win.cancelAnimationFrame(viewportFrame);
    viewportFrame = 0;
    chatDialog.style.removeProperty("--chat-height");
    chatDialog.style.removeProperty("--chat-top");
    const picker = doc.querySelector("#emoji-picker");
    if (picker) picker.hidden = true;
    doc.querySelector("#emoji-toggle-button")?.setAttribute("aria-expanded", "false");
    updateButton();
    if (inRoom() && !doc.querySelector("dialog[open]")) {
      (compact ? chatButton : messages).focus({ preventScroll: true });
    }
  }

  function openChat() {
    if (!compact || !inRoom() || chatDialog.open) return;
    chatDialog.showModal();
    unread = 0;
    updateButton();
    updateViewport();
    // Opening the conversation should not force the on-screen keyboard open.
    chatClose.focus({ preventScroll: true });
    win.requestAnimationFrame(() => {
      if (!chatDialog.open) return;
      input.dispatchEvent(new win.Event("input", { bubbles: true }));
      messages.scrollTop = messages.scrollHeight;
      newMessages.hidden = true;
    });
  }

  function syncLayout() {
    compact = media.matches && typeof chatDialog.showModal === "function";
    doc.documentElement.classList.toggle("compact-room", compact);
    controlsSection.hidden = !compact;
    const controlsFocused = controls.contains(doc.activeElement);
    if (compact) {
      if (controls.parentNode !== controlsSlot) {
        controlsSlot.append(controls);
        if (controlsFocused && inRoom() && !menu.open) menuButton.focus({ preventScroll: true });
      }
      if (chat.parentNode !== chatDialog) {
        const chatFocused = chat.contains(doc.activeElement);
        chatDialog.append(chat);
        if (chatFocused && inRoom()) openChat();
      }
    } else {
      const wasOpen = chatDialog.open;
      const scrollTop = messages.scrollTop;
      closeChat();
      if (controls.parentNode !== controlsAnchor.parentNode) {
        controlsAnchor.after(controls);
        if (controlsFocused && menu.open) menuClose.focus({ preventScroll: true });
      }
      if (chat.parentNode !== chatAnchor.parentNode) {
        chatAnchor.after(chat);
        win.requestAnimationFrame(() => {
          if (compact) return;
          input.dispatchEvent(new win.Event("input", { bubbles: true }));
          messages.scrollTop = wasOpen ? scrollTop : messages.scrollHeight;
        });
      }
      unread = 0;
    }
    const room = inRoom();
    if (!room) closeChat();
    if (room !== wasInRoom) unread = 0;
    wasInRoom = room;
    updateButton();
  }

  chatButton.addEventListener("click", openChat);
  chatClose.addEventListener("click", closeChat);
  chatDialog.addEventListener("close", finishClose);
  chatDialog.addEventListener("cancel", event => {
    event.preventDefault();
    closeChat();
  });
  chatDialog.addEventListener("click", event => {
    if (event.target === chatDialog) closeChat();
  });
  media.addEventListener("change", syncLayout);
  win.addEventListener("resize", scheduleViewport);
  win.visualViewport?.addEventListener("resize", scheduleViewport);
  win.visualViewport?.addEventListener("scroll", scheduleViewport);
  new win.MutationObserver(syncLayout).observe(doc.body, { attributes: true, attributeFilter: ["class"] });
  new win.MutationObserver(records => {
    if (!compact || !inRoom() || chatDialog.open) return;
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.nodeType === 1 && node.matches(".chat-message:not(.is-self)")) unread += 1;
      }
    }
    updateButton();
  }).observe(messages, { childList: true });
  syncLayout();
});
