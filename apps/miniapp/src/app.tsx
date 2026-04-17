import { useLaunch } from '@tarojs/taro';

export default function App({ children }) {
  useLaunch(() => {
    console.log('App launched.');
  });

  return children;
}
