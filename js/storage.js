(function () {
  "use strict";

  const global = window;
  global.ISD = global.ISD || {};

  const STORAGE_KEYS = {
    MOVEMENTS: "isd.movements.v1",
  };

  function safeJsonParse(value, fallback) {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  function loadMovements() {
    const raw = localStorage.getItem(STORAGE_KEYS.MOVEMENTS);
    const parsed = safeJsonParse(raw, []);
    return Array.isArray(parsed) ? parsed : [];
  }

  function saveMovements(movements) {
    if (!Array.isArray(movements)) throw new Error("saveMovements espera un array");
    localStorage.setItem(STORAGE_KEYS.MOVEMENTS, JSON.stringify(movements));
  }

  function resetAll() {
    localStorage.removeItem(STORAGE_KEYS.MOVEMENTS);
  }

  function updateMovement(id, updatedMovement) {
    const list = loadMovements();
    const idx = list.findIndex((m) => m && String(m.id) === String(id));
    if (idx === -1) return false;
    list[idx] = updatedMovement;
    saveMovements(list);
    return true;
  }

  function deleteMovement(id) {
    const list = loadMovements().filter((m) => !m || String(m.id) !== String(id));
    saveMovements(list);
    return true;
  }

  global.ISD.storage = {
    loadMovements,
    saveMovements,
    resetAll,
    updateMovement,
    deleteMovement,
  };
})();

