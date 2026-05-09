import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // The 50m-resolution world-atlas topojson is ~740 KB raw / ~200 KB gzip.
    // Raise the chunk-size warning threshold to avoid false alarms.
    chunkSizeWarningLimit: 1200,
  },
});
