import { Button, Form, Input, Space, Table, Tag, Typography } from 'antd';

type FulfillmentRow = {
  id: string;
  orderId: string;
  ticketCode: string;
  source: 'MANUAL' | 'VENDOR_CALLBACK';
  status: 'TICKET_ISSUED';
};

const fulfillmentRows: FulfillmentRow[] = [
  {
    id: 'FUL-001',
    orderId: 'ORD-20260417-001',
    ticketCode: 'TK-7788',
    source: 'MANUAL',
    status: 'TICKET_ISSUED',
  },
];

const sourceMeta: Record<FulfillmentRow['source'], { color: string; label: string }> =
  {
    MANUAL: { color: 'blue', label: '人工录入占位' },
    VENDOR_CALLBACK: { color: 'purple', label: '厂商回调占位' },
  };

const statusMeta: Record<FulfillmentRow['status'], { color: string; label: string }> =
  {
    TICKET_ISSUED: { color: 'green', label: '已出票占位' },
  };

export function FulfillmentPage() {
  return (
    <div style={{ padding: 24 }}>
      <Space
        direction='vertical'
        size={16}
        style={{ display: 'flex', width: '100%' }}
      >
        <div>
          <Typography.Title level={3} style={{ marginBottom: 8 }}>
            履约工作台
          </Typography.Title>
          <Typography.Paragraph style={{ marginBottom: 0 }}>
            人工出票与履约事件适配层骨架页，当前仅展示表单和记录列表占位。
          </Typography.Paragraph>
          <Typography.Paragraph type='warning' style={{ marginBottom: 0 }}>
            当前为占位工作台，尚未接通真实出票写入，请勿将其视为已生效操作。
          </Typography.Paragraph>
        </div>

        <Form
          layout='inline'
          initialValues={{
            orderId: '',
            ticketCode: '',
          }}
        >
          <Form.Item
            label='订单号'
            name='orderId'
            rules={[{ required: true, message: '请输入订单号' }]}
          >
            <Input placeholder='请输入订单号' style={{ width: 240 }} />
          </Form.Item>
          <Form.Item
            label='票码'
            name='ticketCode'
            rules={[{ required: true, message: '请输入票码' }]}
          >
            <Input placeholder='请输入票码' style={{ width: 200 }} />
          </Form.Item>
          <Form.Item>
            <Button disabled type='primary' htmlType='button'>
              确认出票（占位，暂不可用）
            </Button>
          </Form.Item>
        </Form>

        <Table<FulfillmentRow>
          columns={[
            {
              dataIndex: 'orderId',
              key: 'orderId',
              title: '订单号',
            },
            {
              dataIndex: 'ticketCode',
              key: 'ticketCode',
              title: '票码',
            },
            {
              dataIndex: 'source',
              key: 'source',
              title: '来源',
              render: (source: FulfillmentRow['source']) => {
                const meta = sourceMeta[source];

                return <Tag color={meta.color}>{meta.label}</Tag>;
              },
            },
            {
              dataIndex: 'status',
              key: 'status',
              title: '状态',
              render: (status: FulfillmentRow['status']) => {
                const meta = statusMeta[status];

                return <Tag color={meta.color}>{meta.label}</Tag>;
              },
            },
          ]}
          dataSource={fulfillmentRows}
          pagination={false}
          rowKey='id'
        />
      </Space>
    </div>
  );
}
