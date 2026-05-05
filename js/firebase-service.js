// Servicio Firebase (Auth + Firestore) — compat API.
(function () {
  "use strict";

  const global = window;
  global.ISD = global.ISD || {};

  function getAuth() {
    return global.ISD && global.ISD.firebaseAuth ? global.ISD.firebaseAuth : null;
  }

  function getDb() {
    return global.ISD && global.ISD.firebaseDb ? global.ISD.firebaseDb : null;
  }

  function isAvailable() {
    return Boolean(
      typeof firebase !== "undefined" &&
        getAuth() &&
        getDb() &&
        global.ISD.firebaseApp
    );
  }

  function getCurrentUser() {
    const a = getAuth();
    return a ? a.currentUser : null;
  }

  function onAuthStateChanged(callback) {
    const a = getAuth();
    if (!a) return function () {};
    return a.onAuthStateChanged(callback);
  }

  function signIn(email, password) {
    const a = getAuth();
    if (!a) return Promise.reject(new Error("Auth no disponible."));
    return a.signInWithEmailAndPassword(String(email || ""), String(password || ""));
  }

  function signOut() {
    const a = getAuth();
    if (!a) return Promise.resolve();
    return a.signOut();
  }

  function getCurrentUserInfo() {
    const u = getCurrentUser();
    if (!u) return null;
    return {
      uid: u.uid,
      email: u.email || "",
      displayName: u.displayName || "",
    };
  }

  function toIsoMaybe(v) {
    if (v == null) return null;
    if (typeof v === "string") return v;
    if (typeof v.toDate === "function") {
      try {
        const d = v.toDate();
        return d instanceof Date && !isNaN(d.getTime()) ? d.toISOString() : null;
      } catch {
        return null;
      }
    }
    return null;
  }

  /**
   * Convierte un documento Firestore al formato de movimiento de la app.
   */
  function docToMovement(docSnap) {
    const d = docSnap.data() || {};
    const comprobante = d.comprobante;
    const createdIso = toIsoMaybe(d.createdAt);
    const updatedIso = toIsoMaybe(d.updatedAt);
    return {
      id: docSnap.id,
      fecha: d.fecha != null ? String(d.fecha) : "",
      tipo: d.tipo != null ? String(d.tipo) : "",
      reparto: d.reparto != null ? String(d.reparto) : "",
      categoria: d.categoria != null ? String(d.categoria) : "",
      subcategoria: d.subcategoria != null ? String(d.subcategoria) : "",
      descripcion: d.descripcion != null ? String(d.descripcion) : "",
      montoTotal: typeof d.montoTotal === "number" ? d.montoTotal : Number(d.montoTotal) || 0,
      aporteGabriel: typeof d.aporteGabriel === "number" ? d.aporteGabriel : Number(d.aporteGabriel) || 0,
      aporteVania: typeof d.aporteVania === "number" ? d.aporteVania : Number(d.aporteVania) || 0,
      reparto: d.reparto != null ? String(d.reparto) : "",
      cuentaMedioSalida: d.cuentaMedioSalida != null ? String(d.cuentaMedioSalida) : String(d.pagadoPor || ""),
      pagadoPor: d.pagadoPor != null ? String(d.pagadoPor) : String(d.cuentaMedioSalida || ""),
      origen: d.origen != null ? String(d.origen) : "",
      destino: d.destino != null ? String(d.destino) : "",
      metodoPago: d.metodoPago != null ? String(d.metodoPago) : "",
      estado: d.estado != null ? String(d.estado) : "",
      proveedor: d.proveedor != null ? String(d.proveedor) : "",
      numeroDocumento: d.numeroDocumento != null ? String(d.numeroDocumento) : "",
      notas: d.notas != null ? String(d.notas) : "",
      comprobante: comprobante && typeof comprobante === "object" ? comprobante : comprobante || null,
      createdBy: d.createdBy != null ? String(d.createdBy) : "",
      createdByEmail: d.createdByEmail != null ? String(d.createdByEmail) : "",
      createdAt: createdIso || d.createdAt,
      updatedAt: updatedIso || d.updatedAt,
      fechaCreacion: createdIso || String(d.fechaCreacion || ""),
      fechaModificacion: updatedIso || String(d.fechaModificacion || ""),
      editadoPor: d.editadoPor != null ? String(d.editadoPor) : "",
      fechaEdicion: d.fechaEdicion != null ? (typeof d.fechaEdicion === "string" ? d.fechaEdicion : toIsoMaybe(d.fechaEdicion)) : "",
    };
  }

  function docToAudit(docSnap) {
    const d = docSnap.data() || {};
    return {
      id: docSnap.id,
      actionType: d.actionType,
      movementId: d.movementId != null ? String(d.movementId) : "",
      user: d.user != null ? String(d.user) : "",
      summary: d.summary != null ? String(d.summary) : "",
      details: d.details && typeof d.details === "object" ? d.details : {},
      createdAt: toIsoMaybe(d.createdAt) || new Date().toISOString(),
    };
  }

  function stripUndefined(obj) {
    const out = {};
    Object.keys(obj).forEach((k) => {
      if (obj[k] !== undefined) out[k] = obj[k];
    });
    return out;
  }

  function checkProjectMembership(uid) {
    const db = getDb();
    if (!db || !uid) return Promise.resolve({ authorized: false, member: null });
    return db
      .collection("projectMembers")
      .doc(String(uid))
      .get()
      .then((snap) => {
        if (!snap.exists) return { authorized: false, member: null };
        const data = snap.data() || {};
        const active = data.active === true;
        if (!active) return { authorized: false, member: data };
        return { authorized: true, member: data };
      })
      .catch((err) => {
        console.error("checkProjectMembership:", err);
        return { authorized: false, member: null };
      });
  }

  function watchMovements(callback) {
    const db = getDb();
    if (!db) return function () {};
    return db
      .collection("movements")
      .orderBy("fecha", "desc")
      .onSnapshot(
        (snap) => {
          const list = snap.docs.map(docToMovement);
          callback(list);
        },
        (err) => {
          console.error("watchMovements:", err);
        }
      );
  }

  function buildCreatePayload(movement) {
    const m = movement || {};
    const u = getCurrentUser();
    if (!u) throw new Error("No hay sesión para crear el movimiento.");
    const FieldValue = firebase.firestore.FieldValue;
    return stripUndefined({
      fecha: m.fecha,
      tipo: m.tipo,
      reparto: m.reparto,
      categoria: m.categoria,
      subcategoria: m.subcategoria,
      descripcion: m.descripcion,
      montoTotal: m.montoTotal,
      aporteGabriel: m.aporteGabriel,
      aporteVania: m.aporteVania,
      cuentaMedioSalida: m.cuentaMedioSalida != null ? m.cuentaMedioSalida : m.pagadoPor,
      pagadoPor: m.pagadoPor,
      origen: m.origen,
      destino: m.destino,
      metodoPago: m.metodoPago,
      estado: m.estado,
      proveedor: m.proveedor,
      numeroDocumento: m.numeroDocumento,
      notas: m.notas,
      comprobante: m.comprobante != null ? m.comprobante : null,
      bancoOrigen: m.bancoOrigen,
      createdBy: u.uid,
      createdByEmail: u.email || "",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  function createMovement(movement) {
    const db = getDb();
    if (!db) return Promise.reject(new Error("No se pudo acceder a los datos del proyecto."));
    const payload = buildCreatePayload(movement);
    return db
      .collection("movements")
      .add(payload)
      .then((ref) => ref.id);
  }

  function sanitizeMovementUpdate(data) {
    const o = { ...(data || {}) };
    delete o.id;
    delete o.createdAt;
    delete o.createdBy;
    delete o.createdByEmail;
    delete o.fechaCreacion;
    delete o.fechaModificacion;
    return o;
  }

  function updateMovement(id, data) {
    const db = getDb();
    if (!db) return Promise.reject(new Error("No se pudo acceder a los datos del proyecto."));
    const u = getCurrentUser();
    const FieldValue = firebase.firestore.FieldValue;
    const userLabel = u && u.email ? u.email : u && u.uid ? u.uid : "Usuario";
    const base = sanitizeMovementUpdate(data);
    const extra = {
      updatedAt: FieldValue.serverTimestamp(),
      editadoPor: base.editadoPor != null ? base.editadoPor : userLabel,
      fechaEdicion: base.fechaEdicion || new Date().toISOString(),
    };
    const merged = stripUndefined({ ...base, ...extra });
    delete merged.id;
    return db.collection("movements").doc(String(id)).update(merged);
  }

  function deleteMovement(id) {
    const db = getDb();
    if (!db) return Promise.reject(new Error("No se pudo acceder a los datos del proyecto."));
    return db.collection("movements").doc(String(id)).delete();
  }

  function createAuditLog(log) {
    const db = getDb();
    if (!db) return Promise.reject(new Error("No se pudo acceder a los datos del proyecto."));
    const u = getCurrentUser();
    const FieldValue = firebase.firestore.FieldValue;
    const entry = stripUndefined({
      actionType: log && log.actionType,
      movementId: log && log.movementId != null ? String(log.movementId) : "",
      user: (log && log.user) || (u && u.email) || (u && u.uid) || "",
      uid: u && u.uid ? u.uid : "",
      summary: log && log.summary,
      details: (log && log.details) || {},
      createdAt: FieldValue.serverTimestamp(),
    });
    return db.collection("auditLogs").add(entry);
  }

  function getIdToken(forceRefresh) {
    const u = getCurrentUser();
    if (!u || typeof u.getIdToken !== "function") {
      return Promise.reject(new Error("No hay usuario autenticado."));
    }
    return u.getIdToken(Boolean(forceRefresh));
  }

  function watchAuditLogs(callback) {
    const db = getDb();
    if (!db) return function () {};
    return db
      .collection("auditLogs")
      .orderBy("createdAt", "desc")
      .limit(20)
      .onSnapshot(
        (snap) => {
          callback(snap.docs.map(docToAudit));
        },
        (err) => {
          console.error("watchAuditLogs:", err);
        }
      );
  }

  global.ISD.firebaseService = {
    isAvailable,
    getCurrentUser,
    getIdToken,
    onAuthStateChanged,
    signIn,
    signOut,
    getCurrentUserInfo,
    checkProjectMembership,
    watchMovements,
    createMovement,
    updateMovement,
    deleteMovement,
    watchAuditLogs,
    createAuditLog,
  };
})();
