# CodeContext Report

## File: `Dockerfile`

```Dockerfile
# Use Node.js 18 Alpine
FROM node:18-alpine

WORKDIR /app

# Install system dependencies for wake-on-lan
RUN apk add --no-cache \
    curl \
    iputils \
    net-tools \
    openssh-client

# Copy package files and install ALL dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Remove dev dependencies after build
RUN npm prune --omit=dev

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Create logs and SSH directories with proper permissions
RUN mkdir -p /app/logs /app/.ssh && \
    chown -R nodejs:nodejs /app

USER nodejs

# Set up SSH directory with correct permissions
RUN chmod 700 /app/.ssh

EXPOSE 3000

LABEL name="SPARK - Server Power Automated Remote Kontrol"
LABEL description="Web-based server power management with Wake-on-LAN"

CMD ["node", "dist/server.js"]
```

## File: `README.md`

```md
# SPARK - Server Power Automated Remote Kontrol

A modern web-based application for managing your Ubuntu server's power state with Wake-on-LAN and sleep functionality. Perfect for managing LLM servers like Ollama that need to be power-efficient when idle.

![SPARK Logo](https://img.shields.io/badge/SPARK-Server%20Power%20Automated%20Remote%20Kontrol-blue?style=for-the-badge)

## 🚀 Features

⚡ **Wake-on-LAN Support** - Remotely wake your server with magic packets  
🔴 **Remote Sleep Control** - Put your server to sleep via SSH  
📊 **Real-time Monitoring** - Live status updates via WebSocket  
🔧 **Service Monitoring** - Track SSH, HTTP, and Ollama API status  
📈 **Performance Metrics** - CPU, memory, and disk usage monitoring  
🎨 **Modern Web Interface** - Responsive design with real-time updates  
🐳 **Docker Ready** - Easy deployment with Docker Compose  

## 🎯 Perfect For

- **Ollama LLM Servers** - Manage power-hungry AI inference servers
- **Development Servers** - Wake on-demand for development work
- **Home Labs** - Reduce power consumption when idle
- **Remote Workstations** - Control access to powerful remote machines

## ⚡ Quick Start

### Prerequisites

- Docker and Docker Compose
- Target Ubuntu server with Wake-on-LAN enabled
- Network access to your target server

### Installation

1. **Run the SPARK setup script:**
```bash
curl -sSL https://your-domain.com/setup-spark.sh | bash
# OR download and run locally:
chmod +x setup-spark.sh
./setup-spark.sh
```

2. **Configure your environment:**
```bash
cd spark
nano .env
# Edit with your server details (IP, MAC address, etc.)
```

3. **Build and deploy SPARK:**
```bash
docker-compose up -d
```

4. **Access SPARK web interface:**
Open http://localhost:3000 in your browser

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `TARGET_SERVER_IP` | IP address of your Ubuntu server | `192.168.1.100` |
| `TARGET_SERVER_MAC` | MAC address for Wake-on-LAN | `00:11:22:33:44:55` |
| `TARGET_SERVER_SSH_PORT` | SSH port for sleep commands | `22` |
| `TARGET_SERVER_HTTP_PORT` | Ollama/HTTP service port | `11434` |
| `PING_INTERVAL` | Ping check interval (ms) | `5000` |
| `HEALTH_CHECK_INTERVAL` | Full health check interval (ms) | `10000` |

### Target Server Setup

#### Enable Wake-on-LAN on Ubuntu Server:

1. **Install ethtool:**
```bash
sudo apt update && sudo apt install ethtool
```

2. **Enable WoL on network interface:**
```bash
# Check current settings
sudo ethtool eth0

# Enable Wake-on-LAN
sudo ethtool -s eth0 wol g
```

3. **Make persistent:**
```bash
# Add to /etc/network/interfaces or create systemd service
echo 'post-up /sbin/ethtool -s eth0 wol g' | sudo tee -a /etc/network/interfaces
```

4. **Enable in BIOS/UEFI:**
   - Boot into BIOS/UEFI settings
   - Look for "Wake on LAN", "Power on by PCI-E", or similar
   - Enable the option

## 💡 Power Savings

With SPARK, you can achieve:
- **Idle consumption**: 5-15W (with Pi proxy)
- **Active consumption**: 50-150W (server dependent)
- **Potential savings**: 80-90% reduction in idle power usage

## 🏗️ Project Structure

```
spark/
├── src/
│   ├── server.ts          # Main Express server
│   ├── powerManager.ts    # Wake-on-LAN and sleep logic
│   └── serverMonitor.ts   # Status monitoring service
├── public/
│   └── index.html         # SPARK web interface
├── dist/                  # Compiled TypeScript
├── logs/                  # Application logs
├── Dockerfile
├── docker-compose.yml
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

## 🔌 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/status` | GET | Get current server status |
| `/api/wake` | POST | Send Wake-on-LAN packet |
| `/api/sleep` | POST | Put server to sleep |
| `/api/logs` | GET | Get application logs |
| `/api/config` | GET | Get current configuration |

## 🌐 WebSocket Events

- `statusUpdate` - Real-time server status updates
- `error` - Error notifications
- `connect/disconnect` - Connection status

## 📱 Usage

### Manual Control
- Monitor server status in real-time
- Wake server with one click
- Put server to sleep safely
- View service status and performance metrics

### Integration with Ollama Proxy
SPARK can be integrated with a proxy that:
1. Receives LLM requests
2. Checks if server is awake
3. Sends WoL packet if needed
4. Waits for server startup
5. Forwards request to Ollama
6. Returns response to client

## 🛠️ Troubleshooting

### Wake-on-LAN Not Working
- Verify MAC address is correct
- Check BIOS/UEFI WoL settings
- Ensure target server is plugged into power
- Test from same network segment

### Sleep Not Working
- Verify SSH access and authentication
- Check sudo permissions for systemctl
- Ensure target server supports suspend

