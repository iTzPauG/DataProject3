
# Variables
BACKEND_DIR=main/backend
FRONTEND_DIR=main/frontend
BACKEND_IMAGE=gado-backend
FRONTEND_IMAGE=gado-frontend
CONTAINER_NETWORK=gado-network

# Build args for frontend (Update these as needed)
BACKEND_URL=http://localhost:8080

.PHONY: all help build run stop clean

all: build run

help:
	@echo "Comandos disponibles:"
	@echo "  make build   - Construye las imagenes de Docker para frontend y backend"
	@echo "  make run     - Ejecuta ambos contenedores"
	@echo "  make stop    - Detiene y elimina los contenedores"
	@echo "  make clean   - Limpia imagenes y redes"

build:
	@echo "Construyendo backend..."
	docker build -t $(BACKEND_IMAGE) $(BACKEND_DIR)
	@echo "Construyendo frontend (esto puede tardar 5-10 minutos la primera vez)..."
	docker build --build-arg EXPO_PUBLIC_BACKEND_URL=$(BACKEND_URL) -t $(FRONTEND_IMAGE) $(FRONTEND_DIR)

run: stop
	@echo "Creando red..."
	docker network create $(CONTAINER_NETWORK) 2>/dev/null || true
	@echo "Asegurando que la base de datos local existe..."
	touch $(BACKEND_DIR)/temp_local.db
	@echo "Verificando configuracion..."
	@grep -q "GOOGLE_MAPS_API_KEY=AIza" $(BACKEND_DIR)/.env || (echo "ERROR: GOOGLE_MAPS_API_KEY no encontrada o no es valida en $(BACKEND_DIR)/.env" && exit 1)
	@echo "Iniciando backend..."
	docker run -d --name gado-backend --network $(CONTAINER_NETWORK) \
		-p 8080:8080 \
		--env-file ./$(BACKEND_DIR)/.env \
		$(BACKEND_IMAGE)
	@echo "Iniciando frontend..."
	docker run -d --name gado-frontend --network $(CONTAINER_NETWORK) \
		-p 80:80 \
		--env-file ./$(FRONTEND_DIR)/.env \
		$(FRONTEND_IMAGE)
	@echo "Aplicacion iniciada:"
	@echo "  Backend: http://localhost:8080"
	@echo "  Frontend: http://localhost"

stop:
	@echo "Deteniendo contenedores..."
	docker stop gado-backend gado-frontend 2>/dev/null || true
	docker rm gado-backend gado-frontend 2>/dev/null || true

clean: stop
	@echo "Eliminando red e imagenes..."
	docker network rm $(CONTAINER_NETWORK) 2>/dev/null || true
	docker rmi $(BACKEND_IMAGE) $(FRONTEND_IMAGE) 2>/dev/null || true
