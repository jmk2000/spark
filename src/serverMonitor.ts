import { EventEmitter } from 'events';
import ping from 'ping';
import { Logger } from 'winston';
import { PowerManager, ServerConfig } from './powerManager';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface AutoSleepConfig {
  enabled: boolean;
  minutes: number;
  monitorGpu: boolean;
  gpuThreshold: number;
  idleMinutes: number; // For GPU specifically
}

export interface ServerStatus {
  isOnline: boolean;
  lastSeen: string;
  services: { ping: boolean; ssh: boolean; http: boolean; targetHttp: boolean; };
  performance: { responseTime: number; cpuUsage?: number; memoryUsage?: number; diskUsage?: number; gpuUsage?: number; };
  autoSleep: AutoSleepConfig & { isIdle: boolean; timeUntilSleep: number | null; };
  config: { targetServer: ServerConfig }; // Added to pass config to UI
  timestamp: string;
}

export class ServerMonitor extends EventEmitter {
  private monitoring = false;
  private pingInterval?: NodeJS.Timeout;
  private healthInterval?: NodeJS.Timeout;
  private lastStatus: ServerStatus;
  private powerManager: PowerManager;
  private logger: Logger;
  private config: ServerConfig;

  private gpuIdleTimerStart: number | null = null;
  private lastActivityTimestamp: number = Date.now();

  private autoSleepConfig: AutoSleepConfig;

  constructor(
    config: ServerConfig,
    monitoringConfig: { pingInterval: number; healthCheckInterval: number },
    initialGpuConfig: { gpuThreshold: number, idleMinutes: number },
    powerManager: PowerManager,
    logger: Logger
  ) {
    super();
    this.config = config;
    this.powerManager = powerManager;
    this.logger = logger;
    
    this.autoSleepConfig = {
        ...initialGpuConfig,
        enabled: false,
        minutes: 15,
        monitorGpu: false,
    };

    this.lastStatus = {
      isOnline: false,
      lastSeen: 'Never',
      services: { ping: false, ssh: false, http: false, targetHttp: false },
      performance: { responseTime: 0 },
      autoSleep: { ...this.autoSleepConfig, isIdle: false, timeUntilSleep: null },
      config: { targetServer: this.config },
      timestamp: new Date().toISOString()
    };
  }
  
  public recordActivity() { this.lastActivityTimestamp = Date.now(); }
  public updateAutoSleepConfig(newConfig: Partial<AutoSleepConfig>) {
      this.logger.info(`Updating auto-sleep config: ${JSON.stringify(newConfig)}`);
      this.autoSleepConfig = { ...this.autoSleepConfig, ...newConfig };
  }

  public getFullConfig() {
      return {
          autoSleep: this.autoSleepConfig,
          targetServer: this.config
      };
  }
  
  public async getServerStatus(): Promise<ServerStatus> {
    this.lastStatus.autoSleep = { ...this.lastStatus.autoSleep, ...this.autoSleepConfig };
    this.lastStatus.config = { targetServer: this.config };
    return { ...this.lastStatus };
  }

  public start(): void {
    if (this.monitoring) return;
    this.monitoring = true;
    this.logger.info('Starting SPARK server monitoring');
    this.healthInterval = setInterval(() => this.performHealthCheck(), 10000);
    this.performHealthCheck();
  }

  private async performHealthCheck(): Promise<void> {
    const pingResult = await ping.promise.probe(this.config.ip, {timeout: 2}).catch(() => ({ alive: false, time: 0 }));
    const isOnline = pingResult.alive;

    if (this.lastStatus.isOnline !== isOnline) {
      this.logger.info(`Server is now ${isOnline ? 'online' : 'offline'}.`);
    }
    this.lastStatus.isOnline = isOnline;

    if(isOnline) {
        this.lastStatus.lastSeen = new Date().toISOString();
        this.lastStatus.performance.responseTime = Number(pingResult.time) || 0;
        this.lastStatus.services = await this.checkServices();
        this.lastStatus.performance = { ...this.lastStatus.performance, ...(await this.getPerformanceMetrics())};
    } else {
        this.lastStatus.services = { ping: false, ssh: false, http: false, targetHttp: false };
        this.lastStatus.performance = { responseTime: 0, cpuUsage: undefined, memoryUsage: undefined, diskUsage: undefined, gpuUsage: undefined };
    }
    
    this.handleAutoSleep();
    this.emit('statusUpdate', await this.getServerStatus());
  }

