/* Presentation-only actions. Room and media permissions stay in app.js. */
"use strict";
(() => {
  const help = document.querySelector('#studio-help-dialog');
  let helpTrigger = null;
  document.querySelectorAll('[data-studio-help]').forEach(button => {
    button.addEventListener('click', () => { helpTrigger = button; help.showModal(); });
  });
  document.querySelector('#studio-help-close').addEventListener('click', () => help.close());
  document.querySelector('#studio-help-done').addEventListener('click', () => help.close());
  help.addEventListener('close', () => helpTrigger?.focus());
  help.addEventListener('click', event => {
    const rect = help.getBoundingClientRect();
    if (event.target === help && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) help.close();
  });
  document.querySelector('#studio-share').addEventListener('click', () => document.querySelector('#screen-share-button').click());
})();
