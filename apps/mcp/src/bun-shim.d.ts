/** Minimal Bun runtime typings used by apps/mcp. */
declare namespace Bun {
  function serve(options: {
    port?: number;
    fetch: (req: Request) => Response | Promise<Response>;
  }): { url: URL; port: number; stop: () => void };
}

declare const Bun: typeof Bun;
