#!/bin/bash

echo "🚀 Starting SPARK - Server Power Automated Remote Kontrol"
echo "========================================================="

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  No .env file found. Creating from template..."
    cp .env.example .env
    echo "📝 Please edit .env file with your server details:"
    echo "   - TARGET_SERVER_IP (your server's IP address)"
    echo "   - TARGET_SERVER_MAC (your server's MAC address)"
    echo ""
    echo "Run 'nano .env' to edit the configuration, then run this script again."
    exit 1
fi

echo "🔧 Building SPARK Docker image..."
docker-compose build

echo "🚀 Starting SPARK services..."
docker-compose up -d

echo ""
echo "✅ SPARK is now running!"
echo "🌐 Access the web interface at: http://localhost:3000"
echo "📊 Monitor logs with: docker-compose logs -f"
echo "🛑 Stop SPARK with: docker-compose down"
echo ""
echo "🔧 Configuration:"
echo "   Target Server IP: $(grep TARGET_SERVER_IP .env | cut -d '=' -f2)"
echo "   Target Server MAC: $(grep TARGET_SERVER_MAC .env | cut -d '=' -f2)"
echo ""
echo "⚡ SPARK - Server Power Automated Remote Kontrol is ready!"
