# Plan de Correcciones UI, Hilos Comunitarios y Búsqueda de Similares

## Visión General
Este plan aborda tres correcciones visuales inmediatas y propone la arquitectura para desarrollar un sistema de comentarios comunitarios en tiempo real y una nueva función de exploración continua ("Buscar Similares").

---

## 1. Correcciones Visuales (Bugs UI)

### Bug 1: Logo Oscuro
- **Problema**: El logo principal es oscuro y no se ve sobre los fondos oscuros.
- **Acción**: En los componentes que usan el logo, añadiremos `tintColor: '#FFFFFF'` en la propiedad del `Image` para forzar su visibilidad en blanco.

### Bug 2: Barra del Mapa Transparente
- **Problema**: El botón de "Atrás" en el mapa flora sin fondo, siendo ilegible sobre mapas claros.
- **Acción**: Añadir un degradado sutil oscuro (`backgroundColor: 'rgba(12,13,18,0.6)'` o un gradiente real) en el contenedor `topSafe`.

### Bug 3: Botón de Guardado (Bookmark) Invisible
- **Problema**: La estrella no aparece en las tarjetas o los lugares no se marcan en el mapa instantáneamente.
- **Acción**: Ajustar el z-index de la estrella en `RestaurantCard.tsx` y asegurar que `results-map.tsx` renderice los `savedItems` dinámicamente sobre el mapa.

---

## 2. Nueva Función: "Buscar Lugares Similares"
- **Objetivo**: Permitir al usuario seguir explorando más allá de los 10 primeros resultados.
- **Backend (`pipeline.py` & `tools.py`)**: Implementar la capacidad de paginación o de *offset* usando los datos vectoriales. Si el usuario pulsa "Buscar similares", se lanzará una búsqueda excluyendo los `place_id` que ya ha visto, y usando como "semilla" vectorial los atributos de los lugares que le han gustado de la primera tanda.
- **Frontend (`results-map.tsx`)**: Añadir un botón al final de la lista de resultados (BottomSheet) que diga "Cargar más similares".

---

## 3. Nueva Función: Hilos de la Comunidad (Community Threads)

Basado en las preferencias del usuario: **Hilos Anidados, Solo Texto, Con Likes, Sin Auto-Reporte**.

### 3.1. Arquitectura de Base de Datos
Creación de dos tablas en la base de datos (SQLite/Postgres):
1. **`place_comments`**:
   - `id` (UUID, PK)
   - `place_id` (String, Indexado)
   - `user_id` (UUID, FK)
   - `parent_id` (UUID, FK opcional para crear hilos/respuestas)
   - `text` (Text)
   - `created_at` (Timestamp)
   - `likes_count` (Int)
2. **`comment_likes`**: Tabla puente (`comment_id`, `user_id`) para evitar votos dobles.

### 3.2. Backend (Endpoints FastAPI)
- `GET /comments/{place_id}`: Devuelve los hilos estructurados (padres con array de `children`).
- `POST /comments`: Publicar comentario o respuesta.
- `POST /comments/{comment_id}/like`: Toggle de me gusta.

### 3.3. Frontend (UI en Detalles del Lugar)
- **Componente `CommentsSection.tsx`**: Incrustado al final de `details.tsx`.
- Incluye lista anidada (respuestas indentadas) con el timestamp ("hace 2h"), botón de Like (👍) y botón de "Responder".
- **Tiempo Real**: Polling en segundo plano (cada 5-10s) al tener la pantalla abierta para refrescar nuevos comentarios de la comunidad automáticamente.