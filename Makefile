
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
	@echo "Construyendo frontend..."
	docker build --build-arg EXPO_PUBLIC_BACKEND_URL=$(BACKEND_URL) -t $(FRONTEND_IMAGE) $(FRONTEND_DIR)

run:
	@echo "Creando red..."
	docker network create $(CONTAINER_NETWORK) 2>/dev/null || true
	@echo "Asegurando que la base de datos local existe..."
	touch $(BACKEND_DIR)/temp_local.db
	@echo "Iniciando backend..."
	docker run -d --name gado-backend --network $(CONTAINER_NETWORK) \
		-p 8080:8080 \
		-v $$(pwd)/$(BACKEND_DIR)/temp_local.db:/app/temp_local.db \
		$(BACKEND_IMAGE)
	@echo "Iniciando frontend..."
	docker run -d --name gado-frontend --network $(CONTAINER_NETWORK) \
		-p 80:80 \
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
