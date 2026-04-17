import { Alert, Button, Select, Space, Switch, Table, Tag, Typography } from 'antd';
import { useEffect, useState } from 'react';

import { jsonRequest, request } from '../../services/request';

type SaleStatus = 'UPCOMING' | 'ON_SALE' | 'SOLD_OUT';

type EventRow = {
  city: string;
  id: string;
  minPrice: number;
  published: boolean;
  refundEntryEnabled: boolean;
  saleStatus: SaleStatus;
  title: string;
  venueName: string;
};

const saleStatusMeta: Record<SaleStatus, { color: string; label: string }> = {
  ON_SALE: { color: 'green', label: 'On sale' },
  SOLD_OUT: { color: 'red', label: 'Sold out' },
  UPCOMING: { color: 'gold', label: 'Upcoming' },
};

const saleStatusOptions: Array<{ label: string; value: SaleStatus }> = [
  { label: 'Upcoming', value: 'UPCOMING' },
  { label: 'On sale', value: 'ON_SALE' },
  { label: 'Sold out', value: 'SOLD_OUT' },
];

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('zh-CN', {
    currency: 'CNY',
    style: 'currency',
  }).format(amount / 100);
}

export function EventsPage() {
  const [rows, setRows] = useState<EventRow[]>([]);
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [pendingKey, setPendingKey] = useState<string>();

  async function loadEvents() {
    setLoading(true);
    setError(undefined);

    try {
      const response = await request<{ items: EventRow[] }>(
        '/catalog/admin/events',
      );
      setRows(response.items ?? []);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load events.',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadEvents();
  }, []);

  async function updateEvent(
    eventId: string,
    patch: Partial<
      Pick<EventRow, 'published' | 'refundEntryEnabled' | 'saleStatus'>
    >,
    actionLabel: string,
  ) {
    setPendingKey(`${eventId}:${actionLabel}`);
    setError(undefined);

    try {
      const updatedEvent = await jsonRequest<EventRow>(
        `/catalog/admin/events/${eventId}`,
        'PATCH',
        patch,
      );

      setRows((currentRows) =>
        currentRows.map((row) => (row.id === eventId ? updatedEvent : row)),
      );
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : `Unable to ${actionLabel.toLowerCase()}.`,
      );
    } finally {
      setPendingKey(undefined);
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <Space
        direction='vertical'
        size={16}
        style={{ display: 'flex', width: '100%' }}
      >
        <div>
          <Typography.Title level={3} style={{ marginBottom: 8 }}>
            Event operations
          </Typography.Title>
          <Typography.Paragraph style={{ marginBottom: 0 }}>
            Live catalog operations for the beta event, including publish state,
            sale state, and refund entry.
          </Typography.Paragraph>
        </div>

        {error ? <Alert message={error} showIcon type='error' /> : null}

        <Space>
          <Button loading={loading} onClick={() => void loadEvents()}>
            Refresh
          </Button>
        </Space>

        <Table<EventRow>
          columns={[
            {
              dataIndex: 'title',
              key: 'title',
              title: 'Event',
              render: (_value: string, record) => (
                <Space direction='vertical' size={0}>
                  <Typography.Text strong>{record.title}</Typography.Text>
                  <Typography.Text type='secondary'>
                    {record.city} / {record.venueName}
                  </Typography.Text>
                </Space>
              ),
            },
            {
              dataIndex: 'minPrice',
              key: 'minPrice',
              title: 'Min price',
              render: (value: number) => formatCurrency(value),
            },
            {
              dataIndex: 'published',
              key: 'published',
              title: 'Published',
              render: (value: boolean, record) => (
                <Switch
                  checked={value}
                  checkedChildren='On'
                  loading={pendingKey === `${record.id}:publish`}
                  onChange={(checked) =>
                    void updateEvent(record.id, { published: checked }, 'publish')
                  }
                  unCheckedChildren='Off'
                />
              ),
            },
            {
              dataIndex: 'saleStatus',
              key: 'saleStatus',
              title: 'Sale status',
              render: (value: SaleStatus, record) => (
                <Space>
                  <Tag color={saleStatusMeta[value].color}>
                    {saleStatusMeta[value].label}
                  </Tag>
                  <Select<SaleStatus>
                    onChange={(nextValue) =>
                      void updateEvent(
                        record.id,
                        { saleStatus: nextValue },
                        'sale status',
                      )
                    }
                    options={saleStatusOptions}
                    size='small'
                    style={{ width: 132 }}
                    value={value}
                  />
                </Space>
              ),
            },
            {
              dataIndex: 'refundEntryEnabled',
              key: 'refundEntryEnabled',
              title: 'Refund entry',
              render: (value: boolean, record) => (
                <Switch
                  checked={value}
                  checkedChildren='Open'
                  loading={pendingKey === `${record.id}:refund`}
                  onChange={(checked) =>
                    void updateEvent(
                      record.id,
                      { refundEntryEnabled: checked },
                      'refund',
                    )
                  }
                  unCheckedChildren='Closed'
                />
              ),
            },
          ]}
          dataSource={rows}
          loading={loading}
          pagination={false}
          rowKey='id'
        />
      </Space>
    </div>
  );
}
