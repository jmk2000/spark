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
