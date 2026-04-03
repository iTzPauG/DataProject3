# Arquitectura de Bases de Datos — GADO

## Resumen

| Base de datos | Tecnología | Para qué |
|---|---|---|
| **SQL** | Supabase (PostgreSQL + PostGIS) | Datos operacionales, auth, geoespacial |
| **Firestore** | GCP Firestore | Tiempo real / WebSockets |
| **BigQuery** | GCP BigQuery | Analítica histórica y dashboard directivo |

---

## 1. SQL — Supabase (PostgreSQL + PostGIS)

Datos estructurados con relaciones, geoespaciales y que requieren RLS (Row Level Security) de Supabase.

### Tablas

| Tabla | Descripción |
|---|---|
| `profiles` | Perfiles de usuario (vinculados a Supabase Auth) |
| `categories` | Categorías de lugares (food, nightlife, health…) con metadatos de búsqueda |
| `category_subcategories` | Subcategorías por categoría (pizza, sushi, gym…) |
| `category_moods` | Moods/intenciones por categoría (cita, relajante, urgente…) |
| `places` | Lugares con coordenadas PostGIS, rating, precio, fuente (Google/OSM/manual) |
| `events` | Eventos locales con fechas, ubicación y estado |
| `report_types` | Tipos de reporte dinámicos (tráfico, accidente, música en vivo…) |
| `community_reports` | Reportes ciudadanos con expiración y sistema de confianza |
| `report_confirmations` | Votos de confirmación/denegación de reportes |
| `item_votes` | Votos útil/no útil en lugares y eventos |
| `saved_items` | Favoritos/bookmarks del usuario |
| `user_preferences` | Preferencias de mapa, idioma, radio, categorías favoritas |
| `search_history` | Historial de búsquedas (para personalización futura) |
| `push_tokens` | Tokens de notificaciones push por dispositivo |

---

## 2. Firestore — Tiempo Real / WebSockets

Datos que cambian frecuentemente y necesitan sincronización en tiempo real con el frontend (React Native). Firestore permite listeners en tiempo real sin polling.

### Colecciones

| Colección | Descripción | Por qué Firestore |
|---|---|---|
| `active_reports/{report_id}` | Reportes activos con confirmaciones en vivo | Los votos se actualizan en tiempo real en el mapa |
| `report_confirmations_live/{report_id}` | Contador de confirmaciones/denials en directo | El frontend necesita ver el contador cambiar sin recargar |
| `user_presence/{user_id}` | Estado online/offline del usuario | Necesario para features sociales futuras |
| `map_sessions/{session_id}` | Sesión de mapa activa (posición, filtros activos) | Sincronizar estado del mapa entre dispositivos |
| `notifications/{user_id}/queue` | Cola de notificaciones en tiempo real | Push in-app sin polling |
| `brain_jobs/{job_id}` | Estado de jobs de recomendación IA en curso | El frontend hace polling/listen mientras el LLM procesa |

**Regla de sincronización:** Cuando un reporte se crea/confirma en Supabase, el backend escribe también en Firestore para que el frontend reciba el update instantáneamente.

---

## 3. BigQuery — Analítica Histórica

Datos de eventos inmutables para análisis, dashboards directivos y entrenamiento de modelos. No se consulta desde la app en tiempo real.

### Datasets y Tablas

#### Dataset: `gado_analytics`

| Tabla | Descripción | Partición |
|---|---|---|
| `search_events` | Cada búsqueda realizada: query, categoría, lat/lng, resultados, tiempo de respuesta | Por día (`created_at`) |
| `recommendation_events` | Cada recomendación generada: categoría, mood, lugares sugeridos, modelo usado | Por día |
| `place_views` | Cada vez que un usuario ve los detalles de un lugar | Por día |
| `report_lifecycle` | Ciclo de vida completo de reportes: creación, confirmaciones, expiración | Por día |
| `vote_events` | Todos los votos en lugares y reportes con contexto | Por día |
| `user_sessions` | Sesiones de uso: duración, pantallas visitadas, acciones | Por día |
| `map_interactions` | Movimientos de mapa, zooms, filtros aplicados | Por día |
| `brain_usage` | Uso del LLM: query, tokens, latencia, proveedor (Gemini/Groq) | Por día |

#### Dataset: `gado_snapshots` (para dashboard directivo)

| Tabla | Descripción | Frecuencia |
|---|---|---|
| `daily_kpis` | DAU, búsquedas/día, reportes activos, lugares más vistos | Diaria |
| `category_popularity` | Ranking de categorías por búsquedas y conversiones | Semanal |
| `geographic_heatmap` | Densidad de actividad por zona geográfica | Diaria |
| `report_accuracy` | % de reportes confirmados vs denegados por tipo | Semanal |

**Cómo llegan los datos:** El backend emite eventos a BigQuery vía la API de streaming (`insertAll`) en background tasks, sin bloquear las respuestas de la API.

---

## Flujo de Datos

```
Usuario hace acción
        │
        ▼
   FastAPI (Cloud Run)
        │
   ┌────┴────────────────┐
   │                     │
   ▼                     ▼
Supabase SQL         Firestore
(fuente de verdad)   (tiempo real)
                         │
                         ▼
                   Frontend React Native
                   (listener en vivo)

   + Background Task ──► BigQuery
                         (analítica)
```
