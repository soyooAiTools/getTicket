import { Alert, Button, Input, Select, Space, Table, Tag, Typography } from 'antd';
import { useEffect, useState } from 'react';

import { request } from '../../services/request';

type FulfillmentRow = {
  event?: {
    city: string;
    id: string;
    title: string;
    venueName: string;
  };
  externalRef?: string;
  id: string;
  occurredAt: string;
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  source?: 'MANUAL' | 'UPSTREAM_SUBMISSION' | 'VENDOR_CALLBACK';
  status: string;
  ticketCode?: string;
  tierName?: string;
};

const sourceMeta: Record<string, { color: string; label: string }> = {
  MANUAL: { color: 'blue', label: 'Manual' },
  UPSTREAM_SUBMISSION: { color: 'purple', label: 'Submitted upstream' },
  VENDOR_CALLBACK: { color: 'cyan', label: 'Vendor callback' },
};

const fulfillmentStatusMeta: Record<string, { color: string; label: string }> = {
  FAILED: { color: 'red', label: 'Failed' },
  ISSUED: { color: 'green', label: 'Issued' },
  PENDING: { color: 'default', label: 'Pending' },
  SUBMITTED: { color: 'gold', label: 'Submitted' },
};

const sourceOptions = Object.entries(sourceMeta).map(([value, meta]) => ({
  label: meta.label,
  value,
}));

const statusOptions = Object.entries(fulfillmentStatusMeta).map(
  ([value, meta]) => ({
    label: meta.label,
    value,
  }),
);

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('zh-CN', {
    hour12: false,
  });
}

export function FulfillmentPage() {
  const [rows, setRows] = useState<FulfillmentRow[]>([]);
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string>();
  const [statusFilter, setStatusFilter] = useState<string>();

  async function loadOperations() {
    setLoading(true);
    setError(undefined);

    try {
      const response = await request<{ items: FulfillmentRow[] }>(
        '/fulfillment/admin',
      );
      setRows(response.items ?? []);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load fulfillment operations.',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadOperations();
  }, []);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredRows = rows.filter((row) => {
    if (sourceFilter && row.source !== sourceFilter) {
      return false;
    }

    if (statusFilter && row.status !== statusFilter) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    return [
      row.orderNumber,
      row.orderId,
      row.event?.title,
      row.ticketCode,
      row.externalRef,
    ]
      .filter(Boolean)
      .some((value) => value?.toLowerCase().includes(normalizedQuery));
  });

  return (
    <div style={{ padding: 24 }}>
      <Space
        direction='vertical'
        size={16}
        style={{ display: 'flex', width: '100%' }}
      >
        <div>
          <Typography.Title level={3} style={{ marginBottom: 8 }}>
            Fulfillment operations
          </Typography.Title>
          <Typography.Paragraph style={{ marginBottom: 0 }}>
            Live vendor submission and issuance activity for triaging
            fulfillment exceptions.
          </Typography.Paragraph>
        </div>

        {error ? <Alert message={error} showIcon type='error' /> : null}

        <Space wrap>
          <Input
            allowClear
            onChange={(event) => setQuery(event.target.value)}
            placeholder='Search order, ticket code, event, or external ref'
            style={{ width: 320 }}
            value={query}
          />
          <Select
            allowClear
            onChange={(value) => setSourceFilter(value)}
            options={sourceOptions}
            placeholder='Filter by source'
            style={{ width: 180 }}
            value={sourceFilter}
          />
          <Select
            allowClear
            onChange={(value) => setStatusFilter(value)}
            options={statusOptions}
            placeholder='Filter by status'
            style={{ width: 180 }}
            value={statusFilter}
          />
          <Button loading={loading} onClick={() => void loadOperations()}>
            Refresh
          </Button>
        </Space>

        <Table<FulfillmentRow>
          columns={[
            {
              dataIndex: 'orderNumber',
              key: 'orderNumber',
              title: 'Order',
              render: (_value: string, record) => (
                <Space direction='vertical' size={0}>
                  <Typography.Text strong>{record.orderNumber}</Typography.Text>
                  <Typography.Text type='secondary'>
                    {record.orderId}
                  </Typography.Text>
                </Space>
              ),
            },
            {
              dataIndex: 'event',
              key: 'event',
              title: 'Event',
              render: (_value: FulfillmentRow['event'], record) => (
                <Space direction='vertical' size={0}>
                  <Typography.Text strong>
                    {record.event?.title ?? 'Unknown event'}
                  </Typography.Text>
                  <Typography.Text type='secondary'>
                    {record.tierName ?? '-'} / {record.orderStatus}
                  </Typography.Text>
                </Space>
              ),
            },
            {
              dataIndex: 'source',
              key: 'source',
              title: 'Source',
              render: (value: FulfillmentRow['source']) => (
                <Tag color={sourceMeta[value ?? '']?.color ?? 'default'}>
                  {sourceMeta[value ?? '']?.label ?? value ?? 'Unknown'}
                </Tag>
              ),
            },
            {
              dataIndex: 'status',
              key: 'status',
              title: 'Fulfillment status',
              render: (value: string) => (
                <Tag color={fulfillmentStatusMeta[value]?.color ?? 'default'}>
                  {fulfillmentStatusMeta[value]?.label ?? value}
                </Tag>
              ),
            },
            {
              dataIndex: 'ticketCode',
              key: 'ticketCode',
              title: 'Ticket code',
              render: (value?: string) => value ?? '-',
            },
            {
              dataIndex: 'externalRef',
              key: 'externalRef',
              title: 'External ref',
              render: (value?: string) => value ?? '-',
            },
            {
              dataIndex: 'occurredAt',
              key: 'occurredAt',
              title: 'Occurred at',
              render: (value: string) => formatDateTime(value),
            },
          ]}
          dataSource={filteredRows}
          loading={loading}
          rowKey='id'
        />
      </Space>
    </div>
  );
}
