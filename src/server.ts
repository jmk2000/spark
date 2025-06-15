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

dotenv.config();

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [ new winston.transports.Console(), new winston.transports.File({ filename: 'logs/spark.log' })]
});

const app = express();
const server = createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());

const config = {
  targetServer: {
    ip: process.env.TARGET_SERVER_IP || '192.168.1.100',
    mac: process.env.TARGET_SERVER_MAC || '00:11:22:33:44:55',
    sshPort: parseInt(process.env.TARGET_SERVER_SSH_PORT || '22'),
    httpPort: parseInt(process.env.TARGET_SERVER_HTTP_PORT || '11434')
  },
  monitoring: { pingInterval: 5000, healthCheckInterval: 10000 },
  autoSleep: {
      gpuThreshold: parseInt(process.env.AUTO_SLEEP_GPU_THRESHOLD || '5'),
      idleMinutes: parseInt(process.env.AUTO_SLEEP_IDLE_MINUTES || '5'),
  }
};

const powerManager = new PowerManager(config.targetServer, logger);
const serverMonitor = new ServerMonitor(config.targetServer, config.monitoring, config.autoSleep, powerManager, logger);

const proxyMiddleware = async (req, res, next) => {
  const sparkInternalPaths = ['/', '/api/status', '/api/wake', '/api/sleep', '/api/config', '/api/config/autosleep'];
  if (sparkInternalPaths.includes(req.path) || req.path.startsWith('/socket.io')) {
    return next();
  }

  serverMonitor.recordActivity();
  const targetPath = req.originalUrl.startsWith('/') ? req.originalUrl.substring(1) : req.originalUrl;
  const targetUrl = `http://${config.targetServer.ip}:${config.targetServer.httpPort}/${targetPath}`;
  const WAKE_TIMEOUT_SECONDS = 180;

  try {
    logger.info(`Transparent proxy triggered for [${req.method}] ${req.originalUrl}.`);
    let status = await serverMonitor.getServerStatus();

    if (!status.services.targetHttp) {
      logger.info('Target HTTP service not online. Waking up...');
      if (!status.isOnline) {
        await powerManager.wakeServer();
      }
      const startTime = Date.now();
      let isReady = false;
      while (Date.now() - startTime < WAKE_TIMEOUT_SECONDS * 1000) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        status = await serverMonitor.getServerStatus();
        if (status.services.targetHttp) { isReady = true; break; }
      }
      if (!isReady) throw new Error('Server wake-up timed out.');
    }

    const body = (req.method !== 'GET' && req.method !== 'HEAD' && Object.keys(req.body).length > 0) 
      ? JSON.stringify(req.body) : undefined;
    const proxyResponse = await fetch(targetUrl, {
      method: req.method,
      body: body,
      headers: new Headers(req.headers as any),
    });
    res.status(proxyResponse.status);
    proxyResponse.body.pipe(res).on('error', () => res.status(500).send('Proxy pipe error'));
  } catch (error: any) {
    logger.error(`Proxy Error: ${error.message}`);
    res.status(500).json({ error: 'Failed to process request through proxy', details: error.message });
  }
};

app.use(proxyMiddleware);

app.use(express.static(path.join(__dirname, 'public')));
app.get('/api/status', async (req, res) => res.json(await serverMonitor.getServerStatus()));
app.post('/api/wake', async (req, res) => res.json(await powerManager.wakeServer()));
app.post('/api/sleep', async (req, res) => res.json(await powerManager.sleepServer()));
app.get('/api/config', async (req, res) => res.json(serverMonitor.getFullConfig()));
app.post('/api/config/autosleep', (req, res) => {
    const { enabled, minutes, monitorGpu } = req.body;
    serverMonitor.updateAutoSleepConfig({ enabled, minutes, monitorGpu });
    res.status(200).json({ message: 'Configuration updated successfully.' });
});

serverMonitor.on('statusUpdate', (status) => { io.emit('statusUpdate', status); });
serverMonitor.start();
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => { logger.info(`SPARK server with transparent proxy running on port ${PORT}`); });
