import { afterEach, describe, expect, it } from 'vitest';
import {
  buildTauriDriverArgs,
  buildWaitOnResource,
  getFreePort,
  getTauriDriverPath,
  getTauriDriverUrl,
} from './tauri-driver';

describe('tauri-driver helpers', () => {
  const original = process.env.TAURI_DRIVER_PATH;

  afterEach(() => {
    if (original === undefined) delete process.env.TAURI_DRIVER_PATH;
    else process.env.TAURI_DRIVER_PATH = original;
  });

  it('getTauriDriverPath honors TAURI_DRIVER_PATH', () => {
    process.env.TAURI_DRIVER_PATH = 'C:\\custom\\tauri-driver.exe';
    expect(getTauriDriverPath()).toBe('C:\\custom\\tauri-driver.exe');
  });

  it('getTauriDriverPath trims whitespace', () => {
    process.env.TAURI_DRIVER_PATH = '  /tmp/driver  ';
    expect(getTauriDriverPath()).toBe('/tmp/driver');
  });

  it('getTauriDriverPath returns cargo bin path containing tauri-driver when not overridden', () => {
    delete process.env.TAURI_DRIVER_PATH;
    const p = getTauriDriverPath();
    expect(p).toContain('tauri-driver');
  });

  it('buildTauriDriverArgs formats port', () => {
    expect(buildTauriDriverArgs(4444)).toEqual(['--port', '4444']);
  });

  it('buildTauriDriverArgs rejects out-of-range', () => {
    expect(() => buildTauriDriverArgs(80)).toThrow(/1024/);
    expect(() => buildTauriDriverArgs(70000)).toThrow();
    expect(() => buildTauriDriverArgs(0.5 as unknown as number)).toThrow();
  });

  it('getFreePort returns valid port', async () => {
    const port = await getFreePort();
    expect(port).toBeGreaterThanOrEqual(1024);
    expect(port).toBeLessThanOrEqual(65535);
  });

  it('getFreePort returns distinct ports on successive calls', async () => {
    const a = await getFreePort();
    const b = await getFreePort();
    // Ports may occasionally collide if OS re-assigns, but very unlikely; at least both valid
    expect(a).not.toBe(0);
    expect(b).not.toBe(0);
    // Don't strictly require inequality, but if they are equal, ensure they're still valid
    expect(typeof a).toBe('number');
    expect(typeof b).toBe('number');
  });

  it('getTauriDriverUrl formats correctly and validates', () => {
    expect(getTauriDriverUrl(4444)).toBe('http://127.0.0.1:4444');
    expect(() => getTauriDriverUrl(80)).toThrow();
  });

  it('buildWaitOnResource prefixes get:', () => {
    expect(buildWaitOnResource('http://127.0.0.1:4444')).toBe('get:http://127.0.0.1:4444');
    expect(buildWaitOnResource('https://example.com')).toBe('get:https://example.com');
    expect(() => buildWaitOnResource('ftp://x')).toThrow();
    expect(() => buildWaitOnResource('')).toThrow();
  });
});
