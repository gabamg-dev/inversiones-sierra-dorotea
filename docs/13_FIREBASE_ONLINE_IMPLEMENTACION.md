## 13 - Implementación online con Firebase (Auth + Firestore + Storage)

### Objetivo
Preparar la migración desde la app **local-first** (HTML estático + `localStorage` + IndexedDB) hacia una versión online con:
- **Vercel** (hosting/deploy desde GitHub)
- **Firebase Auth** (Gabriel/Vania)
- **Cloud Firestore** (movimientos + auditoría + metadata)
- **Firebase Storage** (comprobantes en nube)

Esta guía es **ETAPA de preparación**: reglas, modelo de datos, variables y checklist. **No** implementa aún login UI ni CRUD online.

---

## Decisiones actuales
- **Backend elegido**: Firebase (capa gratuita razonable para arrancar).
- **Supabase**: queda como **alternativa/legado documental** (`supabase/schema.sql` puede conservarse como referencia histórica).
- **Analytics**: **no** se usa por ahora (no llamar `getAnalytics()`).

---

## 1) Crear proyecto Firebase
1. Ir a Firebase Console.
2. Crear proyecto (ej. `inversiones-sierra-dorotea`).
3. Habilitar Google Cloud recursos según el asistente (si aplica).

---

## 2) Crear Web App (solo para obtener `firebaseConfig`)
1. Project settings → Your apps → Web.
2. Registrar app web.
3. Copiar el objeto `firebaseConfig` (API key, projectId, etc.).

**Importante**
- Estos valores son “públicos” en el sentido de que terminan en el cliente, pero **no deben hardcodearse** en el repo.
- Deben vivir en:
  - `.env.local` (desarrollo local, **no** versionado)
  - Variables de entorno en **Vercel** (producción/preview)

---

## 3) Variables de entorno (plantilla)
Ver `.env.example` (versionado) y crea localmente `.env.local` (ignorado) con tus valores reales.

**No subas `.env.local` al repo.**

---

## 4) Authentication (Email/Password)
1. Firebase Console → Authentication → Sign-in method.
2. Habilitar **Email/Password**.
3. Crear usuarios:
   - Gabriel
   - Vania

Recomendación:
- usar emails dedicados del proyecto (no personales si no quieres mezclar cuentas).

---

## 5) Firestore (Production mode + reglas)
1. Firestore Database → Create database → **Production mode** (luego aplicar reglas del repo).
2. Aplicar reglas desde `firebase/firestore.rules`.

Modelo propuesto (colecciones):
- `projectMembers/{uid}`
- `users/{uid}`
- `movements/{movementId}`
- `auditLogs/{logId}`
- `attachments/{attachmentId}`

### Alta inicial de miembros (`projectMembers`)
Para que las reglas permitan acceso, cada usuario debe tener:
- `projectMembers/{uid}.active == true`

**Bootstrap inicial (recomendado en consola, una sola vez):**
- crear manualmente `projectMembers/{uid}` para Gabriel y Vania con `active: true`.

> Nota: las reglas actuales restringen escritura de `projectMembers` al propio `uid` y requieren ser miembro activo (esto puede requerir un “primer paso” en consola/Admin). Ajuste fino en fases posteriores con Cloud Functions.

---

## 6) Storage (privado + reglas)
1. Firebase Console → Storage → Get started.
2. Aplicar reglas desde `firebase/storage.rules`.

Estructura sugerida:
- `comprobantes/{movementId}/{fileName}`

Acceso:
- solo usuarios autenticados **y** miembros activos (`projectMembers`).

---

## 7) SDK Firebase (próxima fase)
Para HTML estático actual: **no** se bundlea SDK en esta tarea.

Cuando se implemente:
- usar módulos `firebase/app`, `firebase/auth`, `firebase/firestore`, `firebase/storage`
- **no** inicializar Analytics

En Next.js (futuro):
- mover configuración a `lib/firebase/*` y leer `process.env.NEXT_PUBLIC_FIREBASE_*`.

Archivos placeholder (no rompen la app):
- `js/firebase-config.js`
- `js/firebase-service.js`

---

## 8) Cómo validar que Gabriel y Vania ven lo mismo
1. Login con ambos usuarios (cuando exista UI).
2. Crear un movimiento con uno.
3. Verificar lectura con el otro (misma colección `movements`).

---

## 9) Límites del plan gratuito (orientativo)
Los límites cambian; revisar documentación oficial de Firebase:
- cuotas de Firestore (lecturas/escrituras)
- cuotas de Storage (almacenamiento y descargas)
- límites de Auth

---

## 10) Pendientes (próximas fases)
- Login UI con Firebase Auth
- CRUD Firestore (movimientos) + índices si aplica
- Subida/descarga Storage + metadata `attachments`
- Auditoría online (ideal: server-side)
- Migración desde `localStorage`/IndexedDB
- ChatGPT/OpenAI vía endpoint server-side (sin API keys en frontend)

---

## Referencia local `.env.local` (crear en tu Mac; NO commitear)
Copia estos valores desde Firebase Console (Web App config). Ejemplo de forma (rellena tú los valores reales):

```
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=...

SITE_ACCESS_PASSWORD=112233

AI_PROVIDER=openai
AI_MODEL=
OPENAI_API_KEY=
GEMINI_API_KEY=
```
