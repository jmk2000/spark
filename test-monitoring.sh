#!/bin/bash

# Test script to diagnose SPARK monitoring issues
# Run this inside the SPARK container to test connectivity

# Load environment variables if available
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

TARGET_IP=${TARGET_SERVER_IP:-"10.0.75.44"}
SSH_PORT=${TARGET_SERVER_SSH_PORT:-22}
HTTP_PORT=${TARGET_SERVER_HTTP_PORT:-11434}
SSH_USER=${SSH_USERNAME}

echo "🔍 SPARK Monitoring Diagnostics"
echo "================================"
echo "Target IP: $TARGET_IP"
echo "SSH Port: $SSH_PORT"
echo "HTTP Port: $HTTP_PORT"
echo "SSH User: $SSH_USER"
echo ""

# Test 1: Basic ping
echo "1️⃣ Testing ping connectivity..."
if ping -c 1 -W 2 $TARGET_IP > /dev/null 2>&1; then
    echo "✅ Ping successful"
else
    echo "❌ Ping failed"
fi
echo ""

# Test 2: SSH port connectivity
echo "2️⃣ Testing SSH port connectivity..."
if nc -z -w2 $TARGET_IP $SSH_PORT; then
    echo "✅ SSH port $SSH_PORT is open"
else
    echo "❌ SSH port $SSH_PORT is closed or unreachable"
fi
echo ""

# Test 3: HTTP port connectivity
echo "3️⃣ Testing HTTP port connectivity..."
if nc -z -w2 $TARGET_IP $HTTP_PORT; then
    echo "✅ HTTP port $HTTP_PORT is open"
else
    echo "❌ HTTP port $HTTP_PORT is closed or unreachable"
fi
echo ""

# Test 4: HTTP service response
echo "4️⃣ Testing HTTP service response..."
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 3 --max-time 5 "http://$TARGET_IP:$HTTP_PORT/" 2>/dev/null)
if [ "$HTTP_STATUS" -ge 200 ] && [ "$HTTP_STATUS" -lt 500 ]; then
    echo "✅ HTTP service responding with status code: $HTTP_STATUS"
else
    echo "❌ HTTP service not responding properly (status: $HTTP_STATUS)"
fi
echo ""

# Test 5: SSH key and connectivity
echo "5️⃣ Testing SSH connectivity..."
if [ -z "$SSH_USER" ]; then
    echo "❌ SSH_USERNAME not set in environment"
elif [ ! -f "/app/.ssh/id_rsa" ]; then
    echo "❌ SSH private key not found at /app/.ssh/id_rsa"
else
    echo "SSH key found, testing connection..."
    SSH_CMD="ssh -i /app/.ssh/id_rsa -o ConnectTimeout=5 -o StrictHostKeyChecking=no -o BatchMode=yes -p $SSH_PORT $SSH_USER@$TARGET_IP"
    
    if $SSH_CMD "echo 'SSH connection successful'" 2>/dev/null; then
        echo "✅ SSH connection successful"
        
        # Test performance metric commands
        echo ""
        echo "6️⃣ Testing performance metric commands..."
        
        echo "Testing CPU command..."
        CPU_RESULT=$($SSH_CMD "grep 'cpu ' /proc/stat | awk '{usage=(\$2+\$4)*100/(\$2+\$4+\$5)} END {print usage}'" 2>/dev/null)
        if [ -n "$CPU_RESULT" ]; then
            echo "✅ CPU usage: $CPU_RESULT%"
        else
            echo "❌ CPU command failed"
        fi
        
        echo "Testing memory command..."
        MEM_RESULT=$($SSH_CMD "free | awk 'NR==2{printf \"%.1f\", \$3*100/\$2}'" 2>/dev/null)
        if [ -n "$MEM_RESULT" ]; then
            echo "✅ Memory usage: $MEM_RESULT%"
        else
            echo "❌ Memory command failed"
        fi
        
        echo "Testing disk command..."
        DISK_RESULT=$($SSH_CMD "df -h / | awk 'NR==2{print \$5}' | sed 's/%//'" 2>/dev/null)
        if [ -n "$DISK_RESULT" ]; then
            echo "✅ Disk usage: $DISK_RESULT%"
        else
            echo "❌ Disk command failed"
        fi
        
        echo "Testing GPU command..."
        GPU_RESULT=$($SSH_CMD "nvidia-smi --query-gpu=utilization.gpu --format=csv,noheader,nounits 2>/dev/null | head -1" 2>/dev/null)
        if [ -n "$GPU_RESULT" ]; then
            echo "✅ GPU usage: $GPU_RESULT%"
        else
            echo "ℹ️ GPU not available (this is normal for non-GPU systems)"
        fi
        
    else
        echo "❌ SSH connection failed"
        echo "Please check:"
        echo "  - SSH_USERNAME is correct"
        echo "  - SSH key is properly set up"
        echo "  - Target server allows key-based authentication"
        echo "  - User has proper permissions"
    fi
fi

echo ""
echo "🔍 Diagnostics complete!"
echo ""
echo "If you see issues above, check:"
echo "1. Network connectivity between SPARK and target server"
echo "2. SSH key authentication setup"
echo "3. Target server SSH configuration"
echo "4. Firewall settings on target server"