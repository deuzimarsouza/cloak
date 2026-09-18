/* DOM/event simulation: verifies UI state transitions, not browser rendering,
 * native focus trapping, the real mobile keyboard, or WebRTC. */
const {test} = require('node:test');
const assert = require('node:assert/strict');
const setup = require('../room-responsive.js');

function fixture({mobile = true, room = true, modal = true} = {}) {
  const observers = [], frames = new Map();
  let frameId = 0;
  const nodes = new Map();
  const doc = {activeElement: null};
  function changed(target, record) {
    for (const observer of observers) {
      if (observer.target !== target || !observer.options[record.type]) continue;
      if (record.type === 'attributes' && !observer.options.attributeFilter.includes(record.attributeName)) continue;
      observer.records.push(record);
      if (!observer.pending) {
        observer.pending = true;
        queueMicrotask(() => {
          observer.pending = false;
          observer.callback(observer.records.splice(0));
        });
      }
    }
  }
  class Node extends EventTarget {
    constructor(id = '', classes = '', nodeType = 1) {
      super(); this.id = id; this.nodeType = nodeType; this.parentNode = null;
      this.children = []; this.attributes = new Map(); this.hidden = false;
      this.textContent = ''; this.value = ''; this.scrollTop = 0;
      this.scrollHeight = 600; this.clientHeight = 300;
      const list = new Set(classes.split(' ').filter(Boolean));
      this.classList = {
        contains: name => list.has(name),
        toggle: (name, force = !list.has(name)) => {
          if (list.has(name) === force) return force;
          force ? list.add(name) : list.delete(name);
          changed(this, {type: 'attributes', attributeName: 'class'});
          return force;
        },
        add: name => this.classList.toggle(name, true),
        remove: name => this.classList.toggle(name, false),
      };
      const styles = new Map();
      this.style = {
        setProperty: (key, value) => styles.set(key, value),
        removeProperty: key => styles.delete(key),
        getPropertyValue: key => styles.get(key) || '',
      };
      if (id) nodes.set(id, this);
    }
    setAttribute(key, value) {this.attributes.set(key, value);}
    getAttribute(key) {return this.attributes.get(key) ?? null;}
    append(node) {this.insertBefore(node, null);}
    insertBefore(node, reference) {
      if (node.parentNode) {
        const previous = node.parentNode;
        previous.children.splice(previous.children.indexOf(node), 1);
        changed(previous, {type: 'childList', addedNodes: [], removedNodes: [node]});
      }
      const index = reference ? this.children.indexOf(reference) : this.children.length;
      assert.ok(index >= 0); this.children.splice(index, 0, node); node.parentNode = this;
      changed(this, {type: 'childList', addedNodes: [node], removedNodes: []});
    }
    before(node) {this.parentNode.insertBefore(node, this);}
    after(node) {this.parentNode.insertBefore(node, this.parentNode.children[this.parentNode.children.indexOf(this) + 1] || null);}
    contains(node) {return node === this || this.children.some(child => child.contains(node));}
    focus() {doc.activeElement = this;}
    click() {this.dispatchEvent(new Event('click'));}
    matches(selector) {
      return selector === '.chat-message:not(.is-self)' && this.classList.contains('chat-message') && !this.classList.contains('is-self');
    }
  }
  const make = (id, parent, classes) => {
    const node = new Node(id, classes); if (parent) parent.append(node); return node;
  };
  const html = make('html'), body = make('body', html, room ? 'room-active' : '');
  const header = make('header', body), controls = make('room-controls', header);
  const mute = make('mute-button', controls), voice = make('voice-equalizer-button', controls);
  const menuButton = make('copy-invite-button', header);
  const layout = make('layout', body), chat = make('room-chat', layout);
  const chatClose = make('mobile-chat-close', chat), messages = make('chat-messages', chat);
  const input = make('chat-input', chat), newMessages = make('chat-new-messages-button', chat);
  const picker = make('emoji-picker', chat), emojiButton = make('emoji-toggle-button', chat);
  const fab = make('mobile-chat-button', body), badge = make('chat-unread-count', fab);
  const menu = make('room-menu-dialog', body), menuClose = make('room-menu-close', menu);
  const controlsSection = make('room-menu-call-controls', menu), slot = make('room-controls-slot', controlsSection);
  const dialog = make('mobile-chat-dialog', body), equalizer = make('equalizer-dialog', body);
  for (const item of [menu, dialog, equalizer]) {
    item.open = false;
    item.showModal = function() {this.open = true;};
    item.close = function() {
      if (!this.open) return;
      this.open = false;
      queueMicrotask(() => this.dispatchEvent(new Event('close')));
    };
  }
  if (!modal) dialog.showModal = undefined;
  Object.assign(doc, {
    documentElement: html, body,
    querySelector: selector => selector === 'dialog[open]'
      ? [dialog, menu, equalizer].find(node => node.open) || null
      : nodes.get(selector.slice(1)) || null,
    createComment: () => new Node('', '', 8),
  });
  const media = new EventTarget(); media.matches = mobile;
  const viewport = new EventTarget(); Object.assign(viewport, {height: 800, offsetTop: 0, scale: 1});
  const win = new EventTarget();
  Object.assign(win, {
    Event, matchMedia: () => media, visualViewport: viewport,
    requestAnimationFrame(fn) {const id = ++frameId; frames.set(id, fn); return id;},
    cancelAnimationFrame(id) {frames.delete(id);},
    MutationObserver: class {
      constructor(callback) {this.callback = callback; this.records = []; observers.push(this);}
      observe(target, options) {this.target = target; this.options = options;}
    },
  });
  setup(win, doc);
  return {
    doc, win, html, body, header, layout, controls, mute, voice, menu, menuButton, menuClose,
    slot, controlsSection, chat, dialog, chatClose, messages, input, newMessages, fab, badge, viewport, picker, emojiButton, equalizer,
    resize(mobile) {media.matches = mobile; media.dispatchEvent(new Event('change'));},
    message(self = false) {const node = new Node('', `chat-message${self ? ' is-self' : ''}`); messages.append(node); return node;},
    async flush() {
      await Promise.resolve();
      const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn());
      await Promise.resolve();
    },
  };
}

