import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/parq-dashboard-v4/',
  plugins: [react()],
});
