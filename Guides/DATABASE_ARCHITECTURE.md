# Arquitectura de Bases de Datos — GADO

## Resumen

| Base de datos | Tecnología | Para qué |
|---|---|---|
| **SQL** | Cloud SQL (PostgreSQL 15 + PostGIS) | Datos operacionales, usuarios, lugares, reportes |
| **Firestore** | GCP Firestore (Native) | Tiempo real / WebSockets / Streaming |
| **BigQuery** | GCP BigQuery | Analítica histórica y dashboard directivo |

Todas en el mismo proyecto GCP (`europe-west1`), gestionadas con Terraform.

---

## 1. Cloud SQL — PostgreSQL 15 + PostGIS

**Instancia:** `gado-postgres` (db-f1-micro, europe-west1)

Datos estructurados con relaciones, geoespaciales y transaccionales. El backend (FastAPI) accede vía `asyncpg`.

### Tablas

| Tabla | Descripción |
|---|---|
| `profiles` | Perfiles de usuario vinculados a Firebase Auth por `firebase_uid` |
| `categories` | Categorías de lugares (food, nightlife, health…) con metadatos de búsqueda, subcategorías y moods |
| `places` | Lugares con coordenadas PostGIS, rating, precio, fuente (Google/OSM/manual) |
| `events` | Eventos locales con fechas, ubicación y estado |
| `report_types` | Tipos de reporte dinámicos (tráfico, accidente, música en vivo…) |
| `community_reports` | Reportes ciudadanos con expiración y sistema de confianza (confirmaciones/denials) |
| `report_confirmations` | Votos de confirmación/denegación de reportes con deduplicación por `actor_key` |
| `item_votes` | Votos útil/no útil en lugares y eventos |
| `saved_items` | Favoritos/bookmarks del usuario |
| `user_preferences` | Preferencias de mapa, idioma, radio, categorías favoritas |
| `search_history` | Historial de búsquedas para personalización futura |
| `push_tokens` | Tokens de notificaciones push por dispositivo |

### Funciones y triggers

| Función | Qué hace |
|---|---|
| `update_places_search_vector()` | Mantiene el índice full-text de lugares actualizado automáticamente |
| `update_report_confidence()` | Recalcula el score de confianza de un reporte cuando alguien vota |

### Migraciones aplicadas

| Archivo | Descripción |
|---|---|
| `005_cloud_sql_clean_schema.sql` | Schema completo limpio para Cloud SQL (sin dependencias de Supabase) |

---

## 2. Firestore — Tiempo Real y WebSockets

**Base de datos:** `(default)` (FIRESTORE_NATIVE, europe-west1)
**Acceso desde frontend:** Firebase JS SDK con listeners en tiempo real
**Acceso desde backend:** Firebase Admin SDK

Firestore es la capa de **tiempo real** de GADO. El frontend React Native abre listeners persistentes (WebSockets internos de Firebase) que reciben actualizaciones instantáneas sin polling.

### Colecciones y su uso

| Colección | Descripción | Por qué Firestore |
|---|---|---|
| `active_reports/{report_id}` | Reportes activos con confirmaciones en vivo | El mapa actualiza el contador de votos en tiempo real sin recargar |
| `report_confirmations_live/{report_id}` | Contador de confirmaciones/denials en directo | El frontend escucha cambios y anima el contador |
| `brain_jobs/{job_id}` | Estado de jobs de recomendación IA en curso | El frontend hace streaming del progreso mientras Gemini procesa |
| `map_sessions/{session_id}` | Sesión de mapa activa (posición, filtros) | Sincronizar estado del mapa entre dispositivos del mismo usuario |
| `notifications/{user_id}/queue` | Cola de notificaciones in-app en tiempo real | Push in-app sin polling |
| `user_presence/{user_id}` | Estado online/offline del usuario | Para features sociales futuras |

### TTL automático (configurado en Terraform)

| Colección | Campo TTL | Expiración |
|---|---|---|
| `active_reports` | `expires_at` | Cuando el reporte expira (igual que en Cloud SQL) |
| `brain_jobs` | `expires_at` | 1 hora tras creación |

### Flujo de sincronización SQL ↔ Firestore

Cuando un reporte se crea o recibe un voto en Cloud SQL, el backend escribe también en Firestore para que el frontend reciba el update instantáneamente:

```
Usuario vota reporte
       │
  Backend FastAPI
       │
  ┌────┴────────────────┐
  │                     │
  ▼                     ▼
Cloud SQL            Firestore
(fuente de verdad)   (tiempo real)
                         │
                         ▼
                   Frontend React Native
                   (listener WebSocket)
```

---

## 3. BigQuery — Analítica Histórica

**Datasets:** `gado_analytics` y `gado_snapshots` (europe-west1)
**Escritura:** el backend emite eventos vía BigQuery Streaming API en background tasks (sin bloquear las respuestas)
**Lectura:** dashboards directivos, análisis de uso, entrenamiento de modelos futuros

BigQuery almacena eventos **inmutables** particionados por día. No se consulta desde la app en tiempo real.

### Dataset: `gado_analytics` — Eventos de uso

| Tabla | Descripción | Partición |
|---|---|---|
| `search_events` | Cada búsqueda: query, categoría, lat/lng, nº resultados, tiempo de respuesta, si usó brain | Por día (`created_at`) |
| `recommendation_events` | Cada recomendación: categoría, mood, lugares sugeridos, modelo Gemini usado, latencia | Por día |
| `report_lifecycle` | Ciclo de vida de reportes: creación, confirmaciones, expiración, confianza final | Por día |
| `vote_events` | Todos los votos en lugares y reportes con contexto de categoría | Por día |
| `brain_usage` | Uso del LLM: query, tokens entrada/salida, latencia, proveedor (Gemini/Groq), endpoint | Por día |

### Dataset: `gado_snapshots` — Dashboard directivo

| Tabla | Descripción | Frecuencia |
|---|---|---|
| `daily_kpis` | DAU, búsquedas/día, recomendaciones, reportes activos, latencia media, llamadas a Gemini | Diaria |
| `category_popularity` | Ranking de categorías por búsquedas y recomendaciones por semana | Semanal |

---

## Flujo completo de datos

```
Usuario hace acción en el frontend
              │
              ▼
    Frontend React Native (Cloud Run: gado-frontend)
    - Expo web servido por nginx
    - Firebase JS SDK para auth y Firestore listeners
              │
              ▼
    Backend FastAPI (Cloud Run: restaurant-api)
    - asyncpg → Cloud SQL (lectura/escritura operacional)
    - Firebase Admin SDK → Firestore (actualizaciones tiempo real)
    - Google Places API → búsqueda de lugares
    - Gemini API → recomendaciones + brain
    - BigQuery Streaming API → eventos de analítica (background)
              │
    ┌─────────┼──────────────┐
    ▼         ▼              ▼
Cloud SQL  Firestore      BigQuery
(verdad)   (tiempo real)  (analítica)
```
