## 13 - Firebase online (Auth + Firestore) — implementación actual

### Qué incluye esta fase
- **Firebase Authentication** (email/contraseña) desde la propia app.
- Verificación de **miembro del proyecto** en Firestore: `projectMembers/{uid}` con `active: true`.
- **Movimientos** en la colección `movements` (CRUD en tiempo real con `onSnapshot`).
- **Auditoría** en `auditLogs` (escritura en cada CREATE/UPDATE/DELETE; lectura de las últimas 20 entradas con listener).
- **Comprobantes**: no migrados; el archivo sigue en **IndexedDB** del navegador. Un movimiento en Firestore puede llevar metadata de comprobante `null` o el objeto local si se adjuntó en ese dispositivo.
- **No** se usa Analytics. **No** se suben comprobantes a **Firebase Storage** todavía.

### SDK
- **Firebase JS compat 10.12.5** vía CDN: `firebase-app-compat`, `firebase-auth-compat`, `firebase-firestore-compat`, `firebase-storage-compat` (Storage inicializado para fases futuras; comprobantes aún no).
- Inicialización: `js/firebase-config.js` → `window.ISD.firebaseApp`, `firebaseAuth`, `firebaseDb`, `firebaseStorage`.
- API de app: `window.ISD.firebaseService` en `js/firebase-service.js`.

### Configuración Web (pública)
Los valores `apiKey`, `projectId`, etc. están en `firebase-config.js`. Son **públicos por diseño** en apps web; la seguridad viene de **Firestore Rules** y **Authentication**. No incluir claves de servicio ni API keys de OpenAI en el frontend.

### Cómo iniciar sesión
1. Abre la app (local o Vercel).
2. Paso opcional/fijo según uso: **clave de acceso** `112233` (`access-gate`) si la sesión está bloqueada.
3. En **“Cuenta Firebase”**, introduce email y contraseña del usuario creado en Firebase Authentication.
4. Si el usuario tiene documento `projectMembers/{UID}` con `active: true`, el modo pasa a **Firestore** y se cargan movimientos desde la nube.

### Cómo encontrar el UID
- Tras iniciar sesión, la UI muestra **UID (debug)** en el panel Firebase.
- En Firebase Console → **Authentication** → usuario → columna **User UID**.

### Crear `projectMembers/{uid}`
En Firestore, colección `projectMembers`, documento ID = **exactamente** el UID del usuario (Auth).

Campos recomendados (ejemplo):
- `displayName`: `"Gabriel"`
- `email`: mismo email que en Auth
- `role`: `"admin"` (u otro; las reglas actuales validan sobre todo `active`)
- `active`: `true`

Si `active` no es `true` o el documento no existe, la app muestra **“Tu usuario no está autorizado…”** y oculta el contenido del proyecto (no se muestran datos online).

### Reglas Firestore
Archivo: `firebase/firestore.rules`. Debes **desplegarlas** en Firebase Console (o CLI) para que coincidan con el repo.

Puntos clave:
- Cada usuario puede **leer su propio** `projectMembers/{uid}` (evita dependencia circular al comprobar membresía).
- `movements` y `auditLogs`: lectura/escritura solo si el usuario es miembro activo (`isProjectMember()`).

### Datos online vs local

| Dato | Online (Firebase) | Local |
|------|-------------------|--------|
| Movimientos | Colección `movements` | `localStorage` (`ISD.storage`) |
| Auditoría vista en modal | Colección `auditLogs` | `localStorage` (`ISD.audit`) |
| Comprobantes (archivo) | Pendiente (Storage) | IndexedDB |

**Fallback:** si no hay sesión o no hay membresía, `dataMode` es `"local"` y la app usa los movimientos guardados en `localStorage` (no se borran automáticamente).

### Cómo probar en PC y celular
1. Despliega en Vercel (o sirve HTTPS local con tunnel si hace falta; Firebase Auth suele preferir orígenes consistentes).
2. En ambos dispositivos, misma URL y **mismo usuario** Firebase.
3. Crea un movimiento en uno; debe aparecer en el otro tras sincronización (listener).
4. Comprueba que **comprobantes** adjuntos en un dispositivo **no** abren en el otro si el archivo no existe en su IndexedDB (esperado hasta Storage).

### Exportar Excel y asistente IA
Con sesión Firebase válida, ambos usan **`currentMovements`** cargados desde Firestore (y auditoría remota en Excel cuando aplica).

### Qué hacer si aparece “usuario no autorizado”
1. Confirma el **UID** mostrado con el ID del documento en `projectMembers`.
2. Verifica `active: true`.
3. Vuelve a publicar reglas si cambiaron.
4. Cierra sesión y vuelve a entrar.

### Pendiente (siguiente fase)
- Subir comprobantes a **Firebase Storage** y sincronizar metadata entre dispositivos.
- Endurecer reglas (roles admin, sin auto-bootstrap de miembros si ya no aplica).
