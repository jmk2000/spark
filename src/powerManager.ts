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
    const username = process.env.SSH_USERNAME || 'spark'; // Default username
    const sshBaseCommand = `ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no -o BatchMode=yes -p ${this.config.sshPort} ${username}@${this.config.ip}`;

    try {
      this.logger.info(`SPARK attempting to put server ${this.config.ip} to sleep using systemctl suspend`);

      // Step 1: Dynamically get the primary network interface name from the target server.
      this.logger.info(`SPARK: Fetching network interface from target server...`);
      const getInterfaceCommand = `ip -o -4 route show to default | awk '{print $5}'`;
      const { stdout: interfaceName } = await execAsync(`${sshBaseCommand} "${getInterfaceCommand}"`);
      const networkInterface = interfaceName.trim();

      if (!networkInterface) {
          throw new Error('Could not determine primary network interface on the target server.');
      }
      this.logger.info(`SPARK: Detected network interface: ${networkInterface}`);
      
      // Step 2: Define the single, reliable sleep command.
      // This command first ensures WoL is enabled on the interface, then suspends the system.
      const sleepCommand = `sudo ethtool -s ${networkInterface} wol g && sudo systemctl suspend`;
      
      this.logger.info(`SPARK: Executing sleep command: "${sleepCommand}"`);
      
      try {
        await execAsync(`${sshBaseCommand} "${sleepCommand}"`);
        
        // After sending the suspend command, we expect the host to become unreachable.
        // We'll wait a few seconds and then check.
        await new Promise(resolve => setTimeout(resolve, 5000));

        const isStillOnline = await this.isServerReachable();
        if (!isStillOnline) {
          this.logger.info('SPARK sleep command successful. Server is now suspended.');
          return {
            success: true,
            message: 'SPARK sleep command sent successfully. Server has been suspended.',
            timestamp
          };
        } else {
          this.logger.warn('SPARK sleep command was sent, but the server is still online. Check BIOS/WoL settings and sudo permissions.');
          return {
            success: false,
            message: 'SPARK sleep command sent, but server is still responding. Check BIOS Wake-on-LAN settings and ensure user has passwordless sudo for ethtool and systemctl.',
            timestamp
          };
        }

      } catch (sshError: any) {
         // An SSH error during suspend is often expected as the connection drops.
         // We can treat certain errors as a sign of success.
        if (
            sshError.message.includes('Connection closed') ||
            sshError.message.includes('Connection reset')
        ) {
            this.logger.info('SPARK sleep successful - SSH connection dropped as expected during suspend.');
            return {
                success: true,
                message: 'SPARK sleep command sent successfully. Server has been suspended.',
                timestamp
            };
        }
        // If it's a different error, log it as a failure.
        this.logger.error(`SPARK: SSH command failed unexpectedly: ${sshError.message}`);
        throw sshError; // Re-throw to be caught by the outer catch block.
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      this.logger.error(`SPARK failed to put server to sleep: ${errorMessage}`);
      return {
        success: false,
        message: `SPARK failed to put server to sleep: ${errorMessage}`,
        timestamp
      };
    }
  }

  async isServerReachable(): Promise<boolean> {
    try {
      // A simple ping is sufficient to check if the host is responsive.
      const pingCommand = `ping -c 1 -W 3 ${this.config.ip}`;
      await execAsync(pingCommand);
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

    try {
      await execAsync(`ping -c 1 -W 3 ${this.config.ip}`);
      results.ping = true;
    } catch {}

    if (results.ping) {
        try {
          await execAsync(`nc -z -w3 ${this.config.ip} ${this.config.sshPort}`);
          results.ssh = true;
        } catch {}

        try {
          await execAsync(`nc -z -w3 ${this.config.ip} ${this.config.httpPort}`);
          results.http = true;
        } catch {}

        if (results.http) {
            try {
              // Check if the Ollama API is responding with a valid JSON structure
              const { stdout } = await execAsync(`curl -s --connect-timeout 3 http://${this.config.ip}:${this.config.httpPort}/api/tags`);
              JSON.parse(stdout);
              results.ollama = true;
            } catch {}
        }
    }

    return results;
  }
}
