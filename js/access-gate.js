(function () {
  "use strict";

  const global = window;
  global.ISD = global.ISD || {};

  const STORAGE_KEY = "isd.access.ok";
  const DEFAULT_PASSWORD = "112233";

  function byId(id) {
    return document.getElementById(id);
  }

  function isUnlocked() {
    try {
      return sessionStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  }

  function unlockAccess() {
    try {
      sessionStorage.setItem(STORAGE_KEY, "true");
    } catch {
      // noop
    }
    document.documentElement.classList.remove("access-locked");
  }

  function lockAccess() {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // noop
    }
    document.documentElement.classList.add("access-locked");
  }

  function validateAccessPassword(password) {
    // Importante: esto NO es seguridad real. Es una barrera temporal (versión estática).
    return String(password || "") === DEFAULT_PASSWORD;
  }

  function ensureGateMarkup() {
    if (byId("accessGateOverlay")) return;

    const overlay = document.createElement("div");
    overlay.id = "accessGateOverlay";
    overlay.className = "access-gate";
    overlay.innerHTML = `
      <div class="access-gate-inner">
        <header class="access-gate-hero">
          <img
            src="./assets/logo-sierra-dorotea.png"
            alt=""
            class="access-gate-logo"
            decoding="async"
          />
          <h1 id="accessGateTitle" class="access-gate-title">Inversiones Sierra Dorotea</h1>
          <p class="access-gate-subtitle">Control financiero del proyecto</p>
        </header>
        <div class="access-gate-card" role="dialog" aria-modal="true" aria-labelledby="accessGateTitle">
          <p class="access-gate-lead">Introduce la clave para continuar.</p>
          <label class="access-gate-field">
            Clave de acceso
            <input id="accessGatePassword" type="password" autocomplete="current-password" />
          </label>
          <div id="accessGateError" class="error access-gate-error" style="display:none;"></div>
          <div class="form-actions access-gate-actions">
            <button id="btnAccessGateEnter" class="btn primary" type="button">Ingresar</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  }

  function initAccessGate() {
    ensureGateMarkup();

    const input = byId("accessGatePassword");
    const btn = byId("btnAccessGateEnter");
    const err = byId("accessGateError");

    function showError(msg) {
      if (!err) return;
      err.textContent = String(msg || "");
      err.style.display = msg ? "" : "none";
    }

    function tryEnter() {
      showError("");
      const ok = validateAccessPassword(input ? input.value : "");
      if (!ok) {
        showError("Clave incorrecta.");
        if (input) input.focus();
        return;
      }
      unlockAccess();
      if (input) input.value = "";
      showError("");
    }

    if (btn) btn.addEventListener("click", tryEnter);
    if (input) {
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          tryEnter();
        }
      });
    }

    // Estado inicial
    if (isUnlocked()) unlockAccess();
    else lockAccess();

    // Focus al bloquear
    if (!isUnlocked() && input) setTimeout(() => input.focus(), 0);
  }

  global.ISD.accessGate = {
    initAccessGate,
    validateAccessPassword,
    lockAccess,
    unlockAccess,
  };
})();

