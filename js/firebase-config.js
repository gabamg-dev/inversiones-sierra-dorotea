// Inicialización Firebase (compat SDK vía CDN).
// Valores públicos de la Web App (no son secretos; no incluir claves de servicio ni OpenAI).
(function () {
  "use strict";

  const global = window;
  global.ISD = global.ISD || {};

  const firebaseConfig = {
    apiKey: "AIzaSyAcVQN4w7748-dXVs6RzjyYRoQyKVrYE0I",
    authDomain: "inversiones-sierra-dorotea.firebaseapp.com",
    projectId: "inversiones-sierra-dorotea",
    storageBucket: "inversiones-sierra-dorotea.firebasestorage.app",
    messagingSenderId: "782906555137",
    appId: "1:782906555137:web:d6ad2f226da3633aa67900",
    measurementId: "G-LYBSQQYNQ5",
  };

  global.ISD.firebaseConfig = firebaseConfig;
  global.ISD.firebaseApp = null;
  global.ISD.firebaseAuth = null;
  global.ISD.firebaseDb = null;
  global.ISD.firebaseStorage = null;

  if (typeof firebase === "undefined") {
    console.error("ISD Firebase: el SDK compat no está cargado (window.firebase ausente). Revisa el orden de <script> en index.html.");
    return;
  }

  try {
    if (!firebase.apps || !firebase.apps.length) {
      global.ISD.firebaseApp = firebase.initializeApp(firebaseConfig);
    } else {
      global.ISD.firebaseApp = firebase.app();
    }
    global.ISD.firebaseAuth = firebase.auth();
    global.ISD.firebaseDb = firebase.firestore();
    global.ISD.firebaseStorage = firebase.storage();
  } catch (err) {
    console.error("ISD Firebase: error al inicializar la app:", err);
  }
})();
