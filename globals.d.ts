// Global type declarations for modules without @types packages

declare module 'wake_on_lan' {
  function wake(macAddress: string, callback: (error?: any) => void): void;
  export = { wake };
}

declare module 'ping' {
  interface PingResponse {
    host: string;
    alive: boolean;
    output: string;
    time: number;
  }
  
  namespace promise {
    function probe(host: string, config?: any): Promise<PingResponse>;
  }
  
  export = { promise };
}