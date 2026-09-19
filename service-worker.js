"use strict";

const CACHE_PREFIX = "cloak-shell-";
// Mude esta versão sempre que qualquer item de APP_SHELL mudar.
const CACHE_VERSION = "2026-09-19-single-toast-1";
const CACHE_NAME = `${CACHE_PREFIX}${CACHE_VERSION}`;
const NAVIGATION_TIMEOUT = 4000;
const APP_SCOPE = new URL(self.registration.scope);
const APP_HOME = new URL("./", APP_SCOPE).href;
const OFFLINE_PAGE = new URL("./index.html", self.registration.scope).href;
const APP_SHELL = [
  APP_HOME,
  OFFLINE_PAGE,
  new URL("./manifest.webmanifest", self.registration.scope).href,
  new URL("./styles.css?v=14", self.registration.scope).href,
  new URL("./studio.css?v=11", self.registration.scope).href,
  new URL("./studio.js?v=2", self.registration.scope).href,
  new URL("./room-responsive.js?v=1", self.registration.scope).href,
  new URL("./vendor/peerjs.min.js?v=1.5.5", self.registration.scope).href,
  new URL("./app.js?v=16", self.registration.scope).href,
  new URL("./screen-audio.js?v=1", self.registration.scope).href,
  new URL("./pwa.js?v=1", self.registration.scope).href,
  new URL("./voice-effects-processor.js?v=1", self.registration.scope).href,
  new URL("./src/icons/apple-touch-icon.png", self.registration.scope).href,
  new URL("./src/icons/icon-192.png", self.registration.scope).href,
  new URL("./src/icons/icon-512.png", self.registration.scope).href,
  new URL("./src/icons/icon-maskable-512.png", self.registration.scope).href,
  new URL("./src/icons/exit.png", self.registration.scope).href,
  new URL(
    "./src/icons/microphone%20green%20on.png",
    self.registration.scope,
  ).href,
  new URL(
    "./src/icons/microphone%20red%20off.png",
    self.registration.scope,
  ).href,
  new URL("./src/icons/paper-plane.png", self.registration.scope).href,
  new URL("./src/icons/settings-sliders.png", self.registration.scope).href,
  new URL("./src/icons/share.png", self.registration.scope).href,
];
const APP_SHELL_URLS = new Set(APP_SHELL);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter(
              (name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME,
            )
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (
    url.origin !== APP_SCOPE.origin ||
    !url.pathname.startsWith(APP_SCOPE.pathname) ||
    request.headers.has("range")
  ) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (!APP_SHELL_URLS.has(url.href)) return;
  event.respondWith(cacheFirstAsset(request));
});

async function networkFirstNavigation(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetchWithTimeout(request, NAVIGATION_TIMEOUT);
    if (response.ok && response.type === "basic") {
      await cache.put(request, response.clone());
    }
    return response;
  } catch (_) {
    return (await cache.match(request)) || cache.match(OFFLINE_PAGE);
  }
}

async function fetchWithTimeout(request, timeout) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(request, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function cacheFirstAsset(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok && response.type === "basic") {
    await cache.put(request, response.clone());
  }
  return response;
}
