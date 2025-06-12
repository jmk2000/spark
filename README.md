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
