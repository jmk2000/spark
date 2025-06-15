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
  performance: { responseTime: number; cpuUsage?: number; memoryUsage?: number; diskUsage?: number; gpuUsage?: number; vramUsage?: number; vramUsed?: number; vramTotal?: number; memoryUsed?: number; memoryTotal?: number; };
  autoSleep: AutoSleepConfig & { isIdle: boolean; timeUntilSleep: number | null; };
  config: { targetServer: ServerConfig }; // Added to pass config to UI
  timestamp: string;
}

export class ServerMonitor extends EventEmitter {
  private monitoring = false;
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
        enabled: process.env.AUTO_SLEEP_ENABLED === 'true',
        minutes: parseInt(process.env.AUTO_SLEEP_MINUTES || '15'),
        monitorGpu: process.env.AUTO_SLEEP_MONITOR_GPU === 'true',
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
  
  public recordActivity() { 
    this.lastActivityTimestamp = Date.now(); 
    this.logger.debug('Activity recorded - resetting idle timer');
  }

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
    this.lastStatus.timestamp = new Date().toISOString();
    return { ...this.lastStatus };
  }

  public start(): void {
    if (this.monitoring) return;
    this.monitoring = true;
    this.logger.info('Starting SPARK server monitoring');
    
    // Run immediately, then every 5 seconds
    this.performHealthCheck();
    this.healthInterval = setInterval(() => this.performHealthCheck(), 5000);
  }

  public stop(): void {
    this.monitoring = false;
    if (this.healthInterval) clearInterval(this.healthInterval);
    this.logger.info('SPARK server monitoring stopped');
  }

  private async performHealthCheck(): Promise<void> {
    try {
      this.logger.info(`🔍 Starting health check for ${this.config.ip}`);
      
      // Test ping first
      const pingResult = await ping.promise.probe(this.config.ip, {
        timeout: 3,
        extra: ['-c', '1']
      }).catch(() => ({ alive: false, time: 0 }));
      
      const isOnline = pingResult.alive;
      this.logger.info(`📡 Ping result: ${isOnline ? 'ONLINE' : 'OFFLINE'} (${pingResult.time}ms)`);

      if (this.lastStatus.isOnline !== isOnline) {
        this.logger.info(`🔄 Server ${this.config.ip} status changed: ${isOnline ? 'ONLINE' : 'OFFLINE'}`);
      }
      
      this.lastStatus.isOnline = isOnline;

      if (isOnline) {
        this.lastStatus.lastSeen = new Date().toISOString();
        this.lastStatus.performance.responseTime = Math.round(Number(pingResult.time)) || 0;
        
        // Check all services
        this.logger.info('🔧 Checking services...');
        await this.checkAllServices();
        
        // If SSH is working, get performance metrics
        if (this.lastStatus.services.ssh) {
          this.logger.info('📊 SSH available - collecting performance metrics...');
          try {
            const metrics = await this.getAllPerformanceMetrics();
            this.logger.info(`📈 Performance metrics collected:`, metrics);
            
            // Ensure we update the performance object properly
            this.lastStatus.performance = {
              responseTime: this.lastStatus.performance.responseTime,
              ...metrics
            };
            
            this.logger.info(`💾 Final performance data:`, this.lastStatus.performance);
          } catch (error: any) {
            this.logger.error(`❌ Performance metrics collection failed:`, error.message);
          }
        } else {
          this.logger.warn('⚠️ SSH not available - cannot collect performance metrics');
          this.lastStatus.performance = {
            responseTime: this.lastStatus.performance.responseTime,
            cpuUsage: undefined,
            memoryUsage: undefined,
            diskUsage: undefined,
            gpuUsage: undefined
          };
        }
        
      } else {
        // Server is offline - reset all statuses
        this.lastStatus.services = { ping: false, ssh: false, http: false, targetHttp: false };
        this.lastStatus.performance = { 
          responseTime: 0, 
          cpuUsage: undefined, 
          memoryUsage: undefined, 
          diskUsage: undefined, 
          gpuUsage: undefined 
        };
      }
      
      this.handleAutoSleep();
      
      // Always emit status update with detailed logging
      const statusToEmit = await this.getServerStatus();
      this.logger.info('📤 Emitting status update to UI:', {
        isOnline: statusToEmit.isOnline,
        services: statusToEmit.services,
        performance: statusToEmit.performance
      });
      this.emit('statusUpdate', statusToEmit);
      
    } catch (error: any) {
      this.logger.error(`💥 Health check error: ${error.message}`);
    }
  }

  private async checkAllServices(): Promise<void> {
    const enableDebugLogs = process.env.ENABLE_PERFORMANCE_DEBUG === 'true';
    
    // Set ping to true since we know it's online
    this.lastStatus.services.ping = true;
    
    // Test SSH connection using the exact working method
    if (enableDebugLogs) {
      this.logger.info('🔐 Testing SSH connection...');
    }
    this.lastStatus.services.ssh = await this.testSSHConnection();
    if (enableDebugLogs) {
      this.logger.info(`🔐 SSH status: ${this.lastStatus.services.ssh ? 'ONLINE' : 'OFFLINE'}`);
    }
    
    // Test HTTP services
    if (enableDebugLogs) {
      this.logger.info('🌐 Testing HTTP services...');
    }
    const httpResults = await this.testHTTPServices();
    this.lastStatus.services.http = httpResults.portOpen;
    this.lastStatus.services.targetHttp = httpResults.serviceResponding;
    if (enableDebugLogs) {
      this.logger.info(`🌐 HTTP port: ${httpResults.portOpen ? 'OPEN' : 'CLOSED'}, HTTP service: ${httpResults.serviceResponding ? 'RESPONDING' : 'NOT_RESPONDING'}`);
    }
  }

  private async testSSHConnection(): Promise<boolean> {
    try {
      const username = process.env.SSH_USERNAME;
      if (!username) {
        this.logger.error('❌ SSH_USERNAME environment variable not set');
        return false;
      }

      const sshCommand = `ssh -i /app/.ssh/id_rsa -o ConnectTimeout=5 -o StrictHostKeyChecking=no -o BatchMode=yes -p ${this.config.sshPort} ${username}@${this.config.ip}`;
      const enableDebugLogs = process.env.ENABLE_PERFORMANCE_DEBUG === 'true';
      
      if (enableDebugLogs) {
        this.logger.debug(`🔐 SSH command: ${sshCommand.replace('/app/.ssh/id_rsa', '[KEY]')}`);
      }
      
      // Test with a simple echo command
      const { stdout } = await execAsync(`${sshCommand} "echo 'ssh_test_successful'"`, { timeout: 8000 });
      const result = stdout.trim() === 'ssh_test_successful';
      
      if (enableDebugLogs) {
        this.logger.info(`🔐 SSH test result: ${result ? 'SUCCESS' : 'FAILED'}`);
      }
      return result;
      
    } catch (error: any) {
      this.logger.warn(`🔐 SSH connection failed: ${error.message}`);
      return false;
    }
  }

  private async testHTTPServices(): Promise<{ portOpen: boolean; serviceResponding: boolean }> {
    try {
      const httpUrl = `http://${this.config.ip}:${this.config.httpPort}/`;
      const enableDebugLogs = process.env.ENABLE_PERFORMANCE_DEBUG === 'true';
      
      if (enableDebugLogs) {
        this.logger.debug(`🌐 Testing HTTP URL: ${httpUrl}`);
      }
      
      const { stdout } = await execAsync(
        `curl -s -o /dev/null -w "%{http_code}" --connect-timeout 3 --max-time 5 "${httpUrl}"`, 
        { timeout: 8000 }
      );
      
      const statusCode = parseInt(stdout.trim());
      const isResponding = statusCode >= 200 && statusCode < 500;
      
      if (enableDebugLogs) {
        this.logger.info(`🌐 HTTP response: status ${statusCode}, responding: ${isResponding}`);
      }
      
      return {
        portOpen: true, // If curl got a response, port is open
        serviceResponding: isResponding
      };
      
    } catch (error: any) {
      this.logger.warn(`🌐 HTTP service test failed: ${error.message}`);
      return { portOpen: false, serviceResponding: false };
    }
  }

  private async getAllPerformanceMetrics(): Promise<Partial<ServerStatus['performance']>> {
    const performance: Partial<ServerStatus['performance']> = {};
    const username = process.env.SSH_USERNAME;
    const enableDebugLogs = process.env.ENABLE_PERFORMANCE_DEBUG === 'true';
    
    if (!username) {
      this.logger.error('❌ SSH_USERNAME not set - cannot get performance metrics');
      return performance;
    }

    const sshCommand = `ssh -i /app/.ssh/id_rsa -o ConnectTimeout=5 -o StrictHostKeyChecking=no -o BatchMode=yes -p ${this.config.sshPort} ${username}@${this.config.ip}`;
    
    // CPU Usage - use simple vmstat approach
    if (enableDebugLogs) {
      this.logger.info('📊 Getting CPU usage...');
    }
    try {
      const cpuCmd = `vmstat 1 2 | tail -1 | awk '{print 100-$15}'`;
      const { stdout: cpu } = await execAsync(`${sshCommand} "${cpuCmd}"`, { timeout: 10000 });
      const cpuValue = parseFloat(cpu.trim());
      if (enableDebugLogs) {
        this.logger.info(`📊 CPU raw output: '${cpu.trim()}', parsed: ${cpuValue}`);
      }
      
      if (!isNaN(cpuValue) && cpuValue >= 0 && cpuValue <= 100) {
        performance.cpuUsage = Math.round(cpuValue * 10) / 10;
        if (enableDebugLogs) {
          this.logger.info(`✅ CPU usage: ${performance.cpuUsage}%`);
        }
      } else {
        // Fallback: use uptime load average as rough CPU indicator
        const fallbackCmd = `uptime | awk -F'load average:' '{print $2}' | awk '{print $1*10}' | sed 's/,//'`;
        const { stdout: fallback } = await execAsync(`${sshCommand} "${fallbackCmd}"`, { timeout: 5000 });
        const fallbackValue = parseFloat(fallback.trim());
        if (!isNaN(fallbackValue) && fallbackValue >= 0) {
          performance.cpuUsage = Math.min(Math.round(fallbackValue * 10) / 10, 100);
          if (enableDebugLogs) {
            this.logger.info(`✅ CPU usage (fallback): ${performance.cpuUsage}%`);
          }
        } else if (enableDebugLogs) {
          this.logger.warn(`⚠️ Invalid CPU value: ${cpuValue}, fallback: ${fallbackValue}`);
        }
      }
    } catch (error: any) {
      if (enableDebugLogs) {
        this.logger.error(`❌ CPU metrics failed: ${error.message}`);
      }
    }
    // Memory Usage - use meminfo approach to avoid awk issues
        if (enableDebugLogs) {
          this.logger.info('📊 Getting memory usage...');
        }
        try {
          // Use /proc/meminfo which is more reliable - simplified command
          const memCmd = `cat /proc/meminfo | grep -E '^(MemTotal|MemAvailable):' | awk '{print $2}' | tr '\\n' ',' | sed 's/,$//'`;
          const { stdout: mem } = await execAsync(`${sshCommand} "${memCmd}"`, { timeout: 8000 });
          const memValues = mem.trim().split(',');
          
          if (enableDebugLogs) {
            this.logger.info(`📊 Memory raw output: '${mem.trim()}', values: ${JSON.stringify(memValues)}`);
          }
          
          if (memValues.length >= 2) {
            const total = parseFloat(memValues[0]) * 1024; // KB to bytes
            const available = parseFloat(memValues[1]) * 1024; // KB to bytes
            const used = total - available;
            const memValue = (used / total) * 100;
            
            if (!isNaN(memValue) && memValue >= 0 && memValue <= 100) {
              performance.memoryUsage = Math.round(memValue * 10) / 10;
              performance.memoryUsed = Math.round(used / 1024 / 1024 / 1024 * 10) / 10; // Bytes to GB
              performance.memoryTotal = Math.round(total / 1024 / 1024 / 1024 * 10) / 10; // Bytes to GB
              if (enableDebugLogs) {
                this.logger.info(`✅ Memory usage: ${performance.memoryUsage}% (${performance.memoryUsed}GB/${performance.memoryTotal}GB)`);
              }
            } else if (enableDebugLogs) {
              this.logger.warn(`⚠️ Invalid memory calculation: used=${used}, total=${total}, percentage=${memValue}`);
            }
          } else if (enableDebugLogs) {
            this.logger.warn(`⚠️ Memory command returned unexpected format: ${memValues.length} values`);
          }
        } catch (error: any) {
          if (enableDebugLogs) {
            this.logger.error(`❌ Memory metrics failed: ${error.message}`);
          }
        }
        
    // Disk Usage - simplest possible approach
    if (enableDebugLogs) {
      this.logger.info('📊 Getting disk usage...');
    }
    try {
      // Try df with percentage output format first
      const diskCmd = `df --output=pcent / | grep -v Use | tr -d ' %'`;
      const { stdout: disk } = await execAsync(`${sshCommand} "${diskCmd}"`, { timeout: 8000 });
      const diskValue = parseFloat(disk.trim());
      if (enableDebugLogs) {
        this.logger.info(`📊 Disk raw output: '${disk.trim()}', parsed: ${diskValue}`);
      }
      
      if (!isNaN(diskValue) && diskValue >= 0 && diskValue <= 100) {
        performance.diskUsage = diskValue;
        if (enableDebugLogs) {
          this.logger.info(`✅ Disk usage: ${performance.diskUsage}%`);
        }
      } else {
        // Fallback: parse the percentage from regular df output with simpler awk
        const fallbackCmd = `df / | grep -v Filesystem | awk '{print $5}' | sed 's/%//'`;
        const { stdout: fallback } = await execAsync(`${sshCommand} "${fallbackCmd}"`, { timeout: 5000 });
        const fallbackValue = parseFloat(fallback.trim());
        if (!isNaN(fallbackValue) && fallbackValue >= 0 && fallbackValue <= 100) {
          performance.diskUsage = fallbackValue;
          if (enableDebugLogs) {
            this.logger.info(`✅ Disk usage (fallback): ${performance.diskUsage}%`);
          }
        } else if (enableDebugLogs) {
          this.logger.warn(`⚠️ Invalid disk value: ${diskValue}, fallback: ${fallbackValue}`);
        }
      }
    } catch (error: any) {
      if (enableDebugLogs) {
        this.logger.error(`❌ Disk metrics failed: ${error.message}`);
      }
    }

    // GPU Usage and VRAM
    if (enableDebugLogs) {
      this.logger.info('📊 Getting GPU usage...');
    }
    try {
      const gpuCmd = `nvidia-smi --query-gpu=utilization.gpu --format=csv,noheader,nounits 2>/dev/null | head -1`;
      const { stdout: gpu } = await execAsync(`${sshCommand} "${gpuCmd}"`, { timeout: 8000 });
      const gpuValue = parseFloat(gpu.trim());
      if (enableDebugLogs) {
        this.logger.info(`📊 GPU raw output: '${gpu.trim()}', parsed: ${gpuValue}`);
      }
      
      if (!isNaN(gpuValue) && gpuValue >= 0 && gpuValue <= 100) {
        performance.gpuUsage = gpuValue;
        if (enableDebugLogs) {
          this.logger.info(`✅ GPU usage: ${performance.gpuUsage}%`);
        }
      } else if (enableDebugLogs) {
        this.logger.info(`ℹ️ GPU not available or invalid value: ${gpuValue}`);
      }
    } catch (error: any) {
      if (enableDebugLogs) {
        this.logger.info(`ℹ️ GPU metrics failed (normal for non-GPU systems): ${error.message}`);
      }
    }

    // VRAM Usage
    if (enableDebugLogs) {
      this.logger.info('📊 Getting VRAM usage...');
    }
    try {
      // Get VRAM values separately then calculate in JavaScript to avoid shell escaping issues
      const vramCmd = `nvidia-smi --query-gpu=memory.used,memory.total --format=csv,noheader,nounits 2>/dev/null | head -1`;
      const { stdout: vram } = await execAsync(`${sshCommand} "${vramCmd}"`, { timeout: 8000 });
      const vramLine = vram.trim();
      
      if (enableDebugLogs) {
        this.logger.info(`📊 VRAM raw output: '${vramLine}'`);
      }
      
      if (vramLine && vramLine !== '') {
        // Parse the comma-separated values
        const vramValues = vramLine.split(',').map(v => v.trim());
        if (vramValues.length === 2) {
          const used = parseFloat(vramValues[0]);
          const total = parseFloat(vramValues[1]);
          const vramValue = (used / total) * 100;
          
          if (enableDebugLogs) {
            this.logger.info(`📊 VRAM used: ${used}MB, total: ${total}MB, percentage: ${vramValue}`);
          }
          
          if (!isNaN(vramValue) && vramValue >= 0 && vramValue <= 100) {
            performance.vramUsage = Math.round(vramValue * 10) / 10;
            performance.vramUsed = Math.round(used / 1024 * 10) / 10; // Convert MB to GB
            performance.vramTotal = Math.round(total / 1024 * 10) / 10; // Convert MB to GB
            if (enableDebugLogs) {
              this.logger.info(`✅ VRAM usage: ${performance.vramUsage}% (${performance.vramUsed}GB/${performance.vramTotal}GB)`);
            }
          } else if (enableDebugLogs) {
            this.logger.info(`ℹ️ VRAM calculation resulted in invalid value: ${vramValue}`);
          }
        } else if (enableDebugLogs) {
          this.logger.info(`ℹ️ VRAM output format unexpected: ${vramValues.length} values`);
        }
      } else if (enableDebugLogs) {
        this.logger.info(`ℹ️ VRAM command returned empty output`);
      }
    } catch (error: any) {
      if (enableDebugLogs) {
        this.logger.info(`ℹ️ VRAM metrics failed (normal for non-GPU systems): ${error.message}`);
      }
    }

    if (enableDebugLogs) {
      this.logger.info('📊 Final performance metrics:', performance);
    }
    return performance;
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
            if (this.gpuIdleTimerStart === null) {
              this.gpuIdleTimerStart = Date.now();
              this.logger.debug('GPU idle timer started');
            }
            const gpuIdleDurationMs = this.autoSleepConfig.idleMinutes * 60 * 1000;
            const elapsedGpuIdle = Date.now() - this.gpuIdleTimerStart;
            
            if (elapsedGpuIdle >= gpuIdleDurationMs) {
                if(!sleepReason) sleepReason = `GPU idle for over ${this.autoSleepConfig.idleMinutes} minutes.`;
                timeUntilSleep = 0;
            } else {
                timeUntilSleep = Math.min(timeUntilSleep, gpuIdleDurationMs - elapsedGpuIdle);
            }
        } else {
            if (this.gpuIdleTimerStart !== null) {
              this.logger.debug('GPU no longer idle - resetting timer');
            }
            this.gpuIdleTimerStart = null;
        }
    }

    this.lastStatus.autoSleep = { 
      ...this.autoSleepConfig, 
      isIdle: timeUntilSleep < Infinity, 
      timeUntilSleep: timeUntilSleep === Infinity ? null : timeUntilSleep 
    };
    
    if (sleepReason) {
        this.logger.info(`Auto-sleep triggered. Reason: ${sleepReason}. Putting server to sleep.`);
        this.powerManager.sleepServer().then(result => {
          if (result.success) {
            this.gpuIdleTimerStart = null;
            this.lastActivityTimestamp = Date.now();
          }
        });
    }
  }
}