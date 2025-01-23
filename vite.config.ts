import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

// https://vite.dev/config/
export default defineConfig({
  plugins: [dts({ include: ['lib'], rollupTypes: true })],
  build: {
    lib: {
      entry: resolve(__dirname, 'lib/index.ts'),
      name: 'loKey',
      fileName: (format) => `loKey.${format}.js`,
    },
  },
});
