export interface Logger {
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
  debug(msg: string): void;
}

export function createLogger(prefix: string): Logger {
  return {
    info: (msg: string) => console.log(`[${prefix}] ${msg}`),
    warn: (msg: string) => console.warn(`[${prefix}] ${msg}`),
    error: (msg: string) => console.error(`[${prefix}] ${msg}`),
    debug: (msg: string) => {
      if (process.env["DEBUG"]) {
        console.log(`[${prefix}:debug] ${msg}`);
      }
    },
  };
}
