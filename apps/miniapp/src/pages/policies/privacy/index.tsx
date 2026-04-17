import { Text, View } from '@tarojs/components';

const cardStyle = {
  background: '#ffffff',
  borderRadius: '16px',
  marginBottom: '16px',
  padding: '16px',
};

export default function PrivacyPolicyPage() {
  return (
    <View
      className='page privacy-policy-page'
      style={{ background: '#f5f5f5', minHeight: '100vh', padding: '16px' }}
    >
      <View style={cardStyle}>
        <Text style={{ display: 'block', fontSize: '24px', fontWeight: 'bold' }}>
          {'\u9690\u79c1\u653f\u7b56'}
        </Text>
        <Text style={{ color: '#666', display: 'block', marginTop: '8px' }}>
          {
            '\u6211\u4eec\u53ea\u4f1a\u4e3a\u652f\u6301\u4e70\u7968\u3001\u5b9e\u540d\u8ba4\u8bc1\u3001\u8ba2\u5355\u67e5\u8be2\u4e0e\u552e\u540e\u670d\u52a1\u800c\u6536\u96c6\u5fc5\u8981\u4fe1\u606f\u3002'
          }
        </Text>
      </View>

      <View style={cardStyle}>
        <Text style={{ display: 'block', fontSize: '18px', fontWeight: 'bold' }}>
          {'\u6211\u4eec\u4f1a\u6536\u96c6\u4ec0\u4e48'}
        </Text>
        <Text style={{ color: '#444', display: 'block', marginTop: '12px' }}>
          {
            '\u5305\u62ec\u60a8\u7684\u624b\u673a\u53f7\u3001\u5b9e\u540d\u4fe1\u606f\u3001\u8ba2\u5355\u4fe1\u606f\u4ee5\u53ca\u5fc5\u8981\u7684\u8bbe\u5907\u4fe1\u606f\uff0c\u7528\u4e8e\u6c47\u7b97\u4e70\u7968\u3001\u53d1\u7968\u4e0e\u670d\u52a1\u901a\u77e5\u3002'
          }
        </Text>
        <Text style={{ color: '#444', display: 'block', marginTop: '8px' }}>
          {
            '\u6211\u4eec\u4f1a\u5c3d\u91cf\u5c06\u6570\u636e\u4f7f\u7528\u9650\u4e8e\u4e1a\u52a1\u5fc5\u8981\u7684\u8303\u56f4\uff0c\u4e0d\u4f1a\u4ee5\u5176\u4ed6\u65b0\u7528\u9014\u5904\u7406\u60a8\u7684\u4fe1\u606f\u3002'
          }
        </Text>
      </View>

      <View style={cardStyle}>
        <Text style={{ display: 'block', fontSize: '18px', fontWeight: 'bold' }}>
          {'\u60a8\u7684\u6743\u5229'}
        </Text>
        <Text style={{ color: '#444', display: 'block', marginTop: '12px' }}>
          {
            '\u60a8\u53ef\u4ee5\u67e5\u770b\u3001\u4fee\u6539\u6216\u64a4\u56de\u90e8\u5206\u5df2\u63d0\u4ea4\u7684\u8d26\u53f7\u4e0e\u8ba2\u5355\u4fe1\u606f\uff0c\u4f46\u5b9e\u540d\u7968\u52a1\u5173\u952e\u4fe1\u606f\u5728\u652f\u4ed8\u6216\u786e\u8ba4\u540e\u9700\u6309\u89c4\u5219\u5904\u7406\u3002'
          }
        </Text>
      </View>
    </View>
  );
}
