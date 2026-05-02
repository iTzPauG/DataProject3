# Plan: Debug Resultados, Votes Batch, Orígenes de Reseñas y Ubicaciones Guardadas

## Objetivo
1. **Solucionar el problema de los 3 resultados y el bucle infinito de polling:** Evitar que el frontend se quede esperando eternamente en `after=3` y asegurar que el backend termine la tarea o la marque como finalizada (`done=True`) incluso si el LLM falla o tarda demasiado.
2. **Solucionar el error 405 en `/votes/batch`:** Implementar el endpoint faltante en `main/backend/routers/votes.py`.
3. **Corregir el warning `unreachable code`:** Revisar el frontend (específicamente la función `poll` en `api.ts` o el `results-map.tsx`) para limpiar cualquier código inaccesible o mal estructurado tras los últimos parches.
4. **Corregir contadores de reseñas (Yelp/TripAdvisor a 0):** Investigar por qué el backend siempre devuelve 0 para Yelp y TripAdvisor en los orígenes de reseñas (`reviewSources`), y solucionarlo para que muestre datos reales o una métrica más clara si las APIs fallan.
5. **Nueva Funcionalidad (Subagente):** Implementar la capacidad de guardar ubicaciones (marcarlas como fijas en el mapa) y compararlas mediante el "Cerebro LLM" (`/brain`).

## Alcance e Impacto
- **Backend (`main/backend/routers/votes.py`)**: Añadir endpoint `POST /votes/batch`.
- **Backend (`main/backend/services/recommendation/pipeline.py` & `tools.py`)**: 
  - Añadir un bloque `try/finally` robusto en `recommend_stream` para asegurar que `yield {"event": "done"}` SIEMPRE se envíe.
  - Revisar por qué fallan o se descartan las llamadas a las APIs de Yelp/TripAdvisor y corregir la extracción de conteos.
- **Frontend (`main/frontend/services/api.ts` y `results-map.tsx`)**: Limpiar el código para eliminar el warning de código inalcanzable.
- **Subagente**: Se encargará del flujo completo de frontend y backend para la funcionalidad de guardar/comparar (modificando la UI del mapa, añadiendo botones de guardar y la llamada a `/brain` para comparar).

## Pasos de Implementación

### Fase 1: Fix Backend (Bucle infinito, Votes Batch, Reseñas)
1. **Votes Batch:** Modificar `votes.py` para incluir el endpoint `POST /batch`.
2. **Bucle Infinito:** Envolver el cuerpo de `recommend_stream` (en `pipeline.py`) en un bloque `try ... finally:` que asegure que el último evento emitido sea SIEMPRE `yield {"event": "done", "total": result_index}`. 
3. **Reseñas a 0:** Auditar `fetch_all_reviews` en `tools.py` y `_review_source_counts` en `pipeline.py` para asegurar que las llamadas asíncronas a las APIs externas se resuelven correctamente y sus reseñas se anexan a los datos del restaurante en la vista detallada (y se reflejan en el conteo total).

### Fase 2: Fix Frontend (Código inalcanzable)
1. Revisar `main/frontend/app/(flow)/results-map.tsx` (cerca de la línea 730 donde ocurre el `unreachable code`) y `api.ts`. Eliminar la sintaxis sobrante o los `return` que causen bloqueos en el renderizado progresivo.

### Fase 3: Nueva Funcionalidad (Subagente 'coder')
1. El subagente implementará el guardado de lugares usando el endpoint de bookmarks/saved places.
2. Adaptará `results-map.tsx` para mostrar siempre los lugares guardados en el mapa (pines con un color o icono distintivo).
3. Añadirá un botón de "Comparar" que envíe el lugar actual y los guardados al endpoint del LLM para generar una comparativa en formato modal.

## Verificación
- El mapa mostrará los resultados esperados y terminará correctamente sin quedarse bloqueado.
- No habrá errores 405 en la consola de red.
- No habrá warnings de `unreachable code`.
- Los recuentos de "G · Y · T" tendrán valores reales (no siempre cero).
- La nueva funcionalidad permitirá guardar sitios y compararlos exitosamente.