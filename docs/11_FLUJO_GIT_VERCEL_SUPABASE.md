## 11 - Flujo Git → GitHub → Vercel + Supabase (ETAPA 6A)

### Objetivo
Definir un flujo simple y repetible para:
- versionar cambios con Git,
- publicar en GitHub,
- desplegar automáticamente en Vercel,
- conectar la app online a Supabase (Auth, Postgres, Storage).

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
En ETAPA 6A **solo se define** el diseño:
- esquema inicial: `supabase/schema.sql`
- bucket privado propuesto: `comprobantes`

La ejecución real (crear proyecto, aplicar SQL, RLS, buckets y políticas) se hace en fases posteriores.

