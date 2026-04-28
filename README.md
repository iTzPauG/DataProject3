# WHIM — Guía Maestra

WHIM es una plataforma premium de descubrimiento de lugares y reportes ciudadanos en tiempo real, diseñada para Valencia y optimizada para la velocidad y la honestidad brutal.

## ✨ Características Principales

- **Motor Turbo IA**: Recomendaciones inteligentes en <15s con análisis profundo de reseñas (Gemini).
- **Traducción Automática**: Reseñas de Google Places traducidas instantáneamente a tu idioma (ES, EN, FR).
- **Estética Premium Glass**: Interfaz moderna con modo oscuro/claro dinámico y sistema de capas de mapa.
- **Reportes en Vivo**: Avisa a la comunidad sobre incidencias, eventos o peligros al instante.
- **Datos en Tiempo Real**: Precios de gasolineras (Ministerio de Industria), farmacias de guardia y más.
- 
---

## 🚀 Inicio Rápido (Local)

La forma más sencilla de arrancar el proyecto completo es usando el script automatizado:

1.  **Configura tus archivos `.env`**:
    - Backend: `main/backend/.env` (Copia el ejemplo de abajo).
    - Frontend: `main/frontend/.env` (Asegúrate de poner tu IP local).

2.  **Ejecuta el arranque total**:
    ```bash
    python start_all.py
    ```
    *Este script iniciará automáticamente el Backend (Uvicorn) y el Frontend (Expo Web).*

---

## 🔧 Configuración Detallada

### 1. Backend (FastAPI)
- **Directorio**: `main/backend`
- **Requisitos**: Python 3.11+
- **Variables Críticas (`.env`)**:
  ```env
  SUPABASE_URL=...
  SUPABASE_ANON_KEY=...
  GOOGLE_MAPS_API_KEY=... # Para búsqueda de lugares
  GOOGLE_GENAI_API_KEY=... # Cerebro Gemini
  ```

### 2. Frontend (React Native + Expo)
- **Directorio**: `main/frontend`
- **Requisitos**: Node.js 18+, npm 9+
- **Variables Críticas (`.env`)**:
  ```env
  EXPO_PUBLIC_SUPABASE_URL=...
  EXPO_PUBLIC_SUPABASE_ANON_KEY=...
  EXPO_PUBLIC_BACKEND_URL=http://<TU_IP_LOCAL>:8000
  ```

---

## 📱 Visualización en Dispositivos

- **Web**: Presiona `w` en la terminal de Expo.
- **Móvil (Expo Go)**: Escanea el código QR desde la app Expo Go (asegúrate de estar en la misma red Wi-Fi).

---

## 🗄️ Base de Datos (Supabase)

Asegúrate de aplicar las migraciones en orden:
1. `000_full_reset.sql` (Limpieza y Tablas Base)
2. `001_item_votes_text_id.sql` (Soporte para IDs de Google)
3. `002_category_flow_preferences_and_report_fixes.sql` (Preferencias y Flujos)
4. `003_expanded_categories_and_subcategories.sql` (Categorías Turbo)

---

## 🛠️ Herramientas de Utilidad (Raíz)

- `seed_api.py`: Poblar la base de datos con tipos de reporte y categorías iniciales.
- `start_all.py`: Lanzador unificado de servicios.
- `scripts/generate_icons.py`: Generador de iconos estáticos usando IA.

---

## 🚢 Despliegue en Producción (Railway)

WHIM está configurado para desplegarse automáticamente en Railway:
- **Frontend**: Servido vía nginx (puerto 80).
- **Backend**: FastAPI con autodetección de URL para evitar errores de CORS.
- **Variables**: Asegúrate de configurar los *Build Arguments* en Railway para inyectar las claves de Expo durante la compilación.

---
*WHIM — Discovering the real city, brutally honest.*
