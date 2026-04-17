import { defineConfig } from '@tarojs/cli';

export default defineConfig({
  compiler: 'webpack5',
  defineConstants: {
    'process.env.TARO_APP_API_BASE_URL': JSON.stringify(
      process.env.TARO_APP_API_BASE_URL ?? 'https://beta.example.com/api',
    ),
  },
  designWidth: 750,
  deviceRatio: {
    375: 2,
    640: 2.34 / 2,
    750: 1,
    828: 1.81 / 2,
  },
  framework: 'react',
  outputRoot: 'dist',
  plugins: [],
  projectName: 'miniapp',
  sourceRoot: 'src',
});
