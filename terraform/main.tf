# Configuración del Provider
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "us-east-1" # Asegúrate de que esta sea tu región
}

# 1. Tu Instancia para el Data Project
resource "aws_instance" "data_server" {
  ami           = "ami-0c7217cdde317cfec" # Ubuntu 22.04 LTS
  instance_type = "t2.micro"

  tags = {
    Name = "DataProject3_Instance"
  }
}

# 2. Bucket S3 para guardar los datos
resource "aws_s3_bucket" "data_storage" {
  bucket = "ivan-huertas-dataproject3-storage" # Este nombre debe ser único
}

# 3. Output para que no pierdas la IP
output "instance_ip" {
  value = aws_instance.data_server.public_ip
}