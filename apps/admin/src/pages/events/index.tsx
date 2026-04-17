import { Button, Space, Table, Tag, Typography } from 'antd';

type EventRow = {
  id: string;
  title: string;
  city: string;
  saleStatus: 'UPCOMING' | 'ON_SALE' | 'SOLD_OUT';
};

const eventRows: EventRow[] = [
  {
    id: 'event-1001',
    title: '\u767d\u663c\u620f\u5267\u8282',
    city: '\u676d\u5dde',
    saleStatus: 'ON_SALE',
  },
  {
    id: 'event-1002',
    title: '\u94f6\u6cb3\u5217\u8f66\u97f3\u4e50\u4f1a',
    city: '\u4e0a\u6d77',
    saleStatus: 'UPCOMING',
  },
];

const saleStatusMeta: Record<
  EventRow['saleStatus'],
  { color: string; label: string }
> = {
  ON_SALE: { color: 'green', label: '\u552e\u7968\u4e2d' },
  SOLD_OUT: { color: 'red', label: '\u5df2\u552e\u7f44' },
  UPCOMING: { color: 'gold', label: '\u5f85\u5f00\u552e' },
};

export function EventsPage() {
  return (
    <div style={{ padding: 24 }}>
      <Space
        direction='vertical'
        size={16}
        style={{ display: 'flex', width: '100%' }}
      >
        <div>
          <Typography.Title level={3} style={{ marginBottom: 8 }}>
            {'\u6f14\u51fa\u7ba1\u7406'}
          </Typography.Title>
          <Typography.Paragraph style={{ marginBottom: 0 }}>
            {
              '\u540e\u53f0 CMS \u6f14\u51fa\u4fe1\u606f\u6d4f\u89c8\u9aa8\u67b6\uff0c\u540e\u7eed\u53ef\u63a5\u5165\u771f\u5b9e\u68c0\u7d22\u3001\u7f16\u8f91\u4e0e\u4e0a\u4e0b\u67b6\u6d41\u7a0b\u3002'
            }
          </Typography.Paragraph>
        </div>

        <Table<EventRow>
          columns={[
            {
              dataIndex: 'title',
              key: 'title',
              title: '\u6f14\u51fa\u540d\u79f0',
            },
            {
              dataIndex: 'city',
              key: 'city',
              title: '\u57ce\u5e02',
            },
            {
              dataIndex: 'saleStatus',
              key: 'saleStatus',
              title: '\u552e\u5356\u72b6\u6001',
              render: (saleStatus: EventRow['saleStatus']) => {
                const meta = saleStatusMeta[saleStatus];

                return <Tag color={meta.color}>{meta.label}</Tag>;
              },
            },
            {
              key: 'actions',
              title: '\u64cd\u4f5c',
              render: (_, record) => (
                <Space>
                  <Button type='link'>{'\u67e5\u770b'}</Button>
                  <Button type='link'>{'\u7f16\u8f91'}</Button>
                  <Button type='link' disabled={record.saleStatus === 'SOLD_OUT'}>
                    {'\u4e0a\u4e0b\u67b6'}
                  </Button>
                </Space>
              ),
            },
          ]}
          dataSource={eventRows}
          pagination={false}
          rowKey='id'
        />
      </Space>
    </div>
  );
}
