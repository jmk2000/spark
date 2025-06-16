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
import fetch, { Headers } from 'node-fetch';
import { promises as fs } from 'fs';

dotenv.config();

// Ensure logs directory exists
(async () => {
  try {
    await fs.mkdir('logs', { recursive: true });
  } catch (error) {
    console.warn('Could not create logs directory:', error);
  }
})();

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({ 
      filename: 'logs/spark.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ]
});

const app = express();
const server = createServer(app);
const io = new Server(server, { 
  cors: { origin: "*", methods: ["GET", "POST"] },
  transports: ['websocket', 'polling']
});

// Security middleware
app.use(helmet({ 
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false 
}));
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  logger.debug(`${req.method} ${req.path} - ${req.ip}`);
  next();
});

const config = {
  targetServer: {
    ip: process.env.TARGET_SERVER_IP || '192.168.1.100',
    mac: process.env.TARGET_SERVER_MAC || '00:11:22:33:44:55',
    sshPort: parseInt(process.env.TARGET_SERVER_SSH_PORT || '22'),
    httpPort: parseInt(process.env.TARGET_SERVER_HTTP_PORT || '11434')
  },
  monitoring: { 
    pingInterval: 5000, 
    healthCheckInterval: 5000 
  },
  autoSleep: {
    gpuThreshold: parseInt(process.env.AUTO_SLEEP_GPU_THRESHOLD || '5'),
    idleMinutes: parseInt(process.env.AUTO_SLEEP_IDLE_MINUTES || '5'),
  }
};

// Validate configuration
if (!config.targetServer.ip || !config.targetServer.mac) {
  logger.error('Missing required configuration: TARGET_SERVER_IP and TARGET_SERVER_MAC must be set');
  process.exit(1);
}

logger.info('SPARK Configuration:', {
  targetIP: config.targetServer.ip,
  targetMAC: config.targetServer.mac,
  sshPort: config.targetServer.sshPort,
  httpPort: config.targetServer.httpPort
});

const powerManager = new PowerManager(config.targetServer, logger);
const serverMonitor = new ServerMonitor(
  config.targetServer, 
  config.monitoring, 
  config.autoSleep, 
  powerManager, 
  logger
);

// Enhanced proxy middleware with proper timeout handling for node-fetch v2
const proxyMiddleware = async (req, res, next) => {
  const sparkInternalPaths = ['/', '/api/status', '/api/wake', '/api/sleep', '/api/config', '/api/config/autosleep'];
  
  if (sparkInternalPaths.includes(req.path) || req.path.startsWith('/socket.io')) {
    return next();
  }

  // Record activity for auto-sleep
  serverMonitor.recordActivity();
  
  const targetPath = req.originalUrl.startsWith('/') ? req.originalUrl.substring(1) : req.originalUrl;
  const targetUrl = `http://${config.targetServer.ip}:${config.targetServer.httpPort}/${targetPath}`;
  const WAKE_TIMEOUT_SECONDS = 180;
  const PROXY_TIMEOUT_SECONDS = 300; // 5 minutes for LLM responses

  try {
    logger.info(`Transparent proxy triggered for [${req.method}] ${req.originalUrl}`);
    let status = await serverMonitor.getServerStatus();

    // Check if target service is available
    if (!status.services.targetHttp) {
      logger.info('Target HTTP service not online. Attempting to wake server...');
      
      // Wake server if not online
      if (!status.isOnline) {
        const wakeResult = await powerManager.wakeServer();
        if (!wakeResult.success) {
          throw new Error(`Failed to wake server: ${wakeResult.message}`);
        }
        logger.info('Wake-on-LAN packet sent, waiting for server to boot...');
      }

      // Wait for service to become available
      const startTime = Date.now();
      let isReady = false;
      let attempts = 0;
      const maxAttempts = Math.floor(WAKE_TIMEOUT_SECONDS / 5);

      while (Date.now() - startTime < WAKE_TIMEOUT_SECONDS * 1000 && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        status = await serverMonitor.getServerStatus();
        attempts++;
        
        logger.debug(`Wake attempt ${attempts}/${maxAttempts} - Service available: ${status.services.targetHttp}`);
        
        if (status.services.targetHttp) { 
          isReady = true; 
          break; 
        }
      }

      if (!isReady) {
        throw new Error(`Server wake-up timed out after ${WAKE_TIMEOUT_SECONDS} seconds`);
      }
      
      logger.info(`Server is ready after ${Math.round((Date.now() - startTime) / 1000)} seconds`);
    }

    // Prepare request body
    const body = (req.method !== 'GET' && req.method !== 'HEAD' && Object.keys(req.body || {}).length > 0) 
      ? JSON.stringify(req.body) : undefined;

    // Make proxy request with proper timeout using AbortController (Node.js 18+ compatible)
    logger.debug(`Proxying to: ${targetUrl} with ${PROXY_TIMEOUT_SECONDS}s timeout`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      logger.warn(`Request timeout after ${PROXY_TIMEOUT_SECONDS}s, aborting...`);
      controller.abort();
    }, PROXY_TIMEOUT_SECONDS * 1000);

    let proxyResponse;
    try {
      proxyResponse = await fetch(targetUrl, {
        method: req.method,
        body: body,
        headers: new Headers({
          ...req.headers,
          'host': `${config.targetServer.ip}:${config.targetServer.httpPort}`
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId); // Clear timeout on success
      logger.debug(`Proxy request completed successfully in ${Date.now()}ms`);
      
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      
      // Handle AbortError specifically
      if (fetchError.name === 'AbortError') {
        throw new Error(`Request timeout after ${PROXY_TIMEOUT_SECONDS} seconds`);
      }
      throw fetchError;
    }

    // Forward response
    res.status(proxyResponse.status);
    
    // Copy headers
    proxyResponse.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    // Stream response
    proxyResponse.body.pipe(res).on('error', (error) => {
      logger.error('Proxy pipe error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Proxy stream error' });
      }
    });

  } catch (error: any) {
    logger.error(`Proxy Error for ${req.method} ${req.originalUrl}:`, error);
    
    if (!res.headersSent) {
      let errorMessage = 'Failed to process request through proxy';
      let statusCode = 500;
      
      // Provide more specific error messages
      if (error.message.includes('timeout') || error.name === 'AbortError') {
        errorMessage = `Request timed out after ${PROXY_TIMEOUT_SECONDS} seconds - this may be normal for long LLM responses`;
        statusCode = 504; // Gateway Timeout
      } else if (error.message.includes('ECONNREFUSED')) {
        errorMessage = 'Target server refused connection';
        statusCode = 502; // Bad Gateway
      } else if (error.message.includes('wake-up timed out')) {
        errorMessage = 'Server failed to wake up in time';
        statusCode = 504; // Gateway Timeout
      }
      
      res.status(statusCode).json({ 
        error: errorMessage, 
        details: error.message,
        target: `${config.targetServer.ip}:${config.targetServer.httpPort}`,
        timestamp: new Date().toISOString(),
        suggestion: statusCode === 504 ? `Try the request again with a longer timeout. Current timeout: ${PROXY_TIMEOUT_SECONDS}s` : undefined
      });
    }
  }
};

