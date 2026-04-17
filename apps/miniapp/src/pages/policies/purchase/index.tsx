import { Text, View } from '@tarojs/components';

const cardStyle = {
  background: '#ffffff',
  borderRadius: '16px',
  marginBottom: '16px',
  padding: '16px',
};

export default function PurchasePolicyPage() {
  return (
    <View
      className='page purchase-policy-page'
      style={{ background: '#f5f5f5', minHeight: '100vh', padding: '16px' }}
    >
      <View style={cardStyle}>
        <Text style={{ display: 'block', fontSize: '24px', fontWeight: 'bold' }}>
          {'\u8d2d\u7968\u89c4\u5219'}
        </Text>
        <Text style={{ color: '#666', display: 'block', marginTop: '8px' }}>
          {
            '\u672c\u9875\u9762\u5c55\u793a\u5b9e\u540d\u4e70\u7968\u3001\u5238\u7684\u786e\u8ba4\u65f6\u6548\u53ca\u6570\u636e\u9519\u8bef\u5904\u7406\u89c4\u5219\u3002'
          }
        </Text>
      </View>

      <View style={cardStyle}>
        <Text style={{ display: 'block', fontSize: '18px', fontWeight: 'bold' }}>
          {'\u5fc5\u987b\u5b9e\u540d\u4e70\u7968'}
        </Text>
        <Text style={{ color: '#444', display: 'block', marginTop: '12px' }}>
          {
            '\u5b9e\u540d\u8d2d\u7968\uff0c\u89c2\u6f14\u4eba\u4fe1\u606f\u63d0\u4ea4\u540e\u4e0d\u53ef\u4fee\u6539\u3002'
          }
        </Text>
        <Text style={{ color: '#444', display: 'block', marginTop: '8px' }}>
          {
            '\u8bf7\u5728\u4e0b\u5355\u524d\u6838\u5bf9\u59d3\u540d\u3001\u8bc1\u4ef6\u53f7\u7801\u548c\u624b\u673a\u53f7\uff0c\u786e\u4fdd\u4e0e\u5165\u573a\u8bc1\u4ef6\u4e00\u81f4\u3002'
          }
        </Text>
      </View>

      <View style={cardStyle}>
        <Text style={{ display: 'block', fontSize: '18px', fontWeight: 'bold' }}>
          {'\u786e\u8ba4\u65f6\u6548'}
        </Text>
        <Text style={{ color: '#444', display: 'block', marginTop: '12px' }}>
          {
            '\u5b9e\u540d\u7535\u5b50\u7968\u6700\u665a\u6f14\u51fa\u524d\u4e09\u5929\u786e\u8ba4\uff0c\u7eb8\u8d28\u7968\u6700\u665a\u6f14\u51fa\u524d\u4e03\u5929\u786e\u8ba4\u3002'
          }
        </Text>
        <Text style={{ color: '#444', display: 'block', marginTop: '8px' }}>
          {
            '\u5982\u679c\u8d85\u8fc7\u65f6\u9650\uff0c\u7968\u52a1\u5904\u7406\u53ef\u80fd\u53d7\u5230\u5f71\u54cd\uff0c\u8bf7\u53ca\u65f6\u5b8c\u6210\u786e\u8ba4\u3002'
          }
        </Text>
      </View>

      <View style={cardStyle}>
        <Text style={{ display: 'block', fontSize: '18px', fontWeight: 'bold' }}>
          {'\u4fe1\u606f\u9519\u8bef\u5904\u7406'}
        </Text>
        <Text style={{ color: '#444', display: 'block', marginTop: '12px' }}>
          {
            '\u6f14\u51fa\u524d\u4e09\u5929\u5185\uff0c\u82e5\u56e0\u7528\u6237\u4fe1\u606f\u9519\u8bef\u5bfc\u81f4\u65e0\u6cd5\u5f55\u5165\uff0c\u5c06\u6263\u9664 20% \u670d\u52a1\u8d39\u3002'
          }
        </Text>
        <Text style={{ color: '#444', display: 'block', marginTop: '8px' }}>
          {
            '\u8bf7\u5728\u63d0\u4ea4\u524d\u7acb\u5373\u6838\u5bf9\u8ba2\u5355\u548c\u89c2\u6f14\u4eba\u4fe1\u606f\uff0c\u51cf\u5c11\u4fee\u6539\u548c\u9000\u6b3e\u98ce\u9669\u3002'
          }
        </Text>
      </View>
    </View>
  );
}
