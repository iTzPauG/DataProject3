# Plan de Solución para "0 Resultados"

## Objetivo
Solucionar el problema de que el buscador devuelva siempre "No encontramos nada" (0 resultados) tras la eliminación de los datos mockeados.

## Alcance e Impacto
- **Backend (`main/backend/services/recommendation/pipeline.py`)**: Flexibilizar el pre-filtro para evitar que elimine todos los resultados devueltos por Google Places.
- **Backend (`main/backend/services/google_places_service.py`)**: Mejorar la visibilidad de los errores de la API de Google (como un 403 Forbidden por falta de activación de la API New) para facilitar el diagnóstico.
- **Impacto**: La aplicación devolverá resultados reales. Si los resultados no cumplen estrictamente con el precio, los mostrará igualmente pero en un orden inferior. Si la API falla, será evidente en los logs.

## Pasos de Implementación

### 1. Relajar el `pre_filter` (pipeline.py)
- **Causa**: Actualmente, si el usuario selecciona `€` (nivel 1) y Google devuelve 20 restaurantes pero todos son `€€€` (nivel 3) o están a más de 8km, el código de Python los elimina (`dropped.append(...)`) resultando en una lista vacía `[]`.
- **Acción**: Modificar `_pre_filter` para que la diferencia de precio penalice el orden de los resultados (`sort_key`), pero no los elimine de la lista a menos que haya suficientes resultados exactos. Así, siempre habrá opciones que mostrar.

### 2. Mejorar el log de Google Places (google_places_service.py)
- **Causa**: Si la API Key de Google no tiene habilitada específicamente la **Places API (New)** (que es diferente a la Places API antigua), las peticiones a `places.googleapis.com/v1/places:searchText` devuelven 403 Forbidden y el backend las ignora devolviendo silenciosamente `[]`.
- **Acción**: Añadiré un log de error (`logger.error`) claro y vistoso si `resp.status_code != 200` para que, al mirar la consola de Docker, sepas de inmediato si Google está bloqueando la Key.

## Verificación
1. Lanzar el proyecto (`make`).
2. Realizar una búsqueda en la app. Si devuelve resultados, el problema era el filtro estricto. Si sigue dando 0, revisar los logs de la terminal para ver si aparece un error `403` de Google Places indicando que debes habilitar la API New en tu consola de Google Cloud.