// Apply proxy middleware
app.use(proxyMiddleware);

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// API Routes with better error handling
app.get('/api/status', async (req, res) => {
  try {
    const status = await serverMonitor.getServerStatus();
    res.json(status);
  } catch (error: any) {
    logger.error('Status API error:', error);
    res.status(500).json({ error: 'Failed to get server status', details: error.message });
  }
});

app.post('/api/wake', async (req, res) => {
  try {
    const result = await powerManager.wakeServer();
    logger.info(`Wake command result: ${result.success ? 'SUCCESS' : 'FAILED'} - ${result.message}`);
    res.json(result);
  } catch (error: any) {
    logger.error('Wake API error:', error);
    res.status(500).json({ 
      success: false, 
      message: `Failed to wake server: ${error.message}`,
      timestamp: new Date().toISOString()
    });
  }
});

app.post('/api/sleep', async (req, res) => {
  try {
    const result = await powerManager.sleepServer();
    logger.info(`Sleep command result: ${result.success ? 'SUCCESS' : 'FAILED'} - ${result.message}`);
    res.json(result);
  } catch (error: any) {
    logger.error('Sleep API error:', error);
    res.status(500).json({ 
      success: false, 
      message: `Failed to sleep server: ${error.message}`,
      timestamp: new Date().toISOString()
    });
  }
});

app.get('/api/config', async (req, res) => {
  try {
    const fullConfig = serverMonitor.getFullConfig();
    res.json(fullConfig);
  } catch (error: any) {
    logger.error('Config API error:', error);
    res.status(500).json({ error: 'Failed to get configuration', details: error.message });
  }
});

app.post('/api/config/autosleep', (req, res) => {
  try {
    const { enabled, minutes, monitorGpu } = req.body;
    
    // Validate input
    if (typeof enabled !== 'boolean' || typeof minutes !== 'number' || typeof monitorGpu !== 'boolean') {
      return res.status(400).json({ error: 'Invalid configuration parameters' });
    }
    
    if (minutes < 1 || minutes > 120) {
      return res.status(400).json({ error: 'Minutes must be between 1 and 120' });
    }
    
    serverMonitor.updateAutoSleepConfig({ enabled, minutes, monitorGpu });
    logger.info(`Auto-sleep configuration updated: enabled=${enabled}, minutes=${minutes}, monitorGpu=${monitorGpu}`);
    
    res.status(200).json({ 
      message: 'Configuration updated successfully.',
      config: { enabled, minutes, monitorGpu },
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    logger.error('Auto-sleep config API error:', error);
    res.status(500).json({ error: 'Failed to update configuration', details: error.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  logger.info(`Socket.IO client connected: ${socket.id}`);
  
  socket.on('disconnect', () => {
    logger.info(`Socket.IO client disconnected: ${socket.id}`);
  });
  
  socket.on('error', (error) => {
    logger.error(`Socket.IO error for client ${socket.id}:`, error);
  });
});

// Simple function to emit logs to UI
function emitLogToUI(level: string, message: string) {
  if (io) {
    io.emit('log', {
      level: level,
      message: message,
      timestamp: new Date().toISOString()
    });
  }
}

// Hook into the logger to emit to UI
const originalLog = logger.log;
logger.log = function(level: any, message?: any, ...args: any[]) {
  // Call original log method
  const result = originalLog.call(this, level, message, ...args);
  
  // Emit to UI if it's not a debug message
  if (typeof level === 'string' && level !== 'debug') {
    emitLogToUI(level, message);
  } else if (typeof level === 'object' && level.level && level.level !== 'debug') {
    emitLogToUI(level.level, level.message);
  }
  
  return result;
};

// Monitor status updates
serverMonitor.on('statusUpdate', (status) => {
  io.emit('statusUpdate', status);
});

serverMonitor.on('error', (error) => {
  logger.error('ServerMonitor error:', error);
  io.emit('error', { message: error.message, timestamp: new Date().toISOString() });
});

// Start monitoring
serverMonitor.start();

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    serverMonitor.stop();
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    serverMonitor.stop();
    process.exit(0);
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  logger.info(`🚀 SPARK server with transparent proxy running on port ${PORT}`);
  logger.info(`🌐 Web interface: http://localhost:${PORT}`);
  logger.info(`🎯 Target server: ${config.targetServer.ip}:${config.targetServer.httpPort}`);
});