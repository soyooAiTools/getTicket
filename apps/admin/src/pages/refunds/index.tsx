import { Button, Empty, Space, Table, Tag, Typography } from 'antd';

type RefundRow = {
  id: string;
  orderId: string;
  refundNo: string;
  source: 'USER_REQUEST' | 'VENDOR_CALLBACK';
  status: 'REVIEWING' | 'REFUNDED';
};

const refundRows: RefundRow[] = [];

const sourceMeta: Record<RefundRow['source'], { color: string; label: string }> =
  {
    USER_REQUEST: { color: 'blue', label: '\u7528\u6237\u7533\u8bf7' },
    VENDOR_CALLBACK: { color: 'purple', label: '\u5382\u5546\u56de\u8c03' },
  };

const statusMeta: Record<RefundRow['status'], { color: string; label: string }> =
  {
    REVIEWING: { color: 'gold', label: '\u5ba1\u6838\u4e2d' },
    REFUNDED: { color: 'green', label: '\u5df2\u9000\u6b3e' },
  };

export function RefundsPage() {
  return (
    <div style={{ padding: 24 }}>
      <Space
        direction='vertical'
        size={16}
        style={{ display: 'flex', width: '100%' }}
      >
        <div>
          <Typography.Title level={3} style={{ marginBottom: 8 }}>
            \u9000\u6b3e\u5360\u4f4d\u5de5\u4f5c\u53f0
          </Typography.Title>
          <Typography.Paragraph style={{ marginBottom: 0 }}>
            \u8fd9\u91cc\u4ec5\u5c55\u793a\u9000\u6b3e\u6d41\u7a0b\u7684\u5360\u4f4d\u6846\u67b6\uff0c\u5f53\u524d\u4e0d\u4ee3\u8868\u771f\u5b9e\u53ef\u64cd\u4f5c\u6570\u636e\u3002
          </Typography.Paragraph>
          <Typography.Paragraph type='warning' style={{ marginBottom: 0 }}>
            \u5f53\u524d\u9875\u9762\u4ec5\u7528\u4e8e\u540e\u7eed\u63a5\u5165\u5ba1\u6838\u3001\u8ba1\u7b97\u548c\u56de\u8c03\u6d41\u7a0b\uff0c\u6240\u6709\u64cd\u4f5c\u5747\u4e3a\u5360\u4f4d\u5c55\u793a\u3002
          </Typography.Paragraph>
        </div>

        <Space wrap>
          <Button disabled>\u5360\u4f4d\u64cd\u4f5c</Button>
          <Button type='primary' disabled>
            \u6682\u4e0d\u53ef\u7528
          </Button>
        </Space>

        <Table<RefundRow>
          columns={[
            {
              dataIndex: 'orderId',
              key: 'orderId',
              title: '\u8ba2\u5355\u53f7',
            },
            {
              dataIndex: 'refundNo',
              key: 'refundNo',
              title: '\u9000\u6b3e\u5355\u53f7',
            },
            {
              dataIndex: 'source',
              key: 'source',
              title: '\u6765\u6e90',
              render: (source: RefundRow['source']) => {
                const meta = sourceMeta[source];

                return <Tag color={meta.color}>{meta.label}</Tag>;
              },
            },
            {
              dataIndex: 'status',
              key: 'status',
              title: '\u72b6\u6001',
              render: (status: RefundRow['status']) => {
                const meta = statusMeta[status];

                return <Tag color={meta.color}>{meta.label}</Tag>;
              },
            },
            {
              key: 'actions',
              title: '\u64cd\u4f5c',
              render: () => (
                <Button type='link' disabled>
                  \u67e5\u770b
                </Button>
              ),
            },
          ]}
          dataSource={refundRows}
          locale={{
            emptyText: (
              <Empty
                description={
                  '\u5f53\u524d\u6682\u65e0\u9000\u6b3e\u8bb0\u5f55\uff0c\u8fd9\u91cc\u4ec5\u4fdd\u7559\u5360\u4f4d\u8868\u683c\u7528\u4e8e\u540e\u7eed\u63a5\u5165\u3002'
                }
              />
            ),
          }}
          pagination={false}
          rowKey='id'
        />
      </Space>
    </div>
  );
}
