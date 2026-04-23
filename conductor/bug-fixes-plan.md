# Plan de Corrección de Errores (Bug Fixes)

## Objetivo
Solucionar tres errores visuales y de conexión reportados en la interfaz de la aplicación frontend (React Native / Expo Web).

## Alcance e Impacto
- **Frontend (`main/frontend/`)**: Archivos de servicios de API, mapa y componentes.
- **Impacto**: Las llamadas a la API funcionarán en el entorno local actual (puerto `8080`), el mapa mostrará el botón flotante de alertas en vivo, y se limpiará visualmente la atribución inferior derecha del mapa web.

## Pasos de Implementación

### Bug 1: "NetworkError" en las recomendaciones
- **Causa**: El frontend sigue intentando conectarse al puerto `8000` por defecto en localhost, mientras que nuestro `Makefile` levanta el backend en el puerto `8080`.
- **Acción**: En `main/frontend/services/api.ts` y en `main/frontend/services/mapService.ts` (si tiene hardcodeado el puerto), cambiaré la URL por defecto de fallback de `http://localhost:8000` a `http://localhost:8080`.

### Bug 2: Falta el botón de "Alertas en tiempo real" en el mapa
- **Causa**: En la pantalla del mapa (`main/frontend/app/(tabs)/index.tsx`), no se está renderizando el botón flotante (FAB) para crear un reporte comunitario.
- **Acción**: Añadiré un botón flotante (estilo FAB) superpuesto sobre el componente del mapa (usualmente posicionado de forma absoluta) que navegue a la pantalla o abra el modal de creación de reporte (por ejemplo, con icono de altavoz/megáfono).

### Bug 3: Etiqueta "Leaflet | OpenStreetMap" en el mapa
- **Causa**: El componente web de `react-leaflet` (`MapContainer`) incluye por defecto el control de atribución en la esquina inferior derecha.
- **Acción**: En el componente del mapa web (probablemente `main/frontend/components/map/MapComponent.web.tsx`), añadiré la propiedad `attributionControl={false}` al `<MapContainer>` para ocultar permanentemente ese texto.

## Verificación
1. Iniciar la aplicación manualmente (el usuario ejecutará `make`).
2. Abrir la consola de red del navegador y confirmar que los `fetch` van a `:8080` (Bug 1 resuelto).
3. Ver que aparece el botón de Alertas sobre el mapa (Bug 2 resuelto).
4. Confirmar visualmente que el texto "Leaflet | OpenStreetMap" ha desaparecido de la esquina del mapa web (Bug 3 resuelto).
