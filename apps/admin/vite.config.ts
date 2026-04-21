import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

function packageNameFromModuleId(id: string) {
  const marker = 'node_modules/';
  const markerIndex = id.lastIndexOf(marker);

  if (markerIndex === -1) {
    return undefined;
  }

  const modulePath = id.slice(markerIndex + marker.length).split('/');

  if (modulePath[0]?.startsWith('@')) {
    return `${modulePath[0]}/${modulePath[1]}`;
  }

  return modulePath[0];
}

function toChunkName(packageName: string) {
  return packageName.replace('@', '').replace(/[\/]/g, '-');
}

function manualChunks(id: string) {
  const packageName = packageNameFromModuleId(id);

  if (!packageName) {
    return undefined;
  }

  if (
    packageName === 'react' ||
    packageName === 'react-dom' ||
    packageName === 'scheduler'
  ) {
    return 'react-vendor';
  }

  if (packageName.startsWith('react-router')) {
    return 'router-vendor';
  }

  if (
    packageName === 'antd' ||
    packageName.startsWith('@ant-design/') ||
    packageName.startsWith('rc-') ||
    packageName.startsWith('@rc-component/')
  ) {
    return `${toChunkName(packageName)}-vendor`;
  }

  return 'vendor';
}

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      onwarn(warning, warn) {
        if (
          warning.code === 'MODULE_LEVEL_DIRECTIVE' &&
          warning.message.includes('"use client"')
        ) {
          return;
        }

        warn(warning);
      },
      output: {
        manualChunks,
      },
    },
  },
});
