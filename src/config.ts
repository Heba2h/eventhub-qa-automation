import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../.env'), quiet: true });

function read(name: string, fallback: string): string {
  const value = process.env[name]?.trim();
  return value ? value : fallback;
}

function readNumber(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`Environment variable ${name} must be a positive integer, got "${raw}"`);
  }
  return parsed;
}

const stripTrailingSlash = (url: string): string => url.replace(/\/+$/, '');

/**
 * Single, typed source of runtime configuration.
 * Everything environment-specific lives here so tests never read process.env directly.
 */
export const env = {
  isCI: !!process.env.CI,
  baseUrl: stripTrailingSlash(read('BASE_URL', 'https://eventhub.rahulshettyacademy.com')),
  apiUrl: stripTrailingSlash(read('API_URL', 'https://api.eventhub.rahulshettyacademy.com/api')),
  workers: readNumber('WORKERS', 4),
  /** Generated auth artefacts (storage states, cached generated credentials). Git-ignored. */
  authDir: path.resolve(__dirname, '../.auth'),
} as const;
