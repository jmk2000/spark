import dgram from 'dgram';
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
    const timestamp = new Date().toISOString();
    
    try {
      this.logger.info(`SPARK sending WoL packet to MAC address ${this.config.mac}.`);

      // Validate and normalize MAC address
      const macAddr = this.config.mac.replace(/[:-]/g, '').toLowerCase();
      if (!/^[0-9a-f]{12}$/i.test(macAddr)) {
        throw new Error('Invalid MAC address format.');
      }

      // Convert MAC to bytes
      const macBytes = [];
      for (let i = 0; i < 12; i += 2) {
        macBytes.push(parseInt(macAddr.substr(i, 2), 16));
      }

      // Create magic packet (6 bytes of 0xFF + 16 repetitions of MAC)
      const magicPacket = Buffer.concat([
        Buffer.from([0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF]),
        ...Array(16).fill(null).map(() => Buffer.from(macBytes))
      ]);

      // Try multiple methods to send WoL packet
      const results = await Promise.allSettled([
        this.sendWoLPacket(magicPacket, '255.255.255.255', 9),
        this.sendWoLPacket(magicPacket, this.getBroadcastAddress(), 9),
        this.sendWoLPacket(magicPacket, this.config.ip, 9),
        this.sendWoLPacket(magicPacket, '255.255.255.255', 7)
      ]);

      const successCount = results.filter(r => r.status === 'fulfilled').length;
      
      if (successCount > 0) {
        this.logger.info(`SPARK WoL packet sent successfully (${successCount}/4 methods succeeded).`);
        return {
          success: true,
          message: `Wake-on-LAN packet sent successfully via ${successCount} method(s). The server should wake up shortly.`,
          timestamp
        };
      } else {
        throw new Error('All WoL sending methods failed');
      }

    } catch (error: any) {
      this.logger.error('SPARK failed to send WoL packet:', error);
      return {
        success: false,
        message: `Failed to send Wake-on-LAN packet: ${error.message}`,
        timestamp
      };
    }
  }

  private sendWoLPacket(magicPacket: Buffer, address: string, port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = dgram.createSocket('udp4');
      
      const cleanup = () => {
        try { socket.close(); } catch (e) {}
      };

      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error(`Timeout sending to ${address}:${port}`));
      }, 5000);

      socket.on('error', (err) => {
        clearTimeout(timeout);
        cleanup();
        reject(err);
      });

      socket.on('listening', () => {
        try {
          socket.setBroadcast(true);
          socket.send(magicPacket, port, address, (err) => {
            clearTimeout(timeout);
            cleanup();
            if (err) {
              reject(err);
            } else {
              this.logger.debug(`WoL packet sent to ${address}:${port}`);
              resolve();
            }
          });
        } catch (err) {
          clearTimeout(timeout);
          cleanup();
          reject(err);
        }
      });

      socket.bind();
    });
  }

  private getBroadcastAddress(): string {
    // Calculate broadcast address from server IP
    const ip = this.config.ip.split('.').map(Number);
    // Assume /24 network for simplicity
    return `${ip[0]}.${ip[1]}.${ip[2]}.255`;
  }

  async sleepServer(): Promise<PowerResult> {
    const timestamp = new Date().toISOString();
    const username = process.env.SSH_USERNAME || 'sparkuser';
    const sshIdentityFile = '/app/.ssh/id_rsa';
    const sshBaseCommand = `ssh -i ${sshIdentityFile} -o ConnectTimeout=10 -o StrictHostKeyChecking=no -o BatchMode=yes -p ${this.config.sshPort} ${username}@${this.config.ip}`;

    try {
      this.logger.info(`SPARK attempting to put server ${this.config.ip} to sleep.`);
      
      // Get the primary network interface
      const getInterfaceCommand = "ip route | grep default | head -1 | sed 's/.*dev \\([^ ]*\\).*/\\1/'";
      const { stdout: interfaceName } = await execAsync(`${sshBaseCommand} "${getInterfaceCommand}"`);
      const networkInterface = interfaceName.trim();

      if (!networkInterface) {
        throw new Error('Could not determine primary network interface on the target server.');
      }
      
      this.logger.info(`SPARK: Detected network interface: ${networkInterface}`);
      
      // Enable WoL and suspend
      const sleepCommand = `sudo ethtool -s ${networkInterface} wol g && sudo systemctl suspend`;
      this.logger.info(`SPARK: Executing sleep command: "${sleepCommand}"`);
      
      await execAsync(`${sshBaseCommand} "${sleepCommand}"`);
      return { 
        success: true, 
        message: 'Sleep command sent successfully. The server should suspend shortly.', 
        timestamp 
      };
      
    } catch (error: any) {
      // SSH connection dropping is expected when the server suspends
      if (error.message.includes('Connection closed') || 
          error.message.includes('Connection reset') ||
          error.message.includes('broken pipe')) {
        this.logger.info('SPARK sleep successful - SSH connection dropped as expected.');
        return { 
          success: true, 
          message: 'Sleep command sent successfully. The server should suspend shortly.', 
          timestamp 
        };
      }
      
      this.logger.error(`SPARK failed to put server to sleep: ${error.message}`);
      return { 
        success: false, 
        message: `Failed to put server to sleep: ${error.message}`, 
        timestamp 
      };
    }
  }
}