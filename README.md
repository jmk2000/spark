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

### How It Works

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

### Troubleshooting Health Checks

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

### Why This Matters

Without proper health checks, SPARK might forward requests to a service that has started its HTTP server but hasn't fully loaded its models or initialized its components. This commonly happens with:

- **LLM servers** loading large language models
- **Media servers** scanning library content  
- **AI services** initializing GPU resources
- **Databases** performing recovery operations

The configurable health check system ensures your requests only go through when the service is truly ready to handle them.