### Performance Metrics Missing
- SSH access required for detailed metrics
- Check SSH key authentication
- Verify user permissions on target server

## 🔒 Security Considerations

- Use SSH key authentication (not passwords)
- Limit SSH access to specific users
- Consider VPN for remote access
- Monitor logs for unauthorized access attempts
- Use firewall rules to restrict access

## 📊 Monitoring

SPARK provides comprehensive monitoring:
- **Real-time status** - Server online/offline state
- **Service health** - SSH, HTTP, Ollama API status
- **Performance metrics** - CPU, memory, disk usage
- **Response times** - Network latency monitoring
- **System logs** - Detailed activity logging

## 🎨 Modern Interface

- **Responsive design** - Works on desktop and mobile
- **Real-time updates** - WebSocket-powered live data
- **Beautiful gradients** - Modern visual design
- **Intuitive controls** - One-click power management
- **Status indicators** - Clear visual feedback

## 🚀 Deployment Options

#### Option 1: Raspberry Pi (Recommended)
- Ultra-low power consumption (~5W)
- Always-on monitoring
- Dedicated WoL proxy

#### Option 2: Unraid Server
- Use existing infrastructure
- Higher power consumption but more features
- Can handle multiple server management

#### Option 3: Docker on any Linux host
- Flexible deployment
- Easy scaling and management

## 📈 Future Enhancements

- Multiple server support
- Scheduled wake/sleep times
- Power consumption tracking
- Mobile app companion
- Integration with home automation
- Advanced security features

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

- Check the logs in the SPARK web interface
- Review Docker container logs: `docker-compose logs -f`
- Verify network connectivity and permissions
- Consult Ubuntu WoL documentation for hardware-specific issues

---

Made with ⚡ by SPARK - Because your server shouldn't waste power when you're not using it!

```

## File: `docker-compose.yml`

```yml
services:
  spark:
    build: .
    container_name: spark-power-manager
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=${NODE_ENV:-production}
      - TARGET_SERVER_IP=${TARGET_SERVER_IP}
      - TARGET_SERVER_MAC=${TARGET_SERVER_MAC}
      - TARGET_SERVER_SSH_PORT=${TARGET_SERVER_SSH_PORT:-22}
      - TARGET_SERVER_HTTP_PORT=${TARGET_SERVER_HTTP_PORT:-11434}
      - PING_INTERVAL=${PING_INTERVAL:-5000}
      - HEALTH_CHECK_INTERVAL=${HEALTH_CHECK_INTERVAL:-10000}
      - PORT=${PORT:-3000}
      - LOG_LEVEL=${LOG_LEVEL:-info}
      - SSH_USERNAME=${SSH_USERNAME}
      - SSH_PRIVATE_KEY_PATH=/app/.ssh/id_rsa
    volumes:
      - ./logs:/app/logs
      - /etc/localtime:/etc/localtime:ro
      # Mount SSH key for sleep functionality
      - ${SSH_PRIVATE_KEY_PATH}:/tmp/ssh_key:ro
    # Add init script to copy and fix SSH key permissions
    command: >
      sh -c "
        cp /tmp/ssh_key /app/.ssh/id_rsa 2>/dev/null || echo 'No SSH key mounted';
        chmod 600 /app/.ssh/id_rsa 2>/dev/null || echo 'Could not set SSH key permissions';
        chown nodejs:nodejs /app/.ssh/id_rsa 2>/dev/null || echo 'Could not change SSH key ownership';
        node dist/server.js
      "
    # Required for network operations (ping, WoL)
    cap_add:
      - NET_RAW
      - NET_ADMIN
    # Use privileged mode for network access
    privileged: true
    networks:
      - spark-network

networks:
  spark-network:
    driver: bridge
```

## File: `globals.d.ts`

```ts
// Global type declarations for modules without @types packages

declare module 'wake_on_lan' {
  function wake(macAddress: string, callback: (error?: any) => void): void;
  export = { wake };
}

declare module 'ping' {
  interface PingResponse {
    host: string;
    alive: boolean;
    output: string;
    time: number;
  }
  
  namespace promise {
    function probe(host: string, config?: any): Promise<PingResponse>;
  }
  
  export = { promise };
}
```

## File: `package.json`

```json
{
  "name": "spark-server-power-manager",
  "version": "1.0.0",
  "description": "SPARK - Server Power Automated Remote Kontrol - Web-based server power management with Wake-on-LAN and sleep control",
  "main": "dist/server.js",
  "scripts": {
    "build": "tsc && cp -r public dist/",
    "start": "node dist/server.js",
    "dev": "concurrently \"tsc -w\" \"nodemon dist/server.js\"",
    "test": "jest"
  },
  "dependencies": {
    "express": "^4.18.2",
    "socket.io": "^4.7.2",
    "wake_on_lan": "^1.0.0",
    "ping": "^0.4.4",
    "systeminformation": "^5.21.22",
    "cors": "^2.8.5",
    "helmet": "^7.0.0",
    "dotenv": "^16.3.1",
    "joi": "^17.9.2",
    "winston": "^3.10.0"
  },
"devDependencies": {
    "@types/express": "^4.17.17",
    "@types/node": "^20.5.0",
    "@types/cors": "^2.8.13",
    "typescript": "^5.1.6",
    "nodemon": "^3.0.1",
    "concurrently": "^8.2.0",
    "jest": "^29.6.2",
    "@types/jest": "^29.5.3"
  },
  "keywords": [
    "spark",
    "wake-on-lan",
    "power-management",
    "server-administration",
    "docker",
    "ollama",
    "llm"
  ],
  "author": "SPARK User",
  "license": "MIT"
}

