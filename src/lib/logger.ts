/** Minimal logging utilities for development and debugging. Logs to console in development builds. */

const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV === true;

export const logger = {
  debug: (message: string, data?: unknown) => {
    if (isDev) console.debug(`[realpolitik:debug] ${message}`, data);
  },

  info: (message: string, data?: unknown) => {
    if (isDev) console.info(`[realpolitik:info] ${message}`, data);
  },

  warn: (message: string, data?: unknown) => {
    console.warn(`[realpolitik:warn] ${message}`, data);
  },

  error: (message: string, error?: unknown) => {
    console.error(`[realpolitik:error] ${message}`, error);
  },
};
