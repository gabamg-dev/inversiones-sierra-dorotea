/**
 * Seguridad local (PIN). En el futuro se sustituirá por autenticación real / backend.
 *
 * Este proyecto se sirve como scripts clásicos (sin bundler), por eso se expone:
 *   window.ISD.security = { DEFAULT_PIN, validatePin }
 *
 * Equivalente conceptual en ES modules (para cuando exista bundler):
 *   export const DEFAULT_PIN = "112233";
 *   export function validatePin(inputPin) { ... }
 */
(function () {
  "use strict";

  var DEFAULT_PIN = "112233";

  function validatePin(inputPin) {
    return String(inputPin || "") === DEFAULT_PIN;
  }

  window.ISD = window.ISD || {};
  window.ISD.security = {
    DEFAULT_PIN: DEFAULT_PIN,
    validatePin: validatePin,
  };
})();