```

## File: `public/index.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SPARK - Server Power Automated Remote Kontrol</title>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/socket.io/4.7.2/socket.io.js"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            color: #333;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }

        .header {
            text-align: center;
            margin-bottom: 40px;
            color: white;
        }

        .header h1 {
            font-size: 2.5rem;
            margin-bottom: 10px;
            text-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }

        .header .subtitle {
            font-size: 1.1rem;
            opacity: 0.9;
            margin-bottom: 5px;
        }

        .header .acronym {
            font-size: 0.9rem;
            opacity: 0.8;
            font-style: italic;
        }

        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }

        .card {
            background: white;
            border-radius: 12px;
            padding: 25px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.1);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.2);
            transition: transform 0.3s ease, box-shadow 0.3s ease;
        }

        .card:hover {
            transform: translateY(-5px);
            box-shadow: 0 12px 40px rgba(0,0,0,0.15);
        }

        .card-title {
            font-size: 1.4rem;
            font-weight: 600;
            margin-bottom: 15px;
            color: #2d3748;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .status-indicator {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            display: inline-block;
            animation: pulse 2s infinite;
        }

        .status-online {
            background-color: #48bb78;
        }

        .status-offline {
            background-color: #f56565;
        }

        .status-unknown {
            background-color: #ed8936;
        }

        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
        }

        .button {
            background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 1rem;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.3s ease;
            margin: 5px;
            box-shadow: 0 4px 14px rgba(0,0,0,0.1);
        }

        .button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(0,0,0,0.15);
        }

        .button:active {
            transform: translateY(0);
        }

        .button.danger {
            background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
        }

        .button.success {
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        }

        .button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            transform: none;
        }

        .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin: 15px 0;
        }

        .info-item {
            background: #f7fafc;
            padding: 12px;
            border-radius: 6px;
            border-left: 4px solid #4f46e5;
        }

        .info-label {
            font-size: 0.85rem;
            color: #718096;
            margin-bottom: 4px;
        }

        .info-value {
            font-size: 1.1rem;
            font-weight: 600;
            color: #2d3748;
        }

        .service-status {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 0;
            border-bottom: 1px solid #e2e8f0;
        }

        .service-status:last-child {
            border-bottom: none;
        }

        .service-name {
            font-weight: 500;
        }

        .service-badge {
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 0.75rem;
            font-weight: 600;
            text-transform: uppercase;
        }

        .badge-online {
            background-color: #c6f6d5;
            color: #22543d;
        }

        .badge-offline {
            background-color: #fed7d7;
            color: #742a2a;
        }

        .logs-container {
            background: #1a202c;
            color: #e2e8f0;
            padding: 20px;
            border-radius: 8px;
            font-family: 'Monaco', 'Menlo', monospace;
            font-size: 0.9rem;
            max-height: 300px;
            overflow-y: auto;
            margin-top: 15px;
        }

        .log-entry {
            margin-bottom: 8px;
            padding: 4px 0;
        }

        .log-timestamp {
            color: #68d391;
            margin-right: 8px;
        }

        .log-level {
            margin-right: 8px;
            font-weight: bold;
        }

        .log-info { color: #63b3ed; }
        .log-warn { color: #f6e05e; }
        .log-error { color: #fc8181; }

        .loading {
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 3px solid #f3f3f3;
            border-top: 3px solid #4f46e5;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        .full-width {
            grid-column: 1 / -1;
        }

        .performance-bar {
            background: #e2e8f0;
            height: 8px;
            border-radius: 4px;
            overflow: hidden;
            margin-top: 5px;
        }

        .performance-fill {
            height: 100%;
            transition: width 0.5s ease;
            border-radius: 4px;
        }

        .performance-cpu { background: linear-gradient(90deg, #4ade80, #22c55e); }
        .performance-memory { background: linear-gradient(90deg, #60a5fa, #3b82f6); }
        .performance-disk { background: linear-gradient(90deg, #a78bfa, #8b5cf6); }

        .spark-brand {
            display: inline-block;
            background: linear-gradient(45deg, #ffd700, #ff6b35);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            font-weight: 700;
            text-shadow: none;
        }

        @media (max-width: 768px) {
            .grid {
                grid-template-columns: 1fr;
            }
            
            .info-grid {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>⚡ <span class="spark-brand">SPARK</span></h1>
            <p class="subtitle">Server Power Automated Remote Kontrol</p>
            <p class="acronym">Monitor and control your Ubuntu server's power state</p>
        </div>

        <div class="grid">
            <!-- Server Status Card -->
            <div class="card">
                <div class="card-title">
                    <span class="status-indicator" id="statusIndicator"></span>
                    Server Status
                </div>
                <div class="info-grid">
                    <div class="info-item">
                        <div class="info-label">Status</div>
                        <div class="info-value" id="serverStatus">Checking...</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Last Seen</div>
                        <div class="info-value" id="lastSeen">-</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Response Time</div>
                        <div class="info-value" id="responseTime">-</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Server IP</div>
                        <div class="info-value" id="serverIP">-</div>
                    </div>
                </div>
            </div>

            <!-- SPARK Power Controls Card -->
            <div class="card">
                <div class="card-title">⚡ SPARK Power Controls</div>
                <div style="text-align: center;">
                    <button class="button success" id="wakeBtn" onclick="wakeServer()">
                        🟢 Wake Server
                    </button>
                    <button class="button danger" id="sleepBtn" onclick="sleepServer()">
                        🔴 Sleep Server
                    </button>
                    <button class="button" id="refreshBtn" onclick="refreshStatus()">
                        🔄 Refresh Status
                    </button>
                </div>
                <div id="actionMessage" style="margin-top: 15px; padding: 10px; border-radius: 6px; display: none;"></div>
            </div>

            <!-- Services Status Card -->
            <div class="card">
                <div class="card-title">🔧 Services Status</div>
                <div id="servicesStatus">
                    <div class="service-status">
                        <span class="service-name">Ping</span>
                        <span class="service-badge" id="pingStatus">Unknown</span>
                    </div>
                    <div class="service-status">
                        <span class="service-name">SSH (Port 22)</span>
                        <span class="service-badge" id="sshStatus">Unknown</span>
                    </div>
                    <div class="service-status">
                        <span class="service-name">HTTP (Port 11434)</span>
                        <span class="service-badge" id="httpStatus">Unknown</span>
                    </div>
                    <div class="service-status">
                        <span class="service-name">Ollama API</span>
                        <span class="service-badge" id="ollamaStatus">Unknown</span>
                    </div>
                </div>
            </div>

            <!-- Performance Metrics Card -->
            <div class="card">
                <div class="card-title">📊 Performance Metrics</div>
                <div id="performanceMetrics">
                    <div class="info-item">
                        <div class="info-label">CPU Usage</div>
                        <div class="info-value" id="cpuUsage">-</div>
                        <div class="performance-bar">
                            <div class="performance-fill performance-cpu" id="cpuBar" style="width: 0%"></div>
                        </div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Memory Usage</div>
                        <div class="info-value" id="memoryUsage">-</div>
                        <div class="performance-bar">
                            <div class="performance-fill performance-memory" id="memoryBar" style="width: 0%"></div>
                        </div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Disk Usage</div>
                        <div class="info-value" id="diskUsage">-</div>
                        <div class="performance-bar">
                            <div class="performance-fill performance-disk" id="diskBar" style="width: 0%"></div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- SPARK Configuration Card -->
            <div class="card">
                <div class="card-title">⚙️ SPARK Configuration</div>
                <div id="configInfo">
                    <div class="info-item">
                        <div class="info-label">Target Server IP</div>
                        <div class="info-value" id="configIP">Loading...</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">MAC Address</div>
                        <div class="info-value" id="configMAC">Loading...</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">SSH Port</div>
                        <div class="info-value" id="configSSH">Loading...</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">HTTP Port</div>
                        <div class="info-value" id="configHTTP">Loading...</div>
                    </div>
                </div>
            </div>

            <!-- SPARK System Logs Card -->
            <div class="card full-width">
                <div class="card-title">📋 SPARK System Logs</div>
                <div class="logs-container" id="logsContainer">
                    <div class="log-entry">
                        <span class="log-timestamp">[Loading...]</span>
                        <span class="log-level log-info">[INFO]</span>
                        Initializing SPARK server monitoring...
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script>
        // Initialize Socket.IO connection
        const socket = io();
        let isConnected = false;

        // State management
        let currentStatus = null;
        let logs = [];

        // Initialize the application
        document.addEventListener('DOMContentLoaded', function() {
            initializeApp();
        });

        function initializeApp() {
            loadConfiguration();
            refreshStatus();
            setupSocketListeners();
            startAutoRefresh();
        }

        // Socket.IO event listeners
        function setupSocketListeners() {
            socket.on('connect', () => {
                isConnected = true;
                addLog('info', 'Connected to SPARK server');
                socket.emit('subscribe-status');
            });

            socket.on('disconnect', () => {
                isConnected = false;
                addLog('warn', 'Disconnected from SPARK server');
            });

            socket.on('statusUpdate', (status) => {
                updateServerStatus(status);
            });

            socket.on('error', (error) => {
                addLog('error', `SPARK Error: ${error.message}`);
            });
        }

        // Load server configuration
        async function loadConfiguration() {
            try {
                const response = await fetch('/api/config');
                const config = await response.json();
                
                document.getElementById('configIP').textContent = config.targetServer.ip;
                document.getElementById('configMAC').textContent = config.targetServer.mac;
                document.getElementById('configSSH').textContent = config.targetServer.sshPort;
                document.getElementById('configHTTP').textContent = config.targetServer.httpPort;
                document.getElementById('serverIP').textContent = config.targetServer.ip;
                
            } catch (error) {
                addLog('error', 'Failed to load SPARK configuration');
                console.error('Failed to load configuration:', error);
            }
        }

        // Refresh server status
        async function refreshStatus() {
            try {
                setButtonLoading('refreshBtn', true);
                const response = await fetch('/api/status');
                const status = await response.json();
                updateServerStatus(status);
                addLog('info', 'SPARK status refreshed');
            } catch (error) {
                addLog('error', 'Failed to refresh SPARK status');
                console.error('Failed to refresh status:', error);
            } finally {
                setButtonLoading('refreshBtn', false);
            }
        }

        // Wake server
        async function wakeServer() {
            try {
                setButtonLoading('wakeBtn', true);
                const response = await fetch('/api/wake', { method: 'POST' });
                const result = await response.json();
                
                showActionMessage(result.message, result.success ? 'success' : 'error');
                addLog(result.success ? 'info' : 'error', result.message);
                
                if (result.success) {
                    setTimeout(refreshStatus, 5000); // Check status after 5 seconds
                }
            } catch (error) {
                const message = 'Failed to send SPARK wake command';
                showActionMessage(message, 'error');
                addLog('error', message);
                console.error('Wake server error:', error);
            } finally {
                setButtonLoading('wakeBtn', false);
            }
        }

        // Sleep server
        async function sleepServer() {
            if (!confirm('Are you sure you want to put the server to sleep using SPARK?')) {
                return;
            }

            try {
                setButtonLoading('sleepBtn', true);
                const response = await fetch('/api/sleep', { method: 'POST' });
                const result = await response.json();
                
                showActionMessage(result.message, result.success ? 'success' : 'error');
                addLog(result.success ? 'info' : 'error', result.message);
                
                if (result.success) {
                    setTimeout(refreshStatus, 3000); // Check status after 3 seconds
                }
            } catch (error) {
                const message = 'Failed to send SPARK sleep command';
                showActionMessage(message, 'error');
                addLog('error', message);
                console.error('Sleep server error:', error);
            } finally {
                setButtonLoading('sleepBtn', false);
            }
        }

        // Update server status display
        function updateServerStatus(status) {
            currentStatus = status;
            
            // Update main status
            const statusElement = document.getElementById('serverStatus');
            const indicatorElement = document.getElementById('statusIndicator');
            
            if (status.isOnline) {
                statusElement.textContent = 'Online';
                indicatorElement.className = 'status-indicator status-online';
            } else {
                statusElement.textContent = 'Offline';
                indicatorElement.className = 'status-indicator status-offline';
            }
            
            // Update last seen
            const lastSeenDate = new Date(status.lastSeen);
            document.getElementById('lastSeen').textContent = 
                status.lastSeen === 'Never' ? 'Never' : lastSeenDate.toLocaleString();
            
            // Update response time
            document.getElementById('responseTime').textContent = 
                status.performance.responseTime ? `${status.performance.responseTime}ms` : '-';
            
            // Update services status
            updateServiceStatus('pingStatus', status.services.ping);
            updateServiceStatus('sshStatus', status.services.ssh);
            updateServiceStatus('httpStatus', status.services.http);
            updateServiceStatus('ollamaStatus', status.services.ollama);
            
            // Update performance metrics
            updatePerformanceMetric('cpuUsage', 'cpuBar', status.performance.cpuUsage);
            updatePerformanceMetric('memoryUsage', 'memoryBar', status.performance.memoryUsage);
            updatePerformanceMetric('diskUsage', 'diskBar', status.performance.diskUsage);
        }

        // Update individual service status
        function updateServiceStatus(elementId, isOnline) {
            const element = document.getElementById(elementId);
            if (isOnline) {
                element.textContent = 'Online';
                element.className = 'service-badge badge-online';
            } else {
                element.textContent = 'Offline';
                element.className = 'service-badge badge-offline';
            }
        }

        // Update performance metrics
        function updatePerformanceMetric(valueId, barId, value) {
            const valueElement = document.getElementById(valueId);
            const barElement = document.getElementById(barId);
            
            if (value !== undefined && value !== null) {
                valueElement.textContent = `${value.toFixed(1)}%`;
                barElement.style.width = `${Math.min(value, 100)}%`;
            } else {
                valueElement.textContent = 'N/A';
                barElement.style.width = '0%';
            }
        }

        // Show action message
        function showActionMessage(message, type) {
            const messageElement = document.getElementById('actionMessage');
            messageElement.textContent = message;
            messageElement.style.display = 'block';
            messageElement.className = '';
            
            if (type === 'success') {
                messageElement.style.backgroundColor = '#c6f6d5';
                messageElement.style.color = '#22543d';
                messageElement.style.border = '1px solid #9ae6b4';
            } else if (type === 'error') {
                messageElement.style.backgroundColor = '#fed7d7';
                messageElement.style.color = '#742a2a';
                messageElement.style.border = '1px solid #feb2b2';
            }
            
            // Hide message after 5 seconds
            setTimeout(() => {
                messageElement.style.display = 'none';
            }, 5000);
        }

        // Set button loading state
        function setButtonLoading(buttonId, isLoading) {
            const button = document.getElementById(buttonId);
            if (isLoading) {
                button.disabled = true;
                button.innerHTML = '<span class="loading"></span> Loading...';
            } else {
                button.disabled = false;
                // Restore original button text
                if (buttonId === 'wakeBtn') {
                    button.innerHTML = '🟢 Wake Server';
                } else if (buttonId === 'sleepBtn') {
                    button.innerHTML = '🔴 Sleep Server';
                } else if (buttonId === 'refreshBtn') {
                    button.innerHTML = '🔄 Refresh Status';
                }
            }
        }

        // Add log entry
        function addLog(level, message) {
            const timestamp = new Date().toLocaleTimeString();
            logs.unshift({ timestamp, level, message });
            
            // Keep only last 50 log entries
            if (logs.length > 50) {
                logs = logs.slice(0, 50);
            }
            
            updateLogsDisplay();
        }

        // Update logs display
        function updateLogsDisplay() {
            const logsContainer = document.getElementById('logsContainer');
            logsContainer.innerHTML = logs.map(log => `
                <div class="log-entry">
                    <span class="log-timestamp">[${log.timestamp}]</span>
                    <span class="log-level log-${log.level}">[${log.level.toUpperCase()}]</span>
                    ${log.message}
                </div>
            `).join('');
        }

        // Auto-refresh status every 30 seconds
        function startAutoRefresh() {
            setInterval(() => {
                if (isConnected) {
                    // Socket.IO will handle real-time updates
                    // This is just a fallback
                } else {
                    refreshStatus();
                }
            }, 30000);
        }

        // Initialize logs
        addLog('info', 'SPARK Server Power Manager initialized');
    </script>
</body>
</html>

```

## File: `src/powerManager.ts`

```ts
import wol from 'wake_on_lan';
import { exec } from 'child_process';
import { promisify } from 'util';
import { Logger } from 'winston';

const execAsync = promisify(exec);

export interface ServerConfig {
  ip: string;
  mac: string;
  sshPort: number;
  httpPort: number;
}

export interface PowerResult {
  success: boolean;
  message: string;
  timestamp: string;
}

export class PowerManager {
  constructor(
    private config: ServerConfig,
    private logger: Logger
  ) {}

  async wakeServer(): Promise<PowerResult> {
    return new Promise((resolve) => {
      this.logger.info(`SPARK sending WoL packet to ${this.config.mac}`);
      
      wol.wake(this.config.mac, (error) => {
        const timestamp = new Date().toISOString();
        
        if (error) {
          this.logger.error('SPARK failed to send WoL packet:', error);
          resolve({
            success: false,
            message: `SPARK failed to send Wake-on-LAN packet: ${error.message}`,
            timestamp
          });
        } else {
          this.logger.info('SPARK WoL packet sent successfully');
          resolve({
            success: true,
            message: 'SPARK Wake-on-LAN packet sent successfully. Server should wake up within 30-60 seconds.',
            timestamp
          });
        }
      });
    });
  }

  async sleepServer(): Promise<PowerResult> {
    const timestamp = new Date().toISOString();
    
    try {
      this.logger.info(`SPARK attempting to put server ${this.config.ip} to sleep`);
      
      // Get username from environment or default to 'james'
      const username = process.env.SSH_USERNAME || 'james';
      
      // First, get the correct network interface name
      const getInterfaceCommand = `ip route | grep default | awk '{print $5}' | head -1`;
      
      // Try multiple sleep methods in order of preference
      const sleepMethods = [
        // Method 1: Use the dedicated sleep script if it exists
        `test -f /home/${username}/sleep-hard.sh && sudo /home/${username}/sleep-hard.sh`,
        
        // Method 2: Disable specific wake sources found on your system
        `sudo ethtool -s enp34s0 wol g; for device in GPP8 GP12 GP13 XHC0 GPP2 PT21 PTXH; do echo $device | sudo tee /proc/acpi/wakeup > /dev/null 2>&1; done; sudo systemctl suspend`,
        
        // Method 3: Try hibernate instead of suspend
        `sudo ethtool -s enp34s0 wol g; for device in GPP8 GP12 GP13 XHC0 GPP2 PT21 PTXH; do echo $device | sudo tee /proc/acpi/wakeup > /dev/null 2>&1; done; sudo systemctl hibernate`,
        
        // Method 4: Force suspend using /sys/power/state
        `sudo ethtool -s enp34s0 wol g; echo mem | sudo tee /sys/power/state`,
        
        // Method 5: Traditional suspend command
        `sudo systemctl suspend`,
        
        // Method 6: Shutdown as fallback (can still wake with WoL)
        `sudo ethtool -s enp34s0 wol g; sudo shutdown -h now`
      ];
      
      for (let i = 0; i < sleepMethods.length; i++) {
        const method = sleepMethods[i];
        const sshCommand = `ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no -o BatchMode=yes -p ${this.config.sshPort} ${username}@${this.config.ip} "${method}"`;
        
        this.logger.info(`SPARK trying power method ${i + 1}: ${method.includes('shutdown') ? 'shutdown with WoL' : method.includes('suspend') ? 'suspend' : 'other'}`);
        
        try {
          const { stdout, stderr } = await execAsync(sshCommand);
          if (stdout) this.logger.info(`SPARK method ${i + 1} output: ${stdout.trim()}`);
          if (stderr) this.logger.warn(`SPARK method ${i + 1} stderr: ${stderr.trim()}`);
          
          this.logger.info(`SPARK power command sent via SSH (method ${i + 1})`);
          
          // For shutdown methods, we expect the connection to drop
          if (method.includes('shutdown')) {
            this.logger.info('SPARK shutdown command sent, server should be powering down...');
            return {
              success: true,
              message: `SPARK shutdown command sent successfully. Server will power down and can be woken with Wake-on-LAN.`,
              timestamp
            };
          }
          
          // For suspend methods, wait and check if it actually worked
          await new Promise(resolve => setTimeout(resolve, 5000));
          
          const isStillOnline = await this.isServerReachable();
          if (!isStillOnline) {
            return {
              success: true,
              message: `SPARK power command sent successfully via SSH (method ${i + 1})`,
              timestamp
            };
          } else {
            this.logger.warn(`SPARK power method ${i + 1} failed - server still online, trying next method`);
            if (i === sleepMethods.length - 1) {
              break;
            }
            continue;
          }
        } catch (sshError: any) {
          // For shutdown commands, SSH connection drops are expected and indicate success
          if (method.includes('shutdown') && (
            sshError.message.includes('Connection closed') ||
            sshError.message.includes('Connection reset') ||
            sshError.message.includes('Connection refused') ||
            sshError.code === 'ECONNRESET' ||
            sshError.code === 'ENOTFOUND'
          )) {
            this.logger.info('SPARK shutdown successful - SSH connection dropped as expected');
            return {
              success: true,
              message: 'SPARK shutdown command sent successfully. Server is powering down and can be woken with Wake-on-LAN.',
              timestamp
            };
          }
          
          this.logger.warn(`SPARK SSH power method ${i + 1} failed:`, sshError.message);
          if (i === sleepMethods.length - 1) {
            return {
              success: false,
              message: 'SPARK power command failed. All SSH methods exhausted. Check SSH access and sudo permissions.',
              timestamp
            };
          }
          continue;
        }
      }
      
      return {
        success: false,
        message: 'SPARK sleep command sent but server is still responding. Check BIOS Wake-on-LAN settings.',
        timestamp
      };
      
    } catch (error) {
      this.logger.error('SPARK failed to put server to sleep:', error);
      return {
        success: false,
        message: `SPARK failed to put server to sleep: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp
      };
    }
  }

  async isServerReachable(): Promise<boolean> {
    try {
      // Test both ping and HTTP service
      const pingCommand = `ping -c 1 -W 3 ${this.config.ip}`;
      await execAsync(pingCommand);
      
      // Test if Ollama service is responding
      const curlCommand = `curl -s --connect-timeout 5 http://${this.config.ip}:${this.config.httpPort}/api/tags`;
      await execAsync(curlCommand);
      
      return true;
    } catch {
      return false;
    }
  }

  async testConnection(): Promise<{
    ping: boolean;
    ssh: boolean;
    http: boolean;
    ollama: boolean;
  }> {
    const results = {
      ping: false,
      ssh: false,
      http: false,
      ollama: false
    };

    // Test ping
    try {
      await execAsync(`ping -c 1 -W 3 ${this.config.ip}`);
      results.ping = true;
    } catch {}

    // Test SSH
    try {
      await execAsync(`nc -z -w3 ${this.config.ip} ${this.config.sshPort}`);
      results.ssh = true;
    } catch {}

    // Test HTTP
    try {
      await execAsync(`nc -z -w3 ${this.config.ip} ${this.config.httpPort}`);
      results.http = true;
    } catch {}

    // Test Ollama API
    try {
      await execAsync(`curl -s --connect-timeout 3 http://${this.config.ip}:${this.config.httpPort}/api/tags`);
      results.ollama = true;
    } catch {}

    return results;
  }

  // New method to check and fix WoL settings
  async fixWakeOnLanSettings(): Promise<PowerResult> {
    const timestamp = new Date().toISOString();
    const username = process.env.SSH_USERNAME || 'james';
    
    try {
      this.logger.info('SPARK checking and fixing Wake-on-LAN settings');
      
      const commands = [
        // Check current WoL settings
        'sudo ethtool eth0',
        // Set WoL to magic packet only
        'sudo ethtool -s eth0 wol g',
        // Disable USB wake sources
        'echo USB0 | sudo tee /proc/acpi/wakeup > /dev/null 2>&1 || true',
        'echo USB1 | sudo tee /proc/acpi/wakeup > /dev/null 2>&1 || true',
        'echo USB2 | sudo tee /proc/acpi/wakeup > /dev/null 2>&1 || true',
        // Show current wake sources
        'cat /proc/acpi/wakeup'
      ];
      
      for (const command of commands) {
        const sshCommand = `ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no -p ${this.config.sshPort} ${username}@${this.config.ip} "${command}"`;
        try {
          const { stdout } = await execAsync(sshCommand);
          this.logger.info(`SPARK WoL fix output: ${stdout.trim()}`);
        } catch (error) {
          this.logger.warn(`SPARK WoL fix command failed: ${command}`);
        }
      }
      
      return {
        success: true,
        message: 'SPARK Wake-on-LAN settings updated. Check logs for details.',
        timestamp
      };
      
    } catch (error) {
      this.logger.error('SPARK failed to fix WoL settings:', error);
      return {
        success: false,
        message: `SPARK failed to fix WoL settings: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp
      };
    }
  }
}
```

## File: `src/server.ts`

```ts
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import winston from 'winston';
import { PowerManager } from './powerManager';
import { ServerMonitor } from './serverMonitor';

dotenv.config();

// Logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/spark.log' })
  ]
});

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? false : "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(helmet({
  contentSecurityPolicy: false // Disable for development
}));
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Configuration
const config = {
  targetServer: {
    ip: process.env.TARGET_SERVER_IP || '192.168.1.100',
    mac: process.env.TARGET_SERVER_MAC || '00:11:22:33:44:55',
    sshPort: parseInt(process.env.TARGET_SERVER_SSH_PORT || '22'),
    httpPort: parseInt(process.env.TARGET_SERVER_HTTP_PORT || '11434') // Ollama default
  },
  monitoring: {
    pingInterval: parseInt(process.env.PING_INTERVAL || '5000'),
    healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '10000')
  }
};

// Initialize services
const powerManager = new PowerManager(config.targetServer, logger);
const serverMonitor = new ServerMonitor(config.targetServer, config.monitoring, logger);

// API Routes
app.get('/api/status', async (req, res) => {
  try {
    const status = await serverMonitor.getServerStatus();
    res.json(status);
  } catch (error) {
    logger.error('Error getting server status:', error);
    res.status(500).json({ error: 'Failed to get server status' });
  }
});

app.post('/api/wake', async (req, res) => {
  try {
    logger.info('SPARK wake request received');
    const result = await powerManager.wakeServer();
    res.json(result);
  } catch (error) {
    logger.error('Error waking server:', error);
    res.status(500).json({ error: 'Failed to wake server' });
  }
});

app.post('/api/sleep', async (req, res) => {
  try {
    logger.info('SPARK sleep request received');
    const result = await powerManager.sleepServer();
    res.json(result);
  } catch (error) {
    logger.error('Error putting server to sleep:', error);
    res.status(500).json({ error: 'Failed to put server to sleep' });
  }
});

app.get('/api/logs', (req, res) => {
  try {
    // In a real implementation, you'd read from log files
    // For now, return recent log entries
    res.json({
      logs: [
        { timestamp: new Date().toISOString(), level: 'info', message: 'SPARK server monitoring active' }
      ]
    });
  } catch (error) {
    logger.error('Error getting logs:', error);
    res.status(500).json({ error: 'Failed to get logs' });
  }
});

app.get('/api/config', (req, res) => {
  res.json({
    targetServer: {
      ip: config.targetServer.ip,
      mac: config.targetServer.mac,
      sshPort: config.targetServer.sshPort,
      httpPort: config.targetServer.httpPort
    },
    monitoring: config.monitoring
  });
});

// Socket.IO for real-time updates
io.on('connection', (socket) => {
  logger.info('SPARK client connected');
  
  socket.on('subscribe-status', () => {
    logger.info('Client subscribed to SPARK status updates');
  });
  
  socket.on('disconnect', () => {
    logger.info('SPARK client disconnected');
  });
});

// Start monitoring and emit updates
serverMonitor.on('statusUpdate', (status) => {
  io.emit('statusUpdate', status);
});

serverMonitor.on('error', (error) => {
  logger.error('SPARK monitor error:', error);
  io.emit('error', { message: error.message });
});

// Start monitoring
serverMonitor.start();

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down SPARK gracefully');
  serverMonitor.stop();
  server.close(() => {
    logger.info('SPARK server closed');
    process.exit(0);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  logger.info(`SPARK server running on port ${PORT}`);
  logger.info(`Target server: ${config.targetServer.ip} (${config.targetServer.mac})`);
});

```

## File: `src/serverMonitor.ts`

```ts
import { EventEmitter } from 'events';
import ping from 'ping';
import { Logger } from 'winston';
import { ServerConfig } from './powerManager';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface ServerStatus {
  isOnline: boolean;
  lastSeen: string;
  uptime: number;
  services: {
    ping: boolean;
    ssh: boolean;
    http: boolean;
    ollama: boolean;
  };
  performance: {
    responseTime: number;
    cpuUsage?: number;
    memoryUsage?: number;
    diskUsage?: number;
  };
  timestamp: string;
}

export class ServerMonitor extends EventEmitter {
  private monitoring = false;
  private pingInterval?: NodeJS.Timeout;
  private healthInterval?: NodeJS.Timeout;
  private lastStatus: ServerStatus;

  constructor(
    private config: ServerConfig,
    private monitoringConfig: { pingInterval: number; healthCheckInterval: number },
    private logger: Logger
  ) {
    super();
    
    this.lastStatus = {
      isOnline: false,
      lastSeen: 'Never',
      uptime: 0,
      services: {
        ping: false,
        ssh: false,
        http: false,
        ollama: false
      },
      performance: {
        responseTime: 0
      },
      timestamp: new Date().toISOString()
    };
  }

  start(): void {
    if (this.monitoring) return;
    
    this.monitoring = true;
    this.logger.info('Starting SPARK server monitoring');
    
    // Start ping monitoring
    this.pingInterval = setInterval(async () => {
      await this.checkPing();
    }, this.monitoringConfig.pingInterval);
    
    // Start comprehensive health checks
    this.healthInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, this.monitoringConfig.healthCheckInterval);
    
    // Initial checks
    this.checkPing();
    this.performHealthCheck();
  }

  stop(): void {
    if (!this.monitoring) return;
    
    this.monitoring = false;
    this.logger.info('Stopping SPARK server monitoring');
    
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = undefined;
    }
    
    if (this.healthInterval) {
      clearInterval(this.healthInterval);
      this.healthInterval = undefined;
    }
  }

  async getServerStatus(): Promise<ServerStatus> {
    return { ...this.lastStatus };
  }

  private async checkPing(): Promise<void> {
    try {
      const startTime = Date.now();
      const result = await ping.promise.probe(this.config.ip, {
        timeout: 3,
        extra: ['-c', '1']
      });
      
      const responseTime = Date.now() - startTime;
      const wasOnline = this.lastStatus.isOnline;
      const isOnline = result.alive;
      
      if (isOnline !== wasOnline) {
        this.logger.info(`SPARK server ${this.config.ip} is now ${isOnline ? 'online' : 'offline'}`);
      }
      
      this.lastStatus.isOnline = isOnline;
      this.lastStatus.performance.responseTime = responseTime;
      this.lastStatus.services.ping = isOnline;
      
      if (isOnline) {
        this.lastStatus.lastSeen = new Date().toISOString();
      }
      
      this.lastStatus.timestamp = new Date().toISOString();
      this.emit('statusUpdate', this.lastStatus);
      
    } catch (error) {
      this.logger.error('SPARK ping check failed:', error);
      this.lastStatus.isOnline = false;
      this.lastStatus.services.ping = false;
      this.lastStatus.timestamp = new Date().toISOString();
      this.emit('statusUpdate', this.lastStatus);
    }
  }

  private async performHealthCheck(): Promise<void> {
    if (!this.lastStatus.isOnline) return;
    
    try {
      const services = await this.checkServices();
      const performance = await this.getPerformanceMetrics();
      
      this.lastStatus.services = { ...this.lastStatus.services, ...services };
      this.lastStatus.performance = { ...this.lastStatus.performance, ...performance };
      this.lastStatus.timestamp = new Date().toISOString();
      
      this.emit('statusUpdate', this.lastStatus);
      
    } catch (error) {
      this.logger.error('SPARK health check failed:', error);
      this.emit('error', error);
    }
  }

  private async checkServices(): Promise<Partial<ServerStatus['services']>> {
    const services: Partial<ServerStatus['services']> = {};
    
    // Check SSH
    try {
      await execAsync(`nc -z -w3 ${this.config.ip} ${this.config.sshPort}`);
      services.ssh = true;
    } catch {
      services.ssh = false;
    }
    
    // Check HTTP port
    try {
      await execAsync(`nc -z -w3 ${this.config.ip} ${this.config.httpPort}`);
      services.http = true;
    } catch {
      services.http = false;
    }
    
    // Check Ollama API
    try {
      const { stdout } = await execAsync(`curl -s --connect-timeout 3 --max-time 5 http://${this.config.ip}:${this.config.httpPort}/api/tags`);
      services.ollama = stdout.includes('models') || stdout.includes('[') || stdout.includes('{');
    } catch {
      services.ollama = false;
    }
    
    return services;
  }

  private async getPerformanceMetrics(): Promise<Partial<ServerStatus['performance']>> {
    const performance: Partial<ServerStatus['performance']> = {};
    
    try {
      // Try to get system info via SSH (requires SSH access)
      const sshCommand = `ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no -p ${this.config.sshPort} user@${this.config.ip}`;
      
      // CPU usage
      try {
        const { stdout: cpuOutput } = await execAsync(`${sshCommand} "top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | cut -d'%' -f1"`);
        performance.cpuUsage = parseFloat(cpuOutput.trim());
      } catch {
        // SSH not available or no access
      }
      
      // Memory usage
      try {
        const { stdout: memOutput } = await execAsync(`${sshCommand} "free | grep Mem | awk '{printf \"%.1f\", $3/$2 * 100.0}'"`);
        performance.memoryUsage = parseFloat(memOutput.trim());
      } catch {
        // SSH not available or no access
      }
      
      // Disk usage
      try {
        const { stdout: diskOutput } = await execAsync(`${sshCommand} "df -h / | awk 'NR==2{printf \"%s\", $5}' | cut -d'%' -f1"`);
        performance.diskUsage = parseFloat(diskOutput.trim());
      } catch {
        // SSH not available or no access
      }
      
    } catch (error) {
      // SSH metrics not available
      this.logger.debug('SPARK performance metrics via SSH not available');
    }
    
    return performance;
  }

  private calculateUptime(): number {
    // This would need to be implemented based on your specific requirements
    // Could track time since last wake, or query the actual system uptime
    return 0;
  }
}

```

## File: `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": false,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "moduleResolution": "node",
    "allowSyntheticDefaultImports": true,
    "resolveJsonModule": true,
    "noImplicitAny": false
  },
  "include": [
    "src/**/*.ts"
  ],
  "exclude": [
    "node_modules",
    "dist",
    "**/*.test.ts",
    "types",
    "src/types"
  ]
}
```

---
*End of Report*