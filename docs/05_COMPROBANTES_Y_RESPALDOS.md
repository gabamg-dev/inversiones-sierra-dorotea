## 05 - Comprobantes y respaldos

### Comprobantes (ETAPA 3)
Se permitirá asociar un comprobante (imagen/PDF) a un movimiento.

### Problema que resuelve
Los comprobantes permiten **trazabilidad** y respaldo de gastos/ingresos (boletas, facturas, transferencias, etc.), evitando que el movimiento quede “sin evidencia”.

### Decisión técnica (versión local) — implementado (ETAPA 3B)
En la versión local, **NO** se guardarán archivos completos (PDF/imagen) dentro de `localStorage` ni como Base64 dentro del movimiento.

**Razones:**
- `localStorage` tiene límite bajo (típicamente ~5MB por origen) y se llena rápido.
- Base64 aumenta el tamaño del archivo (~33%+) y puede degradar rendimiento.
- Guardar blobs grandes en `localStorage` puede volver la app lenta/inestable.

**Estrategia local aprobada:**
- **`localStorage`**: guarda **movimientos** + **metadata** del comprobante.
- **`IndexedDB`**: guarda el **archivo real** como `Blob`/`File`, indexado por `comprobante.id`.

### Operaciones soportadas (ETAPA 3B)
- Crear movimiento con comprobante (opcional).
- Ver comprobante desde la tabla (botón **Ver**).
- Editar movimiento:
  - mantener comprobante si no se toca
  - reemplazar (subir nuevo) y borrar el anterior
  - eliminar comprobante (borrar de IndexedDB y dejar `comprobante=null`)
- Eliminar movimiento:
  - si tiene comprobante, se elimina también el archivo en IndexedDB (evita huérfanos).

### Modelo local de comprobante (metadata en el movimiento)
Campo en movimiento:
- `comprobante: null` o
- `comprobante: { ...metadata... }`

Estructura objetivo:
```json
{
  "id": "att_...",
  "fileName": "nombre-del-archivo.pdf",
  "fileType": "application/pdf",
  "fileSize": 248000,
  "createdAt": "2026-05-01T15:30:00.000Z",
  "storage": {
    "mode": "local-indexeddb",
    "dbName": "isd_attachments_db",
    "storeName": "attachments"
  }
}
```

El archivo real se guarda en IndexedDB con clave = `comprobante.id`.

### Eliminación de comprobantes (local)
Eliminar un comprobante implica:
- quitar `movement.comprobante` (metadata) del movimiento
- borrar el blob en IndexedDB (por `comprobante.id`)
- registrar auditoría (en etapa posterior cuando se integre UI de comprobantes)

### Backups e importación (ETAPA 5)
**Regla clave:** un backup JSON (movimientos) **puede incluir metadata**, pero **no** incluye el archivo real almacenado en IndexedDB.

Al importar un backup:
- se restauran movimientos y metadata
- pero los comprobantes reales deberán re-adjuntarse o importarse por un mecanismo adicional (se definirá en ETAPA 5/ETAPA 3B)

### Limitaciones de la versión local
- Los blobs en IndexedDB dependen del navegador/perfil del usuario.
- Un “reset del navegador” puede borrar IndexedDB.
- Copiar el proyecto a otro computador no incluye adjuntos automáticamente.
- Los comprobantes **no quedan en una carpeta visible del Mac**: viven en el almacenamiento del navegador (IndexedDB).
- No se sincronizan entre navegadores ni dispositivos.
- Borrar “datos del sitio” o usar modo privado puede impedir persistencia o eliminar adjuntos.

### Estrategia futura (versión online / nube)
En versión online:
- metadata del comprobante se mantiene en el movimiento
- el archivo real se guarda en Storage remoto (ej. Supabase Storage)

Modelo sugerido:
```json
{
  "id": "att_...",
  "fileName": "nombre-del-archivo.pdf",
  "fileType": "application/pdf",
  "fileSize": 248000,
  "createdAt": "2026-05-01T15:30:00.000Z",
  "storage": {
    "mode": "cloud",
    "provider": "supabase-storage",
    "bucket": "comprobantes",
    "path": "movements/mov_123/comprobante.pdf",
    "publicUrl": null,
    "signedUrlAvailable": true
  }
}
```

### Respaldos (ETAPA 5)
- Exportación de movimientos a JSON descargable.
- Importación desde JSON con:
  - validación de esquema mínimo,
  - deduplicación por `id`,
  - reporte de errores de importación.
- Carpeta `data/` reservada para respaldos manuales del proyecto.

