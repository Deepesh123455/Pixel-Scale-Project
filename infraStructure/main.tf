terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# 📍 1. Region Set Kiya (Mumbai)
provider "aws" {
  region = "ap-south-1" 
}

# 📀 2. Latest Ubuntu 22.04 Image Automatically Fetch Karega
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical (Ubuntu) AWS ID

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }
  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# 🛡️ 3. Security Group (Firewall Rules)
resource "aws_security_group" "pixelscale_sg" {
  name        = "pixelscale-api-sg"
  description = "Allow SSH and API traffic for PixelScale"

  # SSH Access (Port 22)
  ingress {
    description = "SSH Access"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"] # Note: Production mein ise apne personal IP tak restrict karna better hota hai
  }

  # API Access (Port 4500)
  ingress {
    description = "PixelScale API"
    from_port   = 4500
    to_port     = 4500
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Outbound Traffic (Docker images pull karne ke liye zaroori)
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# 💻 4. The EC2 Server
resource "aws_instance" "pixelscale_server" {
  ami           = data.aws_ami.ubuntu.id
  instance_type = "t3.micro" # Free tier!

  # 🚨 IMPORTANT: Apna AWS Key Pair ka naam yahan dalo taaki SSH kar sako
  key_name      = "pixelscale-mumbai-key" 

  vpc_security_group_ids = [aws_security_group.pixelscale_sg.id]

  user_data = <<-EOF
              #!/bin/bash
              # Update packages
              sudo apt-get update -y
              
              # Install Docker dependencies
              sudo apt-get install -y ca-certificates curl gnupg
              sudo install -m 0755 -d /etc/apt/keyrings
              curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
              sudo chmod a+r /etc/apt/keyrings/docker.gpg

              # Add Docker repository
              echo \
                "deb [arch="$(dpkg --print-architecture)" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
                "$(. /etc/os-release && echo "$VERSION_CODENAME")" stable" | \
                sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

              # Install Docker and Docker Compose
              sudo apt-get update -y
              sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

              # Start and enable Docker
              sudo systemctl start docker
              sudo systemctl enable docker

              # Add 'ubuntu' user to docker group (so CI/CD doesn't need sudo)
              sudo usermod -aG docker ubuntu
              EOF

  tags = {
    Name = "PixelScale-Production-Server"
  }
}


output "server_public_ip" {
  value       = aws_instance.pixelscale_server.public_ip
  description = "🚀 Copy this IP! This is your PixelScale server."
}