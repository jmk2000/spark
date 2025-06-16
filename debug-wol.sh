#!/bin/bash

# Pi-specific WoL debugging script
# Run this inside the SPARK container on Pi

echo "🔍 Pi WoL Debugging"
echo "==================="

# Load env vars
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

TARGET_MAC=${TARGET_SERVER_MAC:-"aa:bb:cc:dd:ee:ff"}
TARGET_IP=${TARGET_SERVER_IP:-"192.168.1.100"}

echo "Target MAC: $TARGET_MAC"
echo "Target IP: $TARGET_IP"
echo ""

# Check if running in container
if [ -f /.dockerenv ]; then
    echo "✅ Running inside Docker container"
else
    echo "❌ Not running in Docker"
fi
echo ""

# Check network capabilities
echo "🔧 Network capabilities:"
echo "NET_RAW: $(cat /proc/self/status | grep CapEff | cut -f2)"
echo ""

# Check available interfaces
echo "🌐 Network interfaces:"
ip link show
echo ""

# Check default route
echo "📡 Default route:"
ip route | grep default
echo ""

# Check if WoL tools are available
echo "🛠️ WoL tools check:"
which wakeonlan && echo "✅ wakeonlan available" || echo "❌ wakeonlan missing"
which etherwake && echo "✅ etherwake available" || echo "❌ etherwake missing"
echo ""

# Test WoL methods
echo "🚀 Testing WoL methods:"

echo "Method 1: wakeonlan default"
wakeonlan $TARGET_MAC 2>&1

echo ""
echo "Method 2: wakeonlan with broadcast"
wakeonlan -i 255.255.255.255 $TARGET_MAC 2>&1

echo ""
echo "Method 3: etherwake default"
etherwake $TARGET_MAC 2>&1

echo ""
echo "Method 4: Check if we can bind to raw sockets"
python3 -c "
import socket
try:
    s = socket.socket(socket.AF_INET, socket.SOCK_RAW, socket.IPPROTO_RAW)
    print('✅ Raw socket creation successful')
    s.close()
except Exception as e:
    print(f'❌ Raw socket failed: {e}')
" 2>/dev/null || echo "❌ Python3 not available for socket test"

echo ""
echo "🔍 Compare with MacBook:"
echo "1. Check if MacBook uses same Docker version"
echo "2. Compare network interface names"
echo "3. Verify Pi has same Docker capabilities"
