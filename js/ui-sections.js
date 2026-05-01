// UI Sections: paneles colapsables con persistencia opcional.
// Script clásico para compatibilidad file:// en macOS.
(function () {
  "use strict";

  const global = window;
  global.ISD = global.ISD || {};

  const STORAGE_KEY = "isd.ui.collapsibleSections.v1";

  function safeJsonParse(value, fallback) {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  function getSectionState() {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = safeJsonParse(raw, {});
    return parsed && typeof parsed === "object" ? parsed : {};
  }

  function saveSectionState(state) {
    if (!state || typeof state !== "object") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function setExpanded(sectionEl, isOpen) {
    const btn = sectionEl.querySelector(".section-toggle");
    const icon = sectionEl.querySelector(".section-toggle-icon");
    sectionEl.dataset.collapsed = isOpen ? "false" : "true";
    if (btn) btn.setAttribute("aria-expanded", isOpen ? "true" : "false");
    if (icon) icon.textContent = isOpen ? "▼" : "▶";
  }

  function initCollapsibleSections(opts) {
    const onToggle = typeof opts?.onToggle === "function" ? opts.onToggle : null;
    const state = getSectionState();

    const sections = Array.from(document.querySelectorAll(".collapsible-section[data-section-id]"));
    for (const s of sections) {
      const id = String(s.dataset.sectionId || "").trim();
      if (!id) continue;

      const isOpen = state[id] === undefined ? true : Boolean(state[id]);
      setExpanded(s, isOpen);

      const btn = s.querySelector(".section-toggle");
      if (!btn) continue;
      btn.addEventListener("click", () => {
        const openNow = s.dataset.collapsed !== "true";
        const nextOpen = !openNow;
        setExpanded(s, nextOpen);
        const nextState = { ...getSectionState(), [id]: nextOpen };
        saveSectionState(nextState);
        if (onToggle) onToggle(id, nextOpen);
      });
    }
  }

  global.ISD.uiSections = {
    STORAGE_KEY,
    initCollapsibleSections,
    getSectionState,
    saveSectionState,
  };
})();

