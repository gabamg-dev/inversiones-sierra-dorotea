// Placeholder de configuración Firebase (NO inicializa SDK).
// La app HTML estática actual sigue siendo local-first; Firebase se integrará en fases posteriores.
//
// IMPORTANTE:
// - No hardcodear firebaseConfig en el repo.
// - En Next.js/Vercel: usar process.env.NEXT_PUBLIC_FIREBASE_*.
// - En HTML estático futuro: inyectar config vía build step o variables públicas de Vercel (sin secretos).
// - No usar Firebase Analytics todavía (no llamar getAnalytics).
(function () {
  "use strict";

  const global = window;
  global.ISD = global.ISD || {};

  /**
   * Lee configuración desde window.__ISD_FIREBASE_CONFIG__ si existe (inyección futura),
   * o desde placeholders vacíos (modo offline).
   */
  function readPublicFirebaseConfigFromWindow() {
    const cfg = global.__ISD_FIREBASE_CONFIG__;
    if (!cfg || typeof cfg !== "object") return null;
    return {
      apiKey: String(cfg.apiKey || ""),
      authDomain: String(cfg.authDomain || ""),
      projectId: String(cfg.projectId || ""),
      storageBucket: String(cfg.storageBucket || ""),
      messagingSenderId: String(cfg.messagingSenderId || ""),
      appId: String(cfg.appId || ""),
      measurementId: String(cfg.measurementId || ""),
    };
  }

  global.ISD.firebaseConfig = {
    readPublicFirebaseConfigFromWindow,
  };
})();
