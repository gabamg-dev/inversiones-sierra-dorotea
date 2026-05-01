-- Inversiones Sierra Dorotea (ETAPA 6A)
-- Propuesta inicial de esquema para Supabase Postgres (no ejecutada aún).
-- Objetivo: migrar desde localStorage/IndexedDB a Auth + Postgres + Storage privado.

-- Recomendación de extensiones comunes (opcional):
-- create extension if not exists "pgcrypto";

-- =========================================================
-- 1) profiles
-- =========================================================
-- Perfil de usuario asociado a auth.users.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  role text default 'partner',
  created_at timestamptz not null default now()
);

comment on table public.profiles is 'Perfil extendido para usuarios Supabase Auth (Gabriel/Vania).';

-- =========================================================
-- 2) movements
-- =========================================================
create table if not exists public.movements (
  id uuid primary key,
  user_id uuid references auth.users (id),

  fecha date not null,
  tipo text not null, -- 'gasto' | 'ingreso' | 'ajuste'
  categoria text not null,
  subcategoria text not null,

  descripcion text,
  monto_total numeric not null default 0,
  aporte_gabriel numeric not null default 0,
  aporte_vania numeric not null default 0,
  reparto text not null, -- 'gabriel' | 'vania' | 'ambos' (o reglas futuras)

  cuenta_medio_salida text,
  origen text,
  destino text,

  metodo_pago text,
  estado text,

  proveedor text,
  numero_documento text,
  notas text,

  -- Metadata de comprobante (en nube el archivo vive en Storage)
  comprobante jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  editado_por uuid references auth.users (id),
  fecha_edicion timestamptz
);

comment on table public.movements is 'Movimientos del proyecto (gastos/ingresos/ajustes).';
comment on column public.movements.comprobante is 'Metadata del comprobante (no contiene el archivo).';

-- Índices sugeridos
create index if not exists movements_fecha_idx on public.movements (fecha);
create index if not exists movements_tipo_idx on public.movements (tipo);
create index if not exists movements_categoria_idx on public.movements (categoria);

-- =========================================================
-- 3) audit_logs
-- =========================================================
create table if not exists public.audit_logs (
  id uuid primary key,
  movement_id uuid null references public.movements (id) on delete set null,
  action_type text not null, -- CREATE | UPDATE | DELETE
  user_id uuid references auth.users (id),
  summary text,
  details jsonb,
  created_at timestamptz not null default now()
);

comment on table public.audit_logs is 'Auditoría server-side (fuente de verdad en online).';

create index if not exists audit_logs_created_at_idx on public.audit_logs (created_at);
create index if not exists audit_logs_movement_id_idx on public.audit_logs (movement_id);

-- =========================================================
-- 4) attachment_metadata
-- =========================================================
create table if not exists public.attachment_metadata (
  id uuid primary key,
  movement_id uuid references public.movements (id) on delete cascade,
  file_name text not null,
  file_type text,
  file_size bigint,
  storage_bucket text not null default 'comprobantes',
  storage_path text not null,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

comment on table public.attachment_metadata is 'Metadata de adjuntos almacenados en Supabase Storage (bucket privado).';

create index if not exists attachment_metadata_movement_id_idx on public.attachment_metadata (movement_id);

-- =========================================================
-- RLS (Row Level Security) - FUTURO (referencia / checklist)
-- =========================================================
-- Nota: estas políticas no están finalizadas. Se dejan como guía para ETAPA 6C+.
--
-- alter table public.profiles enable row level security;
-- alter table public.movements enable row level security;
-- alter table public.audit_logs enable row level security;
-- alter table public.attachment_metadata enable row level security;
--
-- Ejemplos (conceptuales):
-- - Permitir leer perfiles propios:
--   create policy "profiles_read_own" on public.profiles
--     for select to authenticated
--     using (id = auth.uid());
--
-- - Permitir CRUD movimientos a usuarios autenticados autorizados:
--   create policy "movements_read" on public.movements
--     for select to authenticated
--     using (true);
--   create policy "movements_write" on public.movements
--     for insert to authenticated
--     with check (user_id = auth.uid());
--   create policy "movements_update" on public.movements
--     for update to authenticated
--     using (user_id = auth.uid())
--     with check (user_id = auth.uid());
--
-- - Auditoría: lectura para socios; escritura solo server-side (service role / RPC):
--   create policy "audit_read" on public.audit_logs
--     for select to authenticated
--     using (true);
--
-- - attachment_metadata: lectura/escritura asociada a movimientos permitidos:
--   create policy "attachments_read" on public.attachment_metadata
--     for select to authenticated
--     using (true);
--
-- Storage (bucket privado):
-- - Acceso a archivos mediante Signed URLs o descarga server-side.
-- - Evitar URLs públicas para comprobantes.

