import { Button, Text, View } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { useState } from 'react';

import { request } from '../../services/request';
import { ensureSession } from '../../services/session';

type ViewerItem = {
  id: string;
  name: string;
  mobile: string;
};

type ViewersResponse = {
  items: ViewerItem[];
};

export default function ViewersPage() {
  const [items, setItems] = useState<ViewerItem[]>([]);

  const loadViewers = async () => {
    try {
      await ensureSession();
      const response = await request<ViewersResponse>({
        url: '/viewers',
      });

      setItems(response.items ?? []);
    } catch {
      Taro.showToast({
        icon: 'none',
        title: '\u52a0\u8f7d\u89c2\u6f14\u4eba\u5931\u8d25',
      });
    }
  };

  useDidShow(() => {
    void loadViewers();
  });

  return (
    <View className='page viewers-page'>
      <View className='page__header'>
        <Text className='page__title'>{'\u89c2\u6f14\u4eba\u7ba1\u7406'}</Text>
        <Text className='page__description'>
          {
            '\u6dfb\u52a0\u5e38\u7528\u5b9e\u540d\u89c2\u6f14\u4eba\uff0c\u7ed3\u7b97\u65f6\u53ef\u76f4\u63a5\u9009\u62e9\u3002'
          }
        </Text>
      </View>

      <View className='viewer-list'>
        {items.length === 0 ? (
          <Text className='viewer-list__empty'>
            {'\u6682\u672a\u6dfb\u52a0\u89c2\u6f14\u4eba\uff0c\u8bf7\u5148\u65b0\u589e\u3002'}
          </Text>
        ) : (
          items.map((item) => (
            <View key={item.id} className='viewer-list__item'>
              <Text>{item.name}</Text>
              <Text>{item.mobile}</Text>
            </View>
          ))
        )}
      </View>

      <Button onClick={() => Taro.navigateTo({ url: '/pages/viewers/form' })}>
        {'\u65b0\u589e\u89c2\u6f14\u4eba'}
      </Button>
    </View>
  );
}
