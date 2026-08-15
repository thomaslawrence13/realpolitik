import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // The 50m-resolution world-atlas topojson is ~740 KB raw / ~200 KB gzip.
    // Raise the chunk-size warning threshold to avoid false alarms.
    chunkSizeWarningLimit: 1200,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'react-vendor',
              test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/,
              priority: 30,
            },
            {
              name: 'history-data',
              test: /src[\/]data[\/]datasets[\/]historical_indicator_series\.json$/,
              priority: 28,
            },
            // Lazily-loaded payloads need a higher priority than the `dataset`
            // group below, which otherwise sweeps every file under datasets/
            // into the eager chunk and undoes the dynamic import that loads
            // them. Their sidecar `*_meta.json` files stay in `dataset` on
            // purpose — the artifact register reads those eagerly.
            {
              name: 'food-security-data',
              test: /src[\\/]data[\\/]datasets[\\/]fao_food_security\.json$/,
              priority: 28,
            },
            {
              name: 'dataset',
              test: /src[\\/]data[\\/]datasets[\\/]/,
              priority: 25,
            },
          ],
        },
      },
    },
  },
});
