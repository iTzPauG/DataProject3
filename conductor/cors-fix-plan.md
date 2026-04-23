# Plan de Solución al Error de Conexión (CORS / Backend Caído)

## Objetivo
Solucionar los errores "Cross-Origin Request Blocked" con "Status code: (null)" que indican que el frontend no puede comunicarse con el backend en `http://localhost:8080`.

## Alcance e Impacto
- **Backend (`main/backend/main.py` y `config.py`)**: Revisión de middleware de CORS y dependencias.
- **Docker (`Makefile` / `docker-compose`)**: Revisión de volumen e inicio.
- **Impacto**: Permitir que el frontend web (React Native/Expo) comunique sin bloqueos de red o errores de conexión con el backend de FastAPI.

## Pasos de Implementación

### Bug: Backend inaccesible (Error CORS (null))
- **Causa más probable**: El contenedor del backend (`gado-backend`) está deteniéndose tras iniciarse (crashing) o el middleware de CORS está rechazando activamente el origen `http://localhost`.
  1. Si es por caída (crash): Puede deberse a la creación del archivo `temp_local.db` en el `Makefile` (`touch main/backend/temp_local.db`) y luego montarlo como volumen (a veces Docker monta esto como carpeta si la ruta es ligeramente incorrecta). O un error en el código de Python (`aiosqlite` o alguna librería que falta).
  2. Si es por CORS de FastAPI: Me aseguraré de que `allow_origins=["*"]` esté explícitamente y correctamente configurado en `main.py` para aceptar el origen del navegador, o al menos `http://localhost`.

### Acción
1. Revisaré `main/backend/main.py` para asegurar que el CORS incluye `http://localhost` y que está declarado antes de incluir las rutas.
2. Comprobaré la ruta del volumen de SQLite en el Makefile.
3. Arreglaré los bloqueos de arranque si los hay, modificando lo que cause que el backend no escuche peticiones.

## Verificación
1. Ejecutar el backend (el usuario ejecutará `make`).
2. Abrir la consola del navegador y ver que las peticiones a `/auth/sync` y `/preferences/me` retornan códigos HTTP válidos (200 o 404, pero no `(null)` por bloqueo de red).
