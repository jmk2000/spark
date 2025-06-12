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
