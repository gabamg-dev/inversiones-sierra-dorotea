/**
 * Firebase Admin (solo servidor). NO importar desde el frontend.
 */
const admin = require("firebase-admin");

function getPrivateKey() {
  const raw = process.env.FIREBASE_PRIVATE_KEY;
  if (!raw || typeof raw !== "string") return null;
  return raw.replace(/\\n/g, "\n");
}

function initIfNeeded() {
  if (admin.apps.length) return;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = getPrivateKey();

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Configura FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL y FIREBASE_PRIVATE_KEY en el entorno del servidor (Vercel)."
    );
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

function getAdminDb() {
  initIfNeeded();
  return admin.firestore();
}

function getAdminAuth() {
  initIfNeeded();
  return admin.auth();
}

module.exports = {
  admin,
  initIfNeeded,
  get adminDb() {
    return getAdminDb();
  },
  get adminAuth() {
    return getAdminAuth();
  },
};
