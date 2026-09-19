/* Production toast behavior with a deterministic clock and a minimal DOM. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
const start = source.indexOf('  let toastDismissTimer = null;');
const end = source.indexOf('  function broadcastControl(', start);
assert.ok(start >= 0 && end > start);

function setup() {
  let now = 0, sequence = 0;
  const timers = new Map();
  const region = {
    children: [],
    replaceChildren(node) {
      for (const old of this.children) old.parent = null;
      this.children = [node];
      node.parent = this;
    },
  };
  const context = {
    dom: { toastRegion: region },
    document: { createElement() {
      return {
        className: '', textContent: '', parent: null,
        classList: { added: new Set(), add(name) { this.added.add(name); } },
        remove() {
          if (this.parent) this.parent.children = this.parent.children.filter(n => n !== this);
          this.parent = null;
        },
      };
    } },
    setTimeout(fn, delay) { const id = ++sequence; timers.set(id, { fn, at: now + delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
  };
  context.window = context;
  vm.runInNewContext(source.slice(start, end) + '\nwindow.show = showToast;', context);
  return {
    region, timers, show: context.show,
    advance(ms) {
      const target = now + ms;
      for (;;) {
        const next = [...timers].sort((a, b) => a[1].at - b[1].at)[0];
        if (!next || next[1].at > target) break;
        now = next[1].at;
        timers.delete(next[0]);
        next[1].fn();
      }
      now = target;
    },
  };
}

test('a burst of notifications displays only the latest, without a queue', () => {
  const ui = setup();
  for (let i = 0; i < 30; i++) {
    ui.show(`Aviso ${i}`, i % 2 ? 'error' : 'info');
    assert.equal(ui.region.children.length, 1);
    assert.equal(ui.timers.size, 1);
  }
  assert.equal(ui.region.children[0].textContent, 'Aviso 29');
  assert.equal(ui.region.children[0].className, 'toast is-error');
  ui.advance(4020);
  assert.equal(ui.region.children.length, 0);
  assert.equal(ui.timers.size, 0);
});

test('replacing a visible toast starts its own full display duration', () => {
  const ui = setup();
  ui.show('Anterior', 'error');
  ui.advance(2000);
  ui.show('Atual');
  const current = ui.region.children[0];
  ui.advance(2020);
  assert.equal(ui.region.children[0], current);
  assert.equal(current.classList.added.has('is-leaving'), false);
  assert.equal(current.className, 'toast');
  ui.advance(1780);
  assert.equal(current.classList.added.has('is-leaving'), true);
  ui.advance(220);
  assert.equal(ui.region.children.length, 0);
});

test('replacing a toast during its exit cancels the previous removal timer', () => {
  const ui = setup();
  ui.show('Anterior');
  ui.advance(3800);
  assert.equal(ui.region.children[0].classList.added.has('is-leaving'), true);
  ui.show('<b>Mensagem literal</b>');
  const current = ui.region.children[0];
  ui.advance(220);
  assert.equal(ui.region.children.length, 1);
  assert.equal(ui.region.children[0], current);
  assert.equal(current.textContent, '<b>Mensagem literal</b>');
  assert.equal(current.classList.added.has('is-leaving'), false);
  ui.advance(3800);
  assert.equal(ui.region.children.length, 0);
  assert.equal(ui.timers.size, 0);
});
