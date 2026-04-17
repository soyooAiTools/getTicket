import { Alert, Button, Input, Select, Space, Table, Tag, Typography } from 'antd';
import { useEffect, useState } from 'react';

import { request } from '../../services/request';

type AdminOrderRow = {
  createdAt: string;
  currency: string;
  event?: {
    city: string;
    id: string;
    title: string;
    venueName: string;
  };
  id: string;
  itemCount: number;
  latestPayment?: {
    paidAt?: string;
    providerTxnId?: string;
    status: string;
  };
  latestRefundRequest?: {
    refundNo: string;
    status: string;
  };
  orderNumber: string;
  sessionName?: string;
  status: string;
  ticketType: string;
  totalAmount: number;
  userId: string;
};

const orderStatusMeta: Record<string, { color: string; label: string }> = {
  CLOSED: { color: 'default', label: 'Closed' },
  COMPLETED: { color: 'green', label: 'Completed' },
  PAID_PENDING_FULFILLMENT: { color: 'gold', label: 'Pending fulfillment' },
  PENDING_PAYMENT: { color: 'default', label: 'Pending payment' },
  REFUNDED: { color: 'blue', label: 'Refunded' },
  REFUND_PROCESSING: { color: 'cyan', label: 'Refund processing' },
  REFUND_REVIEWING: { color: 'orange', label: 'Refund reviewing' },
  SUBMITTED_TO_VENDOR: { color: 'purple', label: 'Submitted to vendor' },
  TICKET_FAILED: { color: 'red', label: 'Ticket failed' },
  TICKET_ISSUED: { color: 'green', label: 'Ticket issued' },
};

const paymentStatusMeta: Record<string, { color: string; label: string }> = {
  FAILED: { color: 'red', label: 'Payment failed' },
  PENDING: { color: 'default', label: 'Payment pending' },
  REFUNDED: { color: 'blue', label: 'Payment refunded' },
  SUCCEEDED: { color: 'green', label: 'Paid' },
};

const refundStatusMeta: Record<string, { color: string; label: string }> = {
  APPROVED: { color: 'blue', label: 'Refund approved' },
  COMPLETED: { color: 'green', label: 'Refund completed' },
  PROCESSING: { color: 'cyan', label: 'Refund processing' },
  REJECTED: { color: 'red', label: 'Refund rejected' },
  REVIEWING: { color: 'gold', label: 'Refund reviewing' },
};

const orderStatusOptions = [
  'PENDING_PAYMENT',
  'PAID_PENDING_FULFILLMENT',
  'SUBMITTED_TO_VENDOR',
  'TICKET_ISSUED',
  'TICKET_FAILED',
  'REFUND_REVIEWING',
  'REFUND_PROCESSING',
  'REFUNDED',
  'COMPLETED',
  'CLOSED',
].map((value) => ({
  label: orderStatusMeta[value]?.label ?? value,
  value,
}));

function formatAmount(amount: number, currency: string) {
  return new Intl.NumberFormat('zh-CN', {
    currency,
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

export function OrdersPage() {
  const [rows, setRows] = useState<AdminOrderRow[]>([]);
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>();

  async function loadOrders() {
    setLoading(true);
    setError(undefined);

    try {
      const response = await request<{ items: AdminOrderRow[] }>('/orders/admin');
      setRows(response.items ?? []);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load orders.',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadOrders();
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
      row.orderNumber,
      row.userId,
      row.event?.title,
      row.sessionName,
      row.latestRefundRequest?.refundNo,
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
            Order operations
          </Typography.Title>
          <Typography.Paragraph style={{ marginBottom: 0 }}>
            Live order queue for payment, fulfillment, issuance, and refund
            exceptions.
          </Typography.Paragraph>
        </div>

        {error ? <Alert message={error} showIcon type='error' /> : null}

        <Space wrap>
          <Input
            allowClear
            onChange={(event) => setQuery(event.target.value)}
            placeholder='Search order, customer, event, or refund number'
            style={{ width: 320 }}
            value={query}
          />
          <Select
            allowClear
            onChange={(value) => setStatusFilter(value)}
            options={orderStatusOptions}
            placeholder='Filter by order status'
            style={{ width: 220 }}
            value={statusFilter}
          />
          <Button loading={loading} onClick={() => void loadOrders()}>
            Refresh
          </Button>
        </Space>

        <Table<AdminOrderRow>
          columns={[
            {
              dataIndex: 'orderNumber',
              key: 'orderNumber',
              title: 'Order',
              render: (_value: string, record) => (
                <Space direction='vertical' size={0}>
                  <Typography.Text strong>{record.orderNumber}</Typography.Text>
                  <Typography.Text type='secondary'>{record.userId}</Typography.Text>
                </Space>
              ),
            },
            {
              dataIndex: 'event',
              key: 'event',
              title: 'Event',
              render: (_value: AdminOrderRow['event'], record) => (
                <Space direction='vertical' size={0}>
                  <Typography.Text strong>
                    {record.event?.title ?? 'Unknown event'}
                  </Typography.Text>
                  <Typography.Text type='secondary'>
                    {record.sessionName ?? '-'} / {record.itemCount} tickets
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
                  <Space wrap>
                    <Tag color={orderStatusMeta[record.status]?.color ?? 'default'}>
                      {orderStatusMeta[record.status]?.label ?? record.status}
                    </Tag>
                    {record.latestPayment ? (
                      <Tag
                        color={
                          paymentStatusMeta[record.latestPayment.status]?.color ??
                          'default'
                        }
                      >
                        {paymentStatusMeta[record.latestPayment.status]?.label ??
                          record.latestPayment.status}
                      </Tag>
                    ) : null}
                    {record.latestRefundRequest ? (
                      <Tag
                        color={
                          refundStatusMeta[record.latestRefundRequest.status]?.color ??
                          'default'
                        }
                      >
                        {refundStatusMeta[record.latestRefundRequest.status]?.label ??
                          record.latestRefundRequest.status}
                      </Tag>
                    ) : null}
                  </Space>
                  <Typography.Text type='secondary'>
                    {record.latestRefundRequest?.refundNo ??
                      record.latestPayment?.providerTxnId ??
                      '-'}
                  </Typography.Text>
                </Space>
              ),
            },
            {
              dataIndex: 'totalAmount',
              key: 'totalAmount',
              title: 'Amount',
              render: (_value: number, record) => (
                <Space direction='vertical' size={0}>
                  <Typography.Text strong>
                    {formatAmount(record.totalAmount, record.currency)}
                  </Typography.Text>
                  <Typography.Text type='secondary'>
                    {record.ticketType}
                  </Typography.Text>
                </Space>
              ),
            },
            {
              dataIndex: 'createdAt',
              key: 'createdAt',
              title: 'Timeline',
              render: (_value: string, record) => (
                <Space direction='vertical' size={0}>
                  <Typography.Text>{formatDateTime(record.createdAt)}</Typography.Text>
                  <Typography.Text type='secondary'>
                    Paid: {formatDateTime(record.latestPayment?.paidAt)}
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
