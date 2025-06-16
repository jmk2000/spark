# SPARK - Server Power Automated Remote Kontrol

![SPARK Banner](https://img.shields.io/badge/SPARK-Server%20Power%20Automated%20Remote%20Kontrol-blue?style=for-the-badge&logo=bolt)

SPARK is a smart power-saving proxy for your home server. It acts as a transparent gateway, automatically waking your target server (e.g., a machine running an LLM, a media server, or any other HTTP service) when a request comes in, and putting it to sleep when it's idle.

Save energy without sacrificing convenience. Point your applications at SPARK, and it handles the rest.

---

## 🚀 Features

### Core Functionality
- **Transparent HTTP Proxy**: No need to change your client applications. Point them at SPARK's address, and it intelligently wakes and forwards requests to your target server.
- **Wake-on-LAN & Remote Sleep**: Manually wake and sleep your server from a clean web interface.
- **Real-time Status Monitoring**: Live updates of server status, services, and performance metrics.

### Intelligent Power Management
- **Configurable Idle Shutdown**: Automatically put the server to sleep based on inactivity.
  - **Request-Based Timer**: Shuts down after a configurable period of no HTTP requests.
  - **Optional GPU Monitoring**: For ML/LLM servers, you can add GPU utilization as a second condition for the shutdown timer.
  - **Environment Defaults**: Configure default idle shutdown settings via environment variables.

### Service-Agnostic Health Checks
- **Configurable Health Endpoints**: Define custom health check paths and methods for any HTTP service.
- **Smart Readiness Detection**: Uses exponential backoff to detect when services are truly ready to handle requests.
- **Flexible Success Criteria**: Configure which HTTP status codes indicate a healthy service.
- **Race Condition Prevention**: Ensures requests are only forwarded when the target service is fully operational.

### Modern Web Dashboard
- **Real-time Performance Metrics**: Monitor CPU, Memory, Disk I/O, GPU, and VRAM usage.
- **Service Status Monitoring**: Track ping, SSH, HTTP port, and target HTTP service status.
- **Live System Logs**: View real-time logs with emoji indicators and timestamps.
- **Responsive Design**: Works seamlessly on desktop and mobile devices.
- **Modern UI**: Clean, animated interface with glassmorphism design.

### Easy Deployment
- **Dockerized Setup**: Simple, container-based deployment using Docker Compose.
- **Environment Configuration**: All settings configurable via `.env` file.
- **Debug Logging**: Configurable performance monitoring logs for troubleshooting.

---

## 🎯 Use Cases

- **LLM & AI Servers**: Power down GPU-intensive machines (running Ollama, Llama.cpp, etc.) when not in use, and wake them on demand.
- **Development Servers**: Keep your dev server asleep until you make your first API call.
- **Home Media Servers**: Run your Plex or Jellyfin server only when you're actively using it.
- **Any On-Demand HTTP Service**: Perfect for any service that doesn't need to be running 24/7.

---

## 🔧 Installation

SPARK is designed to be deployed as a Docker container, often on a low-power, always-on device like a Raspberry Pi.

### Prerequisites

- Docker & Docker Compose
- A target server with Wake-on-LAN enabled in its BIOS/UEFI
- Git

### 1. Clone the Repository

```bash
git clone https://github.com/jmk2000/spark.git
cd spark
```

### 2. Create SSH Keys

SPARK needs SSH access to put your target server to sleep and monitor performance metrics. Create a dedicated SSH key for this:

```bash
# Create a directory to hold the keys
mkdir -p ./.ssh

# Generate the key pair (press Enter for all prompts to use no passphrase)
ssh-keygen -t rsa -b 4096 -f ./.ssh/id_rsa
```

### 3. Configure Your Environment

Copy the example environment file and edit it with your specific details:

```bash
cp .env.example .env
nano .env
```

**Required settings:**
- `TARGET_SERVER_IP`: IP address of your target server
- `TARGET_SERVER_MAC`: MAC address for Wake-on-LAN
- `SSH_USERNAME`: Username for SSH connections

**Health Check settings (important for service compatibility):**
- `TARGET_HEALTH_CHECK_PATH`: Endpoint to check for service readiness
- `TARGET_HEALTH_CHECK_METHOD`: HTTP method for health checks
- `TARGET_HEALTH_CHECK_SUCCESS_CODES`: Status codes indicating healthy service

**Optional settings:**
- `AUTO_SLEEP_ENABLED`: Enable idle shutdown by default (true/false)
- `AUTO_SLEEP_MINUTES`: Default idle duration in minutes
- `AUTO_SLEEP_MONITOR_GPU`: Include GPU monitoring in idle decisions
- `ENABLE_PERFORMANCE_DEBUG`: Enable detailed performance logging

### 4. Authorize the SSH Key

Copy the contents of the public key:

```bash
cat ./.ssh/id_rsa.pub
```

SSH into your **target server** and add this key to the authorized keys file:

```bash
# On your target server
echo "your-public-key-content-here" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

### 5. Configure Target Server Permissions

The SSH user on the target server needs passwordless `sudo` access for power management and performance monitoring:

```bash
# On your target server, run as root or with sudo
sudo visudo
```

Add this line at the end (replace `your-ssh-username` with your actual username):

```
your-ssh-username ALL=(ALL) NOPASSWD: /usr/bin/systemctl, /usr/sbin/ethtool
```

### 6. Build and Deploy SPARK

```bash
docker-compose up -d --build
```

Access the SPARK web interface by navigating to `http://your-spark-host:3000`.

---

## 💡 Usage

### Transparent Proxy

To use the proxy, simply point your client applications to SPARK instead of your target server:

- **Before:** `curl http://target-server:11434/api/generate ...`
- **After:** `curl http://spark-host:3000/api/generate ...`

SPARK will intercept the request, wake the target server if needed, wait for the service to be ready, and forward the request seamlessly.

### Power Management

- **Manual Control**: Use the Wake Server and Sleep Server buttons in the web interface
- **Automatic Idle Shutdown**: Configure in the web interface or via environment variables
  - Set idle duration (5-60 minutes)
  - Optionally include GPU utilization monitoring
  - Real-time countdown when idle period is active

### Performance Monitoring

The dashboard provides real-time metrics:
- **CPU Usage**: Current processor utilization
- **Memory Usage**: RAM utilization with used/total display
- **Disk I/O**: Storage activity percentage
- **GPU Usage**: Graphics processor utilization (if available)
- **VRAM Usage**: GPU memory with used/total display (e.g., "12.5% (3.0GB/24GB)")

### Service Status

Monitor the health of all components:
- **Ping**: Basic network connectivity
- **SSH**: Secure shell access for power management
- **Target Port**: HTTP port accessibility
- **Target HTTP Service**: Actual service responsiveness using configured health checks

---

## ⚙️ Configuration

### Environment Variables

All configuration is handled through the `.env` file:

```bash
# Target Server
TARGET_SERVER_IP=192.168.1.100
TARGET_SERVER_MAC=aa:bb:cc:dd:ee:ff
SSH_USERNAME=your-username
TARGET_SERVER_SSH_PORT=22
TARGET_SERVER_HTTP_PORT=11434

# Health Check Configuration
TARGET_HEALTH_CHECK_PATH=/api/tags
TARGET_HEALTH_CHECK_METHOD=GET
TARGET_HEALTH_CHECK_TIMEOUT=5000
TARGET_HEALTH_CHECK_SUCCESS_CODES=200

# Proxy Timing
PROXY_WAKE_TIMEOUT=180
PROXY_REQUEST_TIMEOUT=300
SERVICE_READINESS_BUFFER_MS=1000

# SPARK Settings
PORT=3000
LOG_LEVEL=info

# Auto-Sleep Defaults
AUTO_SLEEP_ENABLED=true
AUTO_SLEEP_MINUTES=15
AUTO_SLEEP_MONITOR_GPU=false
AUTO_SLEEP_IDLE_MINUTES=5
AUTO_SLEEP_GPU_THRESHOLD=5

# Debug Settings
ENABLE_PERFORMANCE_DEBUG=false
```

## 🏥 Service Health Check Configuration

SPARK uses configurable health checks to determine when your target service is ready to handle requests. This ensures that proxy requests are only sent after the service has fully started and is responding properly.

### Health Check Settings

Configure these in your `.env` file to match your specific service:

```bash
# Health check endpoint - the path SPARK will check for service readiness
TARGET_HEALTH_CHECK_PATH=/api/tags

# HTTP method to use for health checks
TARGET_HEALTH_CHECK_METHOD=GET

# Timeout for health check requests (milliseconds)
TARGET_HEALTH_CHECK_TIMEOUT=5000

# HTTP status codes that indicate a healthy service
TARGET_HEALTH_CHECK_SUCCESS_CODES=200-299
```

### Common Service Configurations

**Ollama LLM Server:**
```bash
TARGET_HEALTH_CHECK_PATH=/api/tags
TARGET_HEALTH_CHECK_METHOD=GET
TARGET_HEALTH_CHECK_SUCCESS_CODES=200
```

**Stable Diffusion WebUI:**
```bash
TARGET_HEALTH_CHECK_PATH=/internal/ping
TARGET_HEALTH_CHECK_METHOD=GET
TARGET_HEALTH_CHECK_SUCCESS_CODES=200
```

**Plex Media Server:**
```bash
TARGET_HEALTH_CHECK_PATH=/web/index.html
TARGET_HEALTH_CHECK_METHOD=HEAD
TARGET_HEALTH_CHECK_SUCCESS_CODES=200,302
```

**Generic Web Server:**
```bash
TARGET_HEALTH_CHECK_PATH=/
TARGET_HEALTH_CHECK_METHOD=HEAD
TARGET_HEALTH_CHECK_SUCCESS_CODES=200-299,404
```

**Custom API with dedicated health endpoint:**
```bash
TARGET_HEALTH_CHECK_PATH=/api/health
TARGET_HEALTH_CHECK_METHOD=GET
TARGET_HEALTH_CHECK_SUCCESS_CODES=200
```

### How Health Checks Work

1. **Immediate Check**: When a proxy request comes in, SPARK first checks if the service is immediately available
2. **Wake if Needed**: If the service isn't ready, SPARK wakes the server (if needed) and waits
3. **Readiness Monitoring**: SPARK repeatedly checks the configured health endpoint using exponential backoff
4. **Buffer Period**: Once the service responds correctly, SPARK waits for a configurable buffer period to ensure stability
5. **Request Forwarding**: Only then does SPARK forward your original request

### Advanced Configuration

```bash
# Maximum time to wait for service to become ready after wake-up
PROXY_WAKE_TIMEOUT=180

# Buffer delay after service becomes ready (ensures stability)
SERVICE_READINESS_BUFFER_MS=1000

# Maximum time for the actual proxy request (important for LLM responses)
PROXY_REQUEST_TIMEOUT=300
```

### Web Interface Configuration

All settings can be adjusted in real-time through the web interface:
- Enable/disable idle shutdown
- Adjust idle duration with a slider
- Toggle GPU monitoring
- View configuration details

---

## 🐳 Docker Configuration

### Docker Compose

The included `docker-compose.yml` provides:
- Port mapping for web interface (3000)
- SSH key volume mounting
- Environment variable configuration
- Network capabilities for Wake-on-LAN
- Log directory mounting

### Network Requirements

SPARK requires:
- **NET_RAW and NET_ADMIN capabilities** for Wake-on-LAN packets
- **Bridge network mode** for web interface accessibility
- **SSH access** to target server for power management

---

## 🔍 Troubleshooting

### Diagnostic Script

Run the built-in diagnostic script to test connectivity:

```bash
docker-compose exec spark /app/test-monitoring.sh
```

This will test:
- Ping connectivity
- SSH port accessibility
- HTTP service availability
- SSH authentication
- Performance metric commands

### Health Check Troubleshooting

Enable debug logging to see health check details:

```bash
ENABLE_PERFORMANCE_DEBUG=true
LOG_LEVEL=debug
```

This will show detailed logs like:
```
Health check: GET http://192.168.1.100:11434/api/tags (timeout: 5000ms)
Health check response: 200 (healthy: true)
Service became ready after 23 seconds (8 attempts) - HTTP 200
```

### Common Issues

1. **Wake-on-LAN not working**: Ensure WoL is enabled in target server BIOS/UEFI
2. **SSH connection fails**: Check SSH key authorization and user permissions
3. **Performance metrics showing N/A**: Verify SSH access and user sudo permissions
4. **Service status offline**: Check network connectivity and firewall settings
5. **Proxy requests failing**: Verify health check configuration matches your service
6. **Race conditions**: Ensure health check endpoint returns success only when service is fully ready

### Debug Logging

Enable detailed logging for troubleshooting:

```bash
# In your .env file
ENABLE_PERFORMANCE_DEBUG=true
LOG_LEVEL=debug

# Restart container
docker-compose restart spark

# View logs
docker-compose logs -f spark
```

### Testing the Proxy

Use the included test script to verify proxy functionality:

```bash
# Make the script executable
chmod +x test-proxy.sh

# Test with a simple prompt
./test-proxy.sh "Tell me a fun fact about space."

# Test with custom timeout for longer responses
TEST_TIMEOUT=600 ./test-proxy.sh "Write a detailed story about space exploration."
```

---

## 📊 Performance Requirements

### SPARK Host Requirements
- **Minimal resources**: 100MB RAM, minimal CPU
- **Always-on capability**: Raspberry Pi 4, Intel NUC, or similar
- **Network access**: Same subnet as target server preferred
- **Docker support**: Docker and Docker Compose

### Target Server Requirements
- **Wake-on-LAN support**: Enabled in BIOS/UEFI
- **SSH server**: OpenSSH with key-based authentication
- **Sudo access**: For power management commands
- **Network connectivity**: Reachable from SPARK host
- **Health endpoint**: Configured service endpoint that indicates readiness

---

## 🛡️ Security Considerations

- **SSH key authentication**: Uses dedicated SSH keys (no password auth)
- **Limited sudo access**: Only specific commands (systemctl, ethtool)
- **Network isolation**: Can be deployed in isolated network segments
- **No external dependencies**: All communication is local network only
- **Health check security**: Only configured endpoints are accessed for health checks

---

## 🤝 Contributing

Contributions are welcome! Please feel free to:
- Fork the repository
- Create a feature branch
- Make your changes
- Submit a pull request

### Development Setup

1. Clone the repository
2. Copy `.env.example` to `.env` and configure
3. Run `npm install` for development dependencies
4. Use `npm run dev` for development mode with hot reload

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🔗 Links

- **GitHub Repository**: [https://github.com/your-username/spark](https://github.com/your-username/spark)
- **Documentation**: See README.md and inline code comments

---

**Made with ⚡ for efficient home server management**

*SPARK v1.0 - The complete power management solution for your home lab*