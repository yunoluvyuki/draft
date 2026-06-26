/* ───────────────────────────────────────────────────────────────────────────
   BLOODY THRONE : IDLE RPG — cloud save (VPS).
   Syncs the localStorage save with the server when signed in (web session):
     • PULL on boot  → cloud is the source of truth (overwrites local before load)
     • PUSH on a timer + when the tab hides/closes  (decoupled from the game's
       frequent saveGame(), so we don't hammer the server)
   Guests / the EXE (different auth) get a 401 → stays localStorage-only (no-op).
   Touches no game logic: init.js just awaits window.cloudPull() before loadGame().
   ─────────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var KEY = 'bloody_throne_save';   // must match save.js
  var API = '/api';
  var enabled = false;              // true once a signed-in session is confirmed
  var lastPushed = null;            // last save string we sent (skip unchanged)

  // Pull the cloud save into localStorage BEFORE the game reads it.
  // Resolves regardless; on 401 (guest) or offline it's a harmless no-op.
  window.cloudPull = function () {
    return fetch(API + '/load.php', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d || !d.ok) return;                 // not signed in → local-only
        enabled = true;
        if (d.data) {                            // cloud has a save → it wins
          localStorage.setItem(KEY, d.data);
          lastPushed = d.data;
        } else {                                 // no cloud save yet → first push uploads local
          lastPushed = localStorage.getItem(KEY);
        }
      })
      .catch(function () { /* offline → local-only */ });
  };

  function pushNow(keepalive) {
    if (!enabled) return;
    var data = localStorage.getItem(KEY);
    if (!data || data === lastPushed) return;    // nothing new to send
    lastPushed = data;
    var opts = {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'data=' + encodeURIComponent(data),
    };
    if (keepalive) opts.keepalive = true;        // survives tab close
    fetch(API + '/save.php', opts).catch(function () { lastPushed = null; });  // failed → retry next tick
  }

  setInterval(function () { pushNow(false); }, 15000);
  document.addEventListener('visibilitychange', function () { if (document.hidden) pushNow(true); });
  window.addEventListener('pagehide', function () { pushNow(true); });
})();
