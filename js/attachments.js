// Contratos de adjuntos/comprobantes (ETAPA 3).
// Importante: en la versión local, el archivo real NO va en localStorage, va en IndexedDB.
// Script clásico para compatibilidad file:// en macOS.
(function () {
  "use strict";

  const global = window;
  global.ISD = global.ISD || {};

  const ATTACHMENTS_DB_NAME = "isd_attachments_db";
  const ATTACHMENTS_STORE_NAME = "attachments";

  const MAX_ATTACHMENT_SIZE_MB = 15;

  const ALLOWED_ATTACHMENT_EXTENSIONS = [".pdf", ".png", ".jpg", ".jpeg", ".webp"];
  const ALLOWED_ATTACHMENT_MIME_TYPES = [
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/webp",
  ];

  function nowIso() {
    return new Date().toISOString();
  }

  function generateAttachmentId() {
    return `att_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
  }

  function formatFileSize(bytes) {
    const b = Number(bytes) || 0;
    if (b < 1024) return `${b} B`;
    const kb = b / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(1)} MB`;
  }

  function getExtension(name) {
    const n = String(name || "").toLowerCase();
    const i = n.lastIndexOf(".");
    return i >= 0 ? n.slice(i) : "";
  }

  function isAllowedAttachment(file) {
    if (!file) return false;
    const ext = getExtension(file.name);
    const mime = String(file.type || "");
    const okExt = ALLOWED_ATTACHMENT_EXTENSIONS.includes(ext);
    const okMime = ALLOWED_ATTACHMENT_MIME_TYPES.includes(mime);
    return okExt && okMime;
  }

  function validateAttachment(file) {
    if (!file) return { ok: true };
    if (!isAllowedAttachment(file)) {
      return { ok: false, error: "Formato de comprobante no permitido. Usa PDF, JPG, PNG o WEBP." };
    }
    const maxBytes = MAX_ATTACHMENT_SIZE_MB * 1024 * 1024;
    if (file.size > maxBytes) {
      return { ok: false, error: `El comprobante supera el tamaño máximo permitido de ${MAX_ATTACHMENT_SIZE_MB} MB.` };
    }
    return { ok: true };
  }

  function openAttachmentsDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(ATTACHMENTS_DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(ATTACHMENTS_STORE_NAME)) {
          db.createObjectStore(ATTACHMENTS_STORE_NAME, { keyPath: "id" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function saveAttachment(file) {
    const v = validateAttachment(file);
    if (!v.ok) throw new Error(v.error);
    if (!file) return null;

    const id = generateAttachmentId();
    const createdAt = nowIso();
    const record = {
      id,
      blob: file,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      createdAt,
    };

    const db = await openAttachmentsDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(ATTACHMENTS_STORE_NAME, "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.objectStore(ATTACHMENTS_STORE_NAME).put(record);
    });
    db.close();

    return {
      id,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      createdAt,
      storage: {
        mode: "local-indexeddb",
        dbName: ATTACHMENTS_DB_NAME,
        storeName: ATTACHMENTS_STORE_NAME,
      },
    };
  }

  async function getAttachment(id) {
    const key = String(id || "").trim();
    if (!key) return null;
    const db = await openAttachmentsDB();
    const rec = await new Promise((resolve, reject) => {
      const tx = db.transaction(ATTACHMENTS_STORE_NAME, "readonly");
      tx.onerror = () => reject(tx.error);
      const req = tx.objectStore(ATTACHMENTS_STORE_NAME).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return rec ? rec.blob : null;
  }

  async function deleteAttachment(id) {
    const key = String(id || "").trim();
    if (!key) return false;
    const db = await openAttachmentsDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(ATTACHMENTS_STORE_NAME, "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.objectStore(ATTACHMENTS_STORE_NAME).delete(key);
    });
    db.close();
    return true;
  }

  global.ISD.attachments = {
    ATTACHMENTS_DB_NAME,
    ATTACHMENTS_STORE_NAME,
    MAX_ATTACHMENT_SIZE_MB,
    ALLOWED_ATTACHMENT_EXTENSIONS,
    ALLOWED_ATTACHMENT_MIME_TYPES,
    openAttachmentsDB,
    saveAttachment,
    getAttachment,
    deleteAttachment,
    validateAttachment,
    isAllowedAttachment,
    formatFileSize,
  };
})();

