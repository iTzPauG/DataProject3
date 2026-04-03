# Estructura del Proyecto — DataProject3

## Visión General

```
DataProject3/
├── main/               ← Código de la app (backend + frontend + BD)
├── terraform/          ← Infraestructura GCP como código
├── api/                ← Esqueleto antiguo (reemplazado por main/backend)
├── scripts/            ← Utilidades de desarrollo
└── archivos raíz       ← Configuración global
```

---

## `/main` — La Aplicación

### `/main/backend` — API Principal (FastAPI)

La API real y funcional. Se despliega en **GCP Cloud Run**.

#### Archivos raíz del backend

| Archivo | Qué hace |
|---|---|
| `main.py` | Punto de entrada. Registra todos los routers y configura CORS. |
| `config.py` | Lee todas las variables de entorno (Supabase, Gemini, Google Maps, etc.). |
| `database.py` | Crea y cachea el cliente de Supabase (anon key o service role). |
| `auth.py` | Helpers de autenticación: extrae `user_id` de JWT Bearer, genera fingerprint anónimo por IP+UA. |
| `requirements.txt` | Dependencias Python: FastAPI, Supabase, Google GenAI, HTTPX, Pillow, etc. |
| `Dockerfile` | Imagen Docker para Cloud Run (python:3.12-slim, puerto 8080). |

#### `/main/backend/routers` — Endpoints de la API

| Router | Prefijo | Qué hace |
|---|---|---|
| `health.py` | `/health` | Healthcheck para Cloud Run. |
| `search.py` | `/search` | Búsqueda universal: combina Google Places + Overpass (OSM) + Geoapify + Supabase local. Incluye streaming (`/search/live`) y autocompletado (`/search/autocomplete`). |
| `brain.py` | `/brain` | Chat directo con el LLM (Gemini/Groq/Ollama). Interpreta intenciones de búsqueda. |
| `places.py` | `/places` | Items cercanos en el mapa (lugares + reportes + eventos). Datos en vivo de gasolineras/farmacias. |
| `reports.py` | `/reports` | Reportes ciudadanos: crear, confirmar/denegar, eliminar. Gestión de tipos de reporte (admin). |
| `events.py` | `/events` | Eventos locales: CRUD y búsqueda por proximidad. |
| `categories.py` | `/categories` | Categorías y subcategorías de lugares. |
| `recommend.py` | `/recommend` | Motor de recomendaciones IA con pipeline de Gemini. |
| `votes.py` | `/votes` | Votos en lugares (útil / no útil). |
| `bookmarks.py` | `/bookmarks` | Guardados/favoritos del usuario. |
| `photos.py` | `/photos` | Subida y gestión de fotos de lugares. |
| `preferences.py` | `/preferences` | Preferencias del usuario (radio, idioma, estilo de mapa, etc.). |
| `compare.py` | `/compare` | Comparar 2–4 lugares. *(Sin implementar)* |
| `deals.py` | `/deals` | Ofertas flash de restaurantes. *(Sin implementar)* |
| `reservations.py` | `/restaurants/{id}/reservations` | Reservas en restaurantes. *(Sin implementar)* |
| `interactions.py` | `/restaurants/{id}/like` | Like/unlike en restaurantes. *(Sin implementar)* |
| `internal.py` | `/internal` | Proxy interno a Google Maps y TripAdvisor. Solo accesible desde otros servicios Cloud Run. *(Sin implementar)* |

#### `/main/backend/services` — Lógica de Negocio

| Servicio | Qué hace |
|---|---|
| `brain_service.py` | Llama al LLM configurado (Gemini, Groq u Ollama) para interpretar búsquedas y generar recomendaciones. |
| `google_places_service.py` | Busca lugares en Google Places API. |
| `geoapify_service.py` | Busca lugares en Geoapify (mapas y geocodificación). |
| `overpass_service.py` | Busca POIs en OpenStreetMap vía Overpass API. |
| `nominatim_service.py` | Geocodificación y autocompletado de direcciones (OSM Nominatim). |
| `live_data_service.py` | Datos en tiempo real: precios de gasolineras (Ministerio de Industria), farmacias de guardia. |
| `place_persistence_service.py` | Guarda/actualiza lugares de proveedores externos en Supabase. |
| `cache_service.py` | Caché en memoria para resultados de búsqueda (TTL configurable). |
| `moderation.py` | Moderación de contenido generado por usuarios. |
| `recommendation/pipeline.py` | Pipeline completo de recomendación IA. |
| `recommendation/category_flow.py` | Define el flujo de categorías para el motor de recomendaciones. |
| `recommendation/tools.py` | Herramientas del agente IA: búsqueda de lugares por categoría, detalles de lugar. |

#### `/main/backend/models` — Esquemas de Datos

| Archivo | Qué hace |
|---|---|
| `schemas.py` | Modelos Pydantic para requests/responses (reportes, preferencias, votos, etc.). |
| `search.py` | Modelo `BrainRequest` para el endpoint de chat. |
| `universal_poi.py` | Modelo unificado de punto de interés (POI) para normalizar resultados de distintos proveedores. |

#### Archivos de test (solo desarrollo local)

`test_agents.py`, `test_brain.py`, `test_bug.py`, `test_places.py`, `test_real.py`, `test_real_agents.py`, `test_worst.py` — Scripts de prueba manuales. No son tests automatizados.

---

### `/main/frontend` — App Móvil/Web (React Native + Expo)

Se despliega en **Railway** servido por nginx.

#### Estructura principal