  private handleAutoSleep(): void {
    if (!this.lastStatus.isOnline || !this.autoSleepConfig.enabled) {
        this.gpuIdleTimerStart = null;
        this.lastActivityTimestamp = Date.now();
        this.lastStatus.autoSleep = { ...this.autoSleepConfig, isIdle: false, timeUntilSleep: null };
        return;
    }

    let sleepReason: string | null = null;
    let timeUntilSleep = Infinity;

    const requestTimeoutMs = this.autoSleepConfig.minutes * 60 * 1000;
    const elapsedSinceRequest = Date.now() - this.lastActivityTimestamp;
    
    if (elapsedSinceRequest >= requestTimeoutMs) {
        sleepReason = `No requests for over ${this.autoSleepConfig.minutes} minutes.`;
        timeUntilSleep = 0;
    } else {
        timeUntilSleep = Math.min(timeUntilSleep, requestTimeoutMs - elapsedSinceRequest);
    }
    
    if (this.autoSleepConfig.monitorGpu) {
        const gpuUsage = this.lastStatus.performance.gpuUsage;
        const isGpuIdle = typeof gpuUsage === 'number' && gpuUsage < this.autoSleepConfig.gpuThreshold;
        if (isGpuIdle) {
            if (this.gpuIdleTimerStart === null) this.gpuIdleTimerStart = Date.now();
            const gpuIdleDurationMs = this.autoSleepConfig.idleMinutes * 60 * 1000;
            const elapsedGpuIdle = Date.now() - this.gpuIdleTimerStart;
            
            if (elapsedGpuIdle >= gpuIdleDurationMs) {
                if(!sleepReason) sleepReason = `GPU idle for over ${this.autoSleepConfig.idleMinutes} minutes.`;
                timeUntilSleep = 0;
            } else {
                timeUntilSleep = Math.min(timeUntilSleep, gpuIdleDurationMs - elapsedGpuIdle);
            }
        } else {
            this.gpuIdleTimerStart = null;
        }
    }

    this.lastStatus.autoSleep = { ...this.autoSleepConfig, isIdle: timeUntilSleep < Infinity, timeUntilSleep: timeUntilSleep === Infinity ? null : timeUntilSleep };
    
    if (sleepReason) {
        this.logger.info(`Auto-sleep triggered. Reason: ${sleepReason}. Putting server to sleep.`);
        this.powerManager.sleepServer();
        this.gpuIdleTimerStart = null;
        this.lastActivityTimestamp = Date.now();
    }
  }

  private async checkServices(): Promise<ServerStatus['services']> {
    const services: ServerStatus['services'] = { ping: true, ssh: false, http: false, targetHttp: false };
    try { await execAsync(`nc -z -w3 ${this.config.ip} ${this.config.sshPort}`); services.ssh = true; } catch {}
    try { await execAsync(`nc -z -w3 ${this.config.ip} ${this.config.httpPort}`); services.http = true; } catch {}
    if (services.http) {
        try { await execAsync(`curl -s --head --connect-timeout 3 --max-time 5 http://${this.config.ip}:${this.config.httpPort}/`); services.targetHttp = true; } catch {}
    }
    return services;
  }

  private async getPerformanceMetrics(): Promise<Partial<ServerStatus['performance']>> {
    const performance: Partial<ServerStatus['performance']> = {};
    if (!this.lastStatus.services.ssh) return performance;
    
    const username = process.env.SSH_USERNAME || 'sparkuser';
    const sshCommand = `ssh -i /app/.ssh/id_rsa -o ConnectTimeout=5 -o StrictHostKeyChecking=no -p ${this.config.sshPort} ${username}@${this.config.ip}`;
    try {
      const { stdout: cpu } = await execAsync(`${sshCommand} "top -bn1 | grep 'Cpu(s)' | awk '{print $2+$4}'"`);
      performance.cpuUsage = parseFloat(cpu.trim());
      const { stdout: mem } = await execAsync(`${sshCommand} "free | grep Mem | awk '{printf \\"%.1f\\", $3/$2 * 100.0}'"`);
      performance.memoryUsage = parseFloat(mem.trim());
      const { stdout: disk } = await execAsync(`${sshCommand} "df -h / | awk 'NR==2{print \\$5}' | sed 's/%//'"`);
      performance.diskUsage = parseFloat(disk.trim());
      const { stdout: gpu } = await execAsync(`${sshCommand} "nvidia-smi --query-gpu=utilization.gpu --format=csv,noheader,nounits"`);
      performance.gpuUsage = parseFloat(gpu.trim());
    } catch (err: any) { this.logger.debug('Could not get all performance metrics: ' + err.message); }
    return performance;
  }
}
