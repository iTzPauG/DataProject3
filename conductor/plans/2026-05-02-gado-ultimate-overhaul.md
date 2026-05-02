# Plan de Mejoras Profundas: Proyecto GADO (The Ultimate Overhaul)

## Visión General
El objetivo de este documento es planificar una mejora absoluta e integral de toda la plataforma GADO. Esta no es una actualización menor; es un *overhaul* estético y algorítmico diseñado para llevar la aplicación al siguiente nivel de sofisticación y rendimiento. 

Se abordan dos frentes principales:
1. **Frontend (React Native / Expo Web)**: Rediseño Premium, Animaciones y Microinteracciones.
2. **Backend (FastAPI, Python)**: Evolución de los algoritmos de IA, RAG, y Arquitectura de Recomendaciones.

---

## 1. Frontend: Estética y UI/UX Overhaul

### 1.1. Renovación del Sistema de Diseño (Design System)
- **Paleta de Colores Evolucionada**: Mantener el modo oscuro basado en índigo frío (`#0C0D12`), pero refinar los contrastes. Introducir sutiles gradientes de malla (Mesh Gradients) en los fondos para dar sensación de profundidad y fluidez, alejándose del color plano.
- **Tipografía (Bricolage Grotesque & Onest)**: Afinar los pesos y el *letter-spacing*. Los títulos (Headings) deben tener un *tracking* negativo más pronunciado (`-1.2px`) para un look más moderno y premium, mientras que las etiquetas de metadatos usarán *uppercase* con un *tracking* muy espaciado (`+2px`).
- **Sistema de Sombras y Relieves**: Implementar *inner shadows* sutiles en los botones y tarjetas para imitar un efecto "Neumórfico Oscuro" o de cristal (Glassmorphism), utilizando `blur` de fondo (`expo-blur`) en modales y Bottom Sheets.

### 1.2. Animaciones y Microinteracciones (Reanimated)
- **Transiciones de Pantalla Compartidas (Shared Element Transitions)**: Cuando el usuario pulse una categoría (ej. "Pizza"), el monograma o la tarjeta debería expandirse fluidamente hacia la siguiente pantalla en lugar de un salto brusco.
- **Microinteracciones Hápticas**: Integrar `expo-haptics` en botones principales (guardar, seleccionar opciones de budget/mood, votar).
- **Animaciones de Carga Coreográficas**: Reemplazar los puntos de carga por animaciones vectoriales Lottie o *Skeletons* con barridos asimétricos (Shimmer effect) que imiten la estructura de las tarjetas finales.
- **Map Interactions**: Transiciones suaves de la cámara de Leaflet al seleccionar resultados en la lista inferior (FlyTo con easing `cubic-bezier`).

### 1.3. Reestructuración de Layouts
- **Hero Header Dinámico**: El header de inicio (`Siente Torrent como un local`) debería responder al scroll (Sticky Header) reduciendo su tamaño y apareciendo el campo de búsqueda global.
- **Bottom Sheet Re-arquitectura**: Mejorar el BottomSheet (resultados del mapa) para que tenga 'Snap Points' magnéticos más fluidos en iOS y Android, permitiendo arrastrarlo suavemente sobre el mapa y difuminando (blur) el mapa cuando está al 100% de altura.

---

## 2. Backend: Algoritmos de IA y Pipeline de Recomendaciones

### 2.1. Sustitución de Búsqueda Keyword por Vector Embedding (Semantic Search)
- **Problema Actual**: Dependemos de búsquedas estructuradas en Google Places API que no entienden matices complejos (ej. "Un lugar tranquilo para leer con luz natural").
- **Solución**: Implementar una base de datos vectorial (Qdrant, Pinecone, o pgvector). El `brain_service` convertirá la consulta natural del usuario en un embedding vectorial y buscará lugares cuyas reseñas, menú y descripciones generen un embedding cercano.

### 2.2. Pipeline de Orquestación Multi-Agente (Agentic RAG)
- **Problema Actual**: Un único prompt de LLM gigante lee los datos en lotes para generar *pros, cons, y verdict*. Esto puede provocar alucinaciones o pérdida de detalles críticos.
- **Solución (LangGraph o CrewAI)**:
  - **Agente Explorador**: Busca y recolecta contexto (Google, Yelp, TripAdvisor).
  - **Agente Crítico**: Contrasta las reseñas entre plataformas buscando contradicciones (ej. Google dice "genial" pero Yelp advierte de "cucarachas").
  - **Agente Redactor (Persona WHIM)**: Sintetiza los datos verificados con el tono directo y sin adornos que caracteriza a WHIM.

### 2.3. Sistema de Fallback Diferencial e Inteligente
- Si las APIs de LLM (Gemini 2.5) caen o los tiempos de espera exceden 3000ms, el sistema no solo devolverá un "Fallback_Review_Signals" basado en keywords. Integrará un modelo NLP local ligero (como `MiniLM` con ONNX) que pueda procesar rápidamente sentimientos y devolver "Pros" y "Cons" estadísticamente válidos en 100ms.

### 2.4. Mejora del Pipelining Asíncrono (Data Fetching)
- **Predictive Pre-fetching**: Si un usuario entra en la categoría "Food", el backend comenzará de forma preventiva a cachear en Redis los top 20 restaurantes de la zona central antes de que el usuario envíe su presupuesto y *mood*.
- **GraphQL / gRPC Backend**: Reducir el payload que se envía al cliente. Transmitir solo campos básicos (ID, nombre, coords) primero, e hidratar pros/cons mediante una conexión Websocket / SSE de forma ultra granulada.

---

## 3. Infraestructura y Monitoreo

### 3.1. Telemetría y Analítica de Producto
- Implementar **PostHog** u **OpenTelemetry** para mapear en qué punto del flujo (Categoría -> Mood -> Presupuesto) los usuarios abandonan, y qué "moods" tienen 0 resultados consistentemente.

### 3.2. Caching Geospacial Dinámico
- Redis actual se basa en claves estáticas (Lat/Lng con 4 decimales). Migrar a índices geohash (H3) o polígonos de celdas Uber H3, permitiendo reutilizar volcados completos de caché si dos usuarios están a 50 metros de distancia.

---
## Conclusión y Próximos Pasos
Este planning requiere una ejecución metódica por fases. Se recomienda comenzar con el **Sistema Vectorial RAG en el Backend**, ya que mejorará drásticamente la calidad antes de embellecer el Frontend con **Reanimated y Glassmorphism**.