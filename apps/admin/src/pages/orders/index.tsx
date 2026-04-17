import { Button, Input, Space, Table, Tag, Typography } from 'antd';

type OrderRow = {
  id: string;
  buyer: string;
  status: 'PAID_PENDING_FULFILLMENT' | 'TICKET_ISSUED';
};

const orderRows: OrderRow[] = [
  {
    id: 'ORD-20260417-001',
    buyer: '张三',
    status: 'PAID_PENDING_FULFILLMENT',
  },
  {
    id: 'ORD-20260417-002',
    buyer: '李四',
    status: 'TICKET_ISSUED',
  },
];

const statusMeta: Record<OrderRow['status'], { color: string; label: string }> =
  {
    PAID_PENDING_FULFILLMENT: { color: 'gold', label: '待履约' },
    TICKET_ISSUED: { color: 'green', label: '已出票' },
  };

export function OrdersPage() {
  return (
    <div style={{ padding: 24 }}>
      <Space
        direction='vertical'
        size={16}
        style={{ display: 'flex', width: '100%' }}
      >
        <div>
          <Typography.Title level={3} style={{ marginBottom: 8 }}>
            订单工作台
          </Typography.Title>
          <Typography.Paragraph style={{ marginBottom: 0 }}>
            订单后台骨架页，后续可接入真实检索、详情和履约动作。
          </Typography.Paragraph>
        </div>

        <Space wrap>
          <Input placeholder='搜索订单号' style={{ width: 240 }} />
          <Button type='primary'>查询</Button>
        </Space>

        <Table<OrderRow>
          columns={[
            {
              dataIndex: 'id',
              key: 'id',
              title: '订单号',
            },
            {
              dataIndex: 'buyer',
              key: 'buyer',
              title: '下单用户',
            },
            {
              dataIndex: 'status',
              key: 'status',
              title: '状态',
              render: (status: OrderRow['status']) => {
                const meta = statusMeta[status];

                return <Tag color={meta.color}>{meta.label}</Tag>;
              },
            },
            {
              key: 'actions',
              title: '操作',
              render: () => <Button type='link'>查看</Button>,
            },
          ]}
          dataSource={orderRows}
          pagination={false}
          rowKey='id'
        />
      </Space>
    </div>
  );
}
