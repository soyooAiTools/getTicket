import type {
  NodePool,
  NodeRegistration,
} from '../../../../../packages/contracts/src';

import {
  Alert,
  Button,
  Card,
  Col,
  Row,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import { useEffect, useState } from 'react';

import { listNodePools, listNodes } from '../../services/load-control';

function formatLossRatio(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}

export function NodesPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [nodePools, setNodePools] = useState<NodePool[]>([]);
  const [nodes, setNodes] = useState<NodeRegistration[]>([]);

  async function loadNodeInventory() {
    setLoading(true);
    setError(undefined);

    try {
      const [nextPools, nextNodes] = await Promise.all([
        listNodePools(),
        listNodes(),
      ]);

      setNodePools(nextPools);
      setNodes(nextNodes);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load node inventory.',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadNodeInventory();
  }, []);

  return (
    <Space direction='vertical' size={24} style={{ display: 'flex' }}>
      <div>
        <Typography.Title level={2} style={{ marginBottom: 8 }}>
          Nodes
        </Typography.Title>
        <Typography.Paragraph style={{ marginBottom: 0 }}>
          Review seeded node pools and the currently registered runtime nodes
          that can accept assignments.
        </Typography.Paragraph>
      </div>

      {error ? <Alert message={error} showIcon type='error' /> : null}

      <Button loading={loading} onClick={() => void loadNodeInventory()}>
        Refresh
      </Button>

      <Card title='Seeded node pools'>
        <Row gutter={[16, 16]}>
          {nodePools.map((pool) => (
            <Col key={pool.id} span={12}>
              <Card size='small'>
                <Space direction='vertical' size={4} style={{ display: 'flex' }}>
                  <Typography.Text strong>{pool.name}</Typography.Text>
                  <Space wrap>
                    <Tag>{pool.region}</Tag>
                    <Tag>{pool.role}</Tag>
                    <Tag>{pool.maxNodes} max nodes</Tag>
                  </Space>
                  <Typography.Text type='secondary'>
                    Nodes: {pool.nodeIds.length ? pool.nodeIds.join(', ') : 'seed only'}
                  </Typography.Text>
                </Space>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>

      <Card title='Registered nodes'>
        <Table<NodeRegistration>
          columns={[
            { dataIndex: 'id', key: 'id', title: 'Node id' },
            { dataIndex: 'region', key: 'region', title: 'Region' },
            { dataIndex: 'role', key: 'role', title: 'Role' },
            {
              key: 'networkProfile',
              title: 'Network profile',
              render: (_value: unknown, record) => (
                <Space direction='vertical' size={0}>
                  <Typography.Text>{record.networkProfile.label}</Typography.Text>
                  <Typography.Text type='secondary'>
                    Base {record.networkProfile.baseLatencyMs} ms / jitter{' '}
                    {record.networkProfile.jitterMs} ms / loss{' '}
                    {formatLossRatio(record.networkProfile.packetLossRatio)}
                  </Typography.Text>
                </Space>
              ),
            },
            {
              dataIndex: 'maxConcurrency',
              key: 'maxConcurrency',
              title: 'Max concurrency',
            },
          ]}
          dataSource={nodes}
          loading={loading}
          rowKey='id'
        />
      </Card>
    </Space>
  );
}
