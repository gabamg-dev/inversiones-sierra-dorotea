// Placeholder de servicio Firebase (NO importa SDK, NO inicializa app).
// Próxima fase: exponer init + clients (auth/firestore/storage) detrás de feature flags.
(function () {
  "use strict";

  const global = window;
  global.ISD = global.ISD || {};

  function notImplemented(name) {
    throw new Error(`${name} aún no está implementado (Firebase pendiente).`);
  }

  global.ISD.firebaseService = {
    initFirebase: function () {
      notImplemented("initFirebase");
    },
    getAuth: function () {
      notImplemented("getAuth");
    },
    getFirestore: function () {
      notImplemented("getFirestore");
    },
    getStorage: function () {
      notImplemented("getStorage");
    },
  };
})();
