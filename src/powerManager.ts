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
      
      // Try SSH command first (requires SSH key authentication or password-less sudo)
      const sshCommand = `ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no -p ${this.config.sshPort} user@${this.config.ip} "sudo systemctl suspend"`;
      
      try {
        await execAsync(sshCommand);
        this.logger.info('SPARK sleep command sent via SSH');
        return {
          success: true,
          message: 'SPARK sleep command sent successfully via SSH',
          timestamp
        };
      } catch (sshError) {
        this.logger.warn('SPARK SSH sleep command failed, trying alternative methods');
        
        // Alternative: Use wake-on-lan library's magic packet with sleep
        // This is a placeholder - in reality you'd need proper authentication
        return {
          success: false,
          message: 'SPARK sleep command failed. SSH access required for remote sleep functionality.',
          timestamp
        };
      }
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
}
