## 11 - Flujo Git → GitHub → Vercel + Supabase (ETAPA 6A)

### Objetivo
Definir un flujo simple y repetible para:
- versionar cambios con Git,
- publicar en GitHub,
- desplegar automáticamente en Vercel,
- conectar la app online a backend en nube.

---

## Actualización: backend elegido Firebase
El flujo **Git → GitHub → Vercel** no cambia:
- cada `git push` a `main` redeploya producción (y PR/branches pueden generar previews).

Lo que sí cambia es el backend:
- **Firebase Auth** (login)
- **Firestore** (datos)
- **Firebase Storage** (comprobantes)

Guía principal: `docs/13_FIREBASE_ONLINE_IMPLEMENTACION.md`.

> Nota sobre el nombre del archivo: este documento se creó cuando el plan inicial mencionaba Supabase. Se mantiene el nombre para no romper enlaces, pero el **backend actual** es Firebase.

Comandos típicos:

```bash
git status
git add .
git commit -m "Prepare Firebase backend foundation"
git push origin main
```

---

## Flujo local (Git)
### Inicializar Git por primera vez (si aparece “not a git repository”)
Si al ejecutar `git status` ves:
- `fatal: not a git repository (or any of the parent directories): .git`

Entonces debes inicializar el repositorio en la carpeta del proyecto:

```bash
cd "/Users/gabamg/Documents/Software contabilidad la sierra D/inversiones-sierra-dorotea"
git init
git status
```

Luego crea el primer commit:

```bash
git add .
git commit -m "Initial local version and Vercel Supabase migration plan"
```

Notas:
- **`.env.example` sí se sube** (plantilla vacía).
- **`.env` real nunca se sube** (debe quedar ignorado por `.gitignore`).

Comandos típicos:

```bash
git status
git add .
git commit -m "Prepare Vercel Supabase migration docs"
git push origin main
```

Recomendación:
- trabajar con commits pequeños y descriptivos.

---

## Flujo GitHub
- Crear un repositorio en GitHub (ej. `inversiones-sierra-dorotea`).
- Subir el código local a `main`.
- Opcional: usar ramas y Pull Requests para cambios grandes.

---

## Flujo Vercel (deploy)
### Conectar repo
- En Vercel: “New Project” → conectar repositorio de GitHub.

### Deploy automático
- Cada push a `main` despliega a **producción**.
- Cada Pull Request/branch puede generar un **Preview Deployment** (útil para revisar antes de merge).

### Variables de entorno
- Configurar Environment Variables en Vercel (ver `.env.example`).
- Regla de seguridad:
  - `NEXT_PUBLIC_*` puede ir al cliente
  - `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY` solo server-side

### Logs
En caso de fallas:
- revisar build logs en Vercel,
- validar que variables requeridas estén definidas.

---

## Flujo Supabase (conexión)
### Legado / alternativa
Si decides evaluar Supabase en el futuro, existe referencia histórica:
- `supabase/schema.sql`

La ejecución real (si aplica) sería en una fase separada. Hoy el camino principal es Firebase.

---

## Nota: barrera temporal de acceso (sitio estático)
Si estás desplegando la app como sitio estático (antes de Supabase Auth), se puede usar una barrera simple de acceso:
- módulo: `js/access-gate.js`
- clave por defecto: `112233`
- estado: se guarda en `sessionStorage` (`isd.access.ok = true`)

Importante:
- No es seguridad real.
- Se reemplaza en Fase 6C por **Supabase Auth + RLS**.

