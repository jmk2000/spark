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
  sshUsername?: string;
  sshKeyPath?: string;
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
      
      wol.wake(this.config.mac, (error: any) => {
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
      
      // Use environment variables for SSH configuration
      const sshUsername = this.config.sshUsername || process.env.SSH_USERNAME || 'user';
      const sshKeyPath = this.config.sshKeyPath || '/app/.ssh/id_rsa';
      
      // SSH command with proper key and user
      const sshCommand = `ssh -i ${sshKeyPath} -o ConnectTimeout=10 -o StrictHostKeyChecking=no -o UserKnownHostsFile=/app/.ssh/known_hosts -p ${this.config.sshPort} ${sshUsername}@${this.config.ip} "sudo systemctl suspend"`;
      
      try {
        this.logger.info(`SPARK executing SSH command: ssh ${sshUsername}@${this.config.ip}`);
        await execAsync(sshCommand);
        this.logger.info('SPARK sleep command sent via SSH');
        return {
          success: true,
          message: 'SPARK sleep command sent successfully via SSH',
          timestamp
        };
      } catch (sshError: any) {
        this.logger.warn('SPARK SSH sleep command failed:', sshError.message);
        
        return {
          success: false,
          message: `SPARK sleep command failed. SSH error: ${sshError.message}. Please check SSH key authentication and sudo permissions.`,
          timestamp
        };
      }
    } catch (error: any) {
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