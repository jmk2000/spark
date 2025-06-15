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
    return new Promise((resolve) => {
      this.logger.info(`SPARK sending WoL packet to MAC address ${this.config.mac}.`);

      try {
        const macBytes = this.config.mac.split(/[:-]/).map(hex => parseInt(hex, 16));
        if (macBytes.some(isNaN) || macBytes.length !== 6) {
            throw new Error('Invalid MAC address format.');
        }

        const magicPacket = Buffer.concat([
          Buffer.from([0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF]),
          ...Array(16).fill(null).map(() => Buffer.from(macBytes))
        ]);

        const socket = dgram.createSocket('udp4');
        socket.on('listening', () => {
          socket.setBroadcast(true);
          const broadcastAddress = '255.255.255.255'; 
          const port = 9;

          this.logger.info(`Sending WoL packet to broadcast address: ${broadcastAddress}:${port}`);
          socket.send(magicPacket, port, broadcastAddress, (err) => {
            socket.close();
            if (err) { throw err; }
            this.logger.info('SPARK WoL packet sent successfully.');
            resolve({
              success: true,
              message: 'Wake-on-LAN packet sent successfully. The server should wake up shortly.',
              timestamp: new Date().toISOString()
            });
          });
        });

        socket.on('error', (err) => {
            this.logger.error('Socket error while sending WoL packet:', err);
            socket.close();
            resolve({
                success: false,
                message: `Failed to send Wake-on-LAN packet: ${err.message}`,
                timestamp: new Date().toISOString()
            });
        });

        socket.bind();

      } catch (error: any) {
        this.logger.error('SPARK failed to create WoL packet:', error);
        resolve({
            success: false,
            message: `Failed to create Wake-on-LAN packet: ${error.message}`,
            timestamp: new Date().toISOString()
        });
      }
    });
  }

  async sleepServer(): Promise<PowerResult> {
    const timestamp = new Date().toISOString();
    const username = process.env.SSH_USERNAME || 'sparkuser';
    const sshIdentityFile = '/app/.ssh/id_rsa';
    const sshBaseCommand = `ssh -i ${sshIdentityFile} -o ConnectTimeout=10 -o StrictHostKeyChecking=no -o BatchMode=yes -p ${this.config.sshPort} ${username}@${this.config.ip}`;

    try {
      this.logger.info(`SPARK attempting to put server ${this.config.ip} to sleep.`);
      const getInterfaceCommand = "ip -o -4 route show to default | grep -o 'dev [^ ]*' | cut -d' ' -f2";
      const { stdout: interfaceName } = await execAsync(`${sshBaseCommand} "${getInterfaceCommand}"`);
      const networkInterface = interfaceName.trim();

      if (!networkInterface) {
          throw new Error('Could not determine primary network interface on the target server.');
      }
      this.logger.info(`SPARK: Detected network interface: ${networkInterface}`);
      
      const sleepCommand = `sudo ethtool -s ${networkInterface} wol g && sudo systemctl suspend`;
      this.logger.info(`SPARK: Executing sleep command: "${sleepCommand}"`);
      
      await execAsync(`${sshBaseCommand} "${sleepCommand}"`);
      return { success: true, message: 'Sleep command sent successfully. The server should suspend shortly.', timestamp };
      
    } catch (error: any) {
      if (error.message.includes('Connection closed') || error.message.includes('Connection reset')) {
        this.logger.info('SPARK sleep successful - SSH connection dropped as expected.');
        return { success: true, message: 'Sleep command sent successfully. The server should suspend shortly.', timestamp };
      }
      this.logger.error(`SPARK failed to put server to sleep: ${error.message}`);
      return { success: false, message: `Failed to put server to sleep: ${error.message}`, timestamp };
    }
  }
}