| Carpeta/Archivo | Qué hace |
|---|---|
| `app/` | Rutas de la app (Expo Router). Pantallas principales. |
| `app/(flow)/` | Flujo de selección de categoría → detalles de lugar. |
| `components/` | Componentes reutilizables: mapa, tarjetas, botones, bottom sheets. |
| `services/api.ts` | Cliente HTTP hacia el backend. |
| `services/supabase.ts` | Cliente Supabase para auth y realtime. |
| `services/mapService.ts` | Lógica de mapa (Geoapify). |
| `hooks/` | Hooks personalizados: auth, localización, estado de la app, realtime. |
| `types/` | Tipos TypeScript: restaurantes, reportes, mapa. |
| `utils/` | Utilidades: caché, formato, logger, estilos de mapa, tema. |
| `constants/` | Constantes de diseño y tema visual. |
| `nginx.conf` | Configuración nginx para servir la web build en Railway. |
| `.env.example` | Variables de entorno necesarias (URL del backend, Supabase, etc.). |

---

### `/main/supabase` — Base de Datos

Migraciones SQL para Supabase (PostgreSQL + PostGIS).

| Archivo | Qué hace |
|---|---|
| `migrations/003_expanded_categories_and_subcategories.sql` | Categorías y subcategorías expandidas. |
| `old_db_modifications/000_full_reset.sql` | Reset completo + tablas base + función `nearby_items` (PostGIS). |
| `old_db_modifications/001_item_votes_text_id.sql` | Soporte para IDs de texto (Google Places IDs). |
| `old_db_modifications/002_category_flow_preferences_and_report_fixes.sql` | Preferencias de usuario y correcciones en reportes. |

---

### `/main/docs` — Documentación

| Archivo | Qué hace |
|---|---|
| `GADO_AI_Decision_Engine.pptx` | Presentación del motor de decisión IA. |
| `pipeline-diagram.html` | Diagrama visual del pipeline de recomendaciones. |

---

## `/terraform` — Infraestructura GCP

Gestiona toda la infraestructura en Google Cloud Platform con Terraform. El estado se guarda en un bucket GCS remoto.

### Archivos raíz

| Archivo | Qué hace |
|---|---|
| `main.tf` | Orquesta todos los módulos. Define el backend remoto en GCS. |
| `variables.tf` | Variables globales: `project_id` y `region`. |
| `outputs.tf` | Exporta la URL del servicio Cloud Run. |
| `.terraform.lock.hcl` | Fija las versiones exactas de los providers (debe commitearse). |

### `/terraform/modules`

| Módulo | Qué hace |
|---|---|
| `apis/` | Activa las APIs de GCP necesarias (Cloud Run, IAM, Artifact Registry, etc.). |
| `registry/` | Crea el repositorio en Artifact Registry y construye/sube la imagen Docker con `--platform linux/amd64`. |
| `cloud_run/` | Despliega el servicio Cloud Run con la imagen del registry. |
| `iam/` | Configura permisos: hace el servicio Cloud Run públicamente invocable (`allUsers`). |

### `/terraform/bootstrap`

Terraform independiente que crea el bucket GCS para el estado remoto. Se ejecuta **una sola vez** al iniciar el proyecto o al migrar de proyecto GCP.

| Archivo | Qué hace |
|---|---|
| `main.tf` | Crea el bucket `{project_id}-tfstate` con versionado activado. |
| `variables.tf` | `project_id` y `region`. |
| `terraform.tfstate` | Estado local del bootstrap (solo contiene el bucket, seguro para commitear). |

---

## `/api` — Esqueleto Antiguo *(deprecado)*

API esqueleto original creada para el despliegue en GCP. Todos los routers tienen implementación vacía (`pass`). **La API activa es `main/backend/`**. Esta carpeta se mantiene temporalmente como referencia.

---

## `/scripts` — Utilidades

| Archivo | Qué hace |
|---|---|
| `generate_icons.py` | Genera iconos estáticos para categorías usando IA. |
| `legacy/fix_colors.py` | Script legacy de corrección de colores. |
| `legacy/fix_colors2.py` | Versión 2 del script anterior. |

---

## Archivos Raíz

| Archivo | Qué hace |
|---|---|
| `.gitignore` | Excluye `.terraform/`, `tfstate`, `__pycache__`, `.env`, `venv*`, credenciales JSON. |
| `README.md` | Guía maestra del proyecto (inicio rápido, configuración, despliegue). |
| `start_all.py` | Lanza backend + frontend simultáneamente en local. |
| `seed_api.py` | Puebla la BD con tipos de reporte y categorías iniciales. |
| `Dockerfile` | Dockerfile raíz (referencia, el activo está en `main/backend/`). |
| `railway.toml` | Configuración de despliegue en Railway. |
| `package.json` | Dependencias Node.js raíz (probablemente residuo del merge). |
| `venv_win/` | Entorno virtual de Windows de un miembro del equipo. **No debe commitearse.** |
| `LOGO.png` | Logo del proyecto. |

---

## Variables de Entorno Necesarias

### Backend (`main/backend/.env`)

| Variable | Para qué |
|---|---|
| `SUPABASE_URL` | URL del proyecto Supabase |
| `SUPABASE_ANON_KEY` | Clave pública de Supabase |
| `SUPABASE_SERVICE_KEY` | Clave de servicio (acceso total a BD) |
| `SUPABASE_JWT_SECRET` | Para verificar tokens JWT en servidor |
| `GOOGLE_MAPS_API_KEY` | Búsqueda de lugares en Google Places |
| `GOOGLE_GENAI_API_KEY` | Motor Gemini (recomendaciones + brain) |
| `GEOAPIFY_API_KEY` | Mapas y geocodificación |
| `ADMIN_API_KEY` | Protege endpoints de administración |

### Frontend (`main/frontend/.env`)

| Variable | Para qué |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | URL Supabase |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Clave pública Supabase |
| `EXPO_PUBLIC_BACKEND_URL` | URL del backend (local: `http://<IP>:8000`, prod: URL de Cloud Run) |