test('compact menu reuses the live buttons and preserves their state/listeners through resizing', async () => {
  const f = fixture(); let calls = 0;
  f.mute.addEventListener('click', () => calls++);
  f.mute.setAttribute('aria-pressed', 'true');
  assert.equal(f.controls.parentNode, f.slot);
  f.mute.click(); f.resize(false); f.mute.click(); f.resize(true); f.mute.click();
  await f.flush();
  assert.equal(calls, 3); assert.equal(f.mute.getAttribute('aria-pressed'), 'true');
  assert.equal(f.controls.parentNode, f.slot);
});
test('opening and closing chat preserves draft, messages and input listeners', async () => {
  const f = fixture(); f.input.value = 'Mensagem ainda não enviada'; const message = f.message();
  let inputs = 0; f.input.addEventListener('input', () => inputs++);
  f.fab.click(); await f.flush();
  assert.equal(f.dialog.open, true); assert.equal(f.doc.activeElement, f.chatClose);
  assert.equal(f.fab.getAttribute('aria-expanded'), 'true');
  f.chatClose.click(); await f.flush(); f.fab.click(); await f.flush();
  assert.equal(f.input.value, 'Mensagem ainda não enviada');
  assert.ok(f.messages.contains(message)); assert.equal(inputs, 2);
});
test('only incoming messages received while the compact chat is closed count as unread', async () => {
  const f = fixture(); f.message(); f.message(true); await f.flush();
  assert.equal(f.badge.textContent, '1'); assert.equal(f.badge.hidden, false);
  f.fab.click(); f.message(); await f.flush();
  assert.equal(f.badge.hidden, true);
  f.chatClose.click(); await f.flush(); f.resize(false); f.message(); await f.flush();
  assert.equal(f.badge.hidden, true);
});
test('returning to desktop restores the existing chat and controls without losing the draft', async () => {
  const f = fixture(); f.fab.click(); await f.flush(); f.input.value = 'Rascunho';
  f.messages.scrollTop = 140;
  f.resize(false); await f.flush();
  assert.equal(f.dialog.open, false); assert.equal(f.fab.hidden, true);
  assert.equal(f.chat.parentNode, f.layout); assert.equal(f.controls.parentNode, f.header);
  assert.equal(f.input.value, 'Rascunho'); assert.equal(f.messages.scrollTop, 140);
  assert.equal(f.controlsSection.hidden, true);
});
test('rotating a desktop chat into compact mode keeps the focused conversation open', async () => {
  const f = fixture({mobile: false}); f.input.focus(); f.input.value = 'Continuar';
  f.resize(true); await f.flush();
  assert.equal(f.dialog.open, true); assert.equal(f.chat.parentNode, f.dialog);
  assert.equal(f.input.value, 'Continuar');
});
test('leaving the room closes the chat and clears unread state for the next session', async () => {
  const f = fixture(); f.message(); await f.flush(); f.fab.click();
  f.body.classList.remove('room-active'); await f.flush();
  assert.equal(f.dialog.open, false); assert.equal(f.fab.hidden, true);
  f.body.classList.add('room-active'); await f.flush();
  assert.equal(f.badge.hidden, true); assert.equal(f.fab.hidden, false);
});
test('chat cannot open on home or desktop and keeps the original layout without modal support', async () => {
  for (const options of [{room: false}, {mobile: false}, {modal: false}]) {
    const f = fixture(options); f.fab.click(); await f.flush();
    assert.equal(f.dialog.open, false); assert.equal(f.fab.hidden, true);
    if (options.modal === false) assert.equal(f.chat.parentNode, f.layout);
  }
});
test('keyboard viewport resizes the chat and pinch zoom is not forced back to scale one', async () => {
  const f = fixture(); f.fab.click(); await f.flush();
  f.viewport.height = 360; f.viewport.offsetTop = 24;
  f.viewport.dispatchEvent(new Event('resize')); await f.flush();
  assert.equal(f.dialog.style.getPropertyValue('--chat-height'), '360px');
  assert.equal(f.dialog.style.getPropertyValue('--chat-top'), '24px');
  f.viewport.scale = 2; f.viewport.dispatchEvent(new Event('resize')); await f.flush();
  assert.equal(f.dialog.style.getPropertyValue('--chat-height'), '');
});
test('Escape closes chat, resets emoji state and returns focus to its launcher', async () => {
  const f = fixture(); f.fab.click(); f.picker.hidden = false;
  f.emojiButton.setAttribute('aria-expanded', 'true');
  const event = new Event('cancel', {cancelable: true}); f.dialog.dispatchEvent(event); await f.flush();
  assert.equal(event.defaultPrevented, true); assert.equal(f.dialog.open, false);
  assert.equal(f.doc.activeElement, f.fab); assert.equal(f.picker.hidden, true);
  assert.equal(f.emojiButton.getAttribute('aria-expanded'), 'false');
});
test('a delayed close event cannot reset a chat that was immediately reopened', async () => {
  const f = fixture(); f.fab.click(); f.chatClose.click(); f.fab.click(); await f.flush();
  assert.equal(f.dialog.open, true); assert.equal(f.doc.activeElement, f.chatClose);
  assert.equal(f.fab.getAttribute('aria-expanded'), 'true'); assert.equal(f.fab.hidden, true);
  assert.equal(f.dialog.style.getPropertyValue('--chat-height'), '800px');
});
test('resize does not close another room dialog or destroy its controls', async () => {
  const f = fixture(); f.menu.showModal(); f.equalizer.showModal(); f.voice.focus();
  f.resize(false); await f.flush();
  assert.equal(f.menu.open, true); assert.equal(f.equalizer.open, true);
  assert.equal(f.voice.parentNode, f.controls);
});
