import { Alert, Button, Input, Select, Space, Table, Tag, Typography } from 'antd';
import { useEffect, useState } from 'react';

import { request } from '../../services/request';

type RefundRow = {
  event?: {
    city: string;
    id: string;
    title: string;
    venueName: string;
  };
  id: string;
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  processedAt?: string;
  reason: string;
  refundAmount: number;
  refundNo: string;
  requestedAmount: number;
  requestedAt: string;
  serviceFee: number;
  sessionName?: string;
  status: string;
  userId: string;
};

const refundStatusMeta: Record<string, { color: string; label: string }> = {
  APPROVED: { color: 'blue', label: 'Approved' },
  COMPLETED: { color: 'green', label: 'Completed' },
  PROCESSING: { color: 'cyan', label: 'Processing' },
  REJECTED: { color: 'red', label: 'Rejected' },
  REVIEWING: { color: 'gold', label: 'Reviewing' },
};

const refundStatusOptions = Object.entries(refundStatusMeta).map(
  ([value, meta]) => ({
    label: meta.label,
    value,
  }),
);

function formatAmount(amount: number) {
  return new Intl.NumberFormat('zh-CN', {
    currency: 'CNY',
    style: 'currency',
  }).format(amount / 100);
}

function formatDateTime(value: string | undefined) {
  if (!value) {
    return '-';
  }

  return new Date(value).toLocaleString('zh-CN', {
    hour12: false,
  });
}

export function RefundsPage() {
  const [rows, setRows] = useState<RefundRow[]>([]);
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>();

  async function loadRefunds() {
    setLoading(true);
    setError(undefined);

    try {
      const response = await request<{ items: RefundRow[] }>('/refunds/admin');
      setRows(response.items ?? []);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load refunds.',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRefunds();
  }, []);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredRows = rows.filter((row) => {
    if (statusFilter && row.status !== statusFilter) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    return [
      row.refundNo,
      row.orderNumber,
      row.userId,
      row.event?.title,
      row.reason,
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
            Refund operations
          </Typography.Title>
          <Typography.Paragraph style={{ marginBottom: 0 }}>
            Live refund request queue with requested amounts, service fees, and
            callback outcomes.
          </Typography.Paragraph>
        </div>

        {error ? <Alert message={error} showIcon type='error' /> : null}

        <Space wrap>
          <Input
            allowClear
            onChange={(event) => setQuery(event.target.value)}
            placeholder='Search refund, order, customer, event, or reason'
            style={{ width: 320 }}
            value={query}
          />
          <Select
            allowClear
            onChange={(value) => setStatusFilter(value)}
            options={refundStatusOptions}
            placeholder='Filter by refund status'
            style={{ width: 200 }}
            value={statusFilter}
          />
          <Button loading={loading} onClick={() => void loadRefunds()}>
            Refresh
          </Button>
        </Space>

        <Table<RefundRow>
          columns={[
            {
              dataIndex: 'refundNo',
              key: 'refundNo',
              title: 'Refund',
              render: (_value: string, record) => (
                <Space direction='vertical' size={0}>
                  <Typography.Text strong>{record.refundNo}</Typography.Text>
                  <Typography.Text type='secondary'>
                    {record.orderNumber} / {record.userId}
                  </Typography.Text>
                </Space>
              ),
            },
            {
              dataIndex: 'event',
              key: 'event',
              title: 'Event',
              render: (_value: RefundRow['event'], record) => (
                <Space direction='vertical' size={0}>
                  <Typography.Text strong>
                    {record.event?.title ?? 'Unknown event'}
                  </Typography.Text>
                  <Typography.Text type='secondary'>
                    {record.sessionName ?? '-'} / {record.orderStatus}
                  </Typography.Text>
                </Space>
              ),
            },
            {
              dataIndex: 'status',
              key: 'status',
              title: 'Status',
              render: (_value: string, record) => (
                <Space direction='vertical' size={4}>
                  <Tag color={refundStatusMeta[record.status]?.color ?? 'default'}>
                    {refundStatusMeta[record.status]?.label ?? record.status}
                  </Tag>
                  <Typography.Text type='secondary'>{record.reason}</Typography.Text>
                </Space>
              ),
            },
            {
              dataIndex: 'refundAmount',
              key: 'refundAmount',
              title: 'Amounts',
              render: (_value: number, record) => (
                <Space direction='vertical' size={0}>
                  <Typography.Text strong>
                    Refund: {formatAmount(record.refundAmount)}
                  </Typography.Text>
                  <Typography.Text type='secondary'>
                    Requested: {formatAmount(record.requestedAmount)} / Fee:{' '}
                    {formatAmount(record.serviceFee)}
                  </Typography.Text>
                </Space>
              ),
            },
            {
              dataIndex: 'requestedAt',
              key: 'requestedAt',
              title: 'Timeline',
              render: (_value: string, record) => (
                <Space direction='vertical' size={0}>
                  <Typography.Text>
                    Requested: {formatDateTime(record.requestedAt)}
                  </Typography.Text>
                  <Typography.Text type='secondary'>
                    Processed: {formatDateTime(record.processedAt)}
                  </Typography.Text>
                </Space>
              ),
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
