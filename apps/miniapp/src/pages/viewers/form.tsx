import { Button, Form, Input, Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useState } from 'react';

import { request } from '../../services/request';
import { ensureSession } from '../../services/session';

type CreateViewerPayload = {
  userId: string;
  name: string;
  idCard: string;
  mobile: string;
};

type FormState = {
  idCard: string;
  mobile: string;
  name: string;
};

const INITIAL_FORM_STATE: FormState = {
  idCard: '',
  mobile: '',
  name: '',
};

export default function ViewerFormPage() {
  const [formState, setFormState] = useState<FormState>(INITIAL_FORM_STATE);

  const updateField = (field: keyof FormState, value: string) => {
    setFormState((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const submit = async () => {
    try {
      await ensureSession();
      await request({
        data: formState satisfies Omit<CreateViewerPayload, 'userId'>,
        method: 'POST',
        url: '/viewers',
      });

      Taro.showToast({
        icon: 'success',
        duration: 800,
        title: '\u63d0\u4ea4\u6210\u529f',
        success: () => {
          setTimeout(() => {
            Taro.navigateBack();
          }, 300);
        },
      });
    } catch {
      Taro.showToast({
        icon: 'none',
        title: '\u4fdd\u5b58\u89c2\u6f14\u4eba\u5931\u8d25',
      });
    }
  };

  return (
    <View className='page viewer-form-page'>
      <View className='page__header'>
        <Text className='page__title'>{'\u65b0\u589e\u89c2\u6f14\u4eba'}</Text>
        <Text className='page__description'>
          {
            '\u63d0\u4ea4\u524d\u8bf7\u786e\u8ba4\u5b9e\u540d\u4fe1\u606f\u51c6\u786e\uff0c\u51fa\u7968\u524d\u4e0d\u53ef\u4fee\u6539\u3002'
          }
        </Text>
      </View>

      <Form onSubmit={submit}>
        <View className='form-field'>
          <Text>{'\u59d3\u540d'}</Text>
          <Input
            value={formState.name}
            onInput={(event) => updateField('name', event.detail.value)}
            placeholder='\u8bf7\u8f93\u5165\u771f\u5b9e\u59d3\u540d'
          />
        </View>

        <View className='form-field'>
          <Text>{'\u8eab\u4efd\u8bc1\u53f7'}</Text>
          <Input
            value={formState.idCard}
            onInput={(event) => updateField('idCard', event.detail.value)}
            placeholder='\u8bf7\u8f93\u5165\u8eab\u4efd\u8bc1\u53f7'
          />
        </View>

        <View className='form-field'>
          <Text>{'\u624b\u673a\u53f7'}</Text>
          <Input
            value={formState.mobile}
            onInput={(event) => updateField('mobile', event.detail.value)}
            placeholder='\u8bf7\u8f93\u5165\u624b\u673a\u53f7'
          />
        </View>

        <Button formType='submit'>{'\u4fdd\u5b58\u89c2\u6f14\u4eba'}</Button>
      </Form>
    </View>
  );
}
