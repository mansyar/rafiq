import { createServer } from 'node:net';
import { homedir } from 'node:os';
import { join } from 'node:path';

/** Resolve the tauri-driver binary path. Honors TAURI_DRIVER_PATH override. */
export function getTauriDriverPath(): string {
  const override = process.env.TAURI_DRIVER_PATH;
  if (override && override.trim().length > 0) return override.trim();
  const bin = process.platform === 'win32' ? 'tauri-driver.exe' : 'tauri-driver';
  return join(homedir(), '.cargo', 'bin', bin);
}

/** Build CLI args for tauri-driver. Validates port range. */
export function buildTauriDriverArgs(port: number): string[] {
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error('port must be an integer in 1024-65535');
  }
  return ['--port', String(port)];
}

/** Find a free TCP port by listening on 0 and reading the assigned port. */
export function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.listen(0, () => {
      const addr = srv.address();
      if (addr && typeof addr === 'object' && 'port' in addr) {
        const p = addr.port;
        srv.close(() => resolve(p));
      } else {
        srv.close(() => reject(new Error('failed to get port')));
      }
    });
    srv.on('error', reject);
  });
}

export function getTauriDriverUrl(port: number): string {
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error('port must be an integer in 1024-65535');
  }
  return `http://127.0.0.1:${port}`;
}

export function buildWaitOnResource(url: string): string {
  if (!url || typeof url !== 'string' || !url.startsWith('http')) {
    throw new Error('url must be an http(s) url');
  }
  return `get:${url}`;
}
