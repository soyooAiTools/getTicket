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
import { labelNodeRole } from '../../shared/console-copy';

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
          : '无法加载节点池信息。',
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
          节点池
        </Typography.Title>
        <Typography.Paragraph style={{ marginBottom: 0 }}>
          查看已预置的节点池和当前注册的执行节点，确认区域、角色和可用并发。
        </Typography.Paragraph>
      </div>

      {error ? <Alert message={error} showIcon type='error' /> : null}

      <Button loading={loading} onClick={() => void loadNodeInventory()}>
        刷新节点状态
      </Button>

      <Card title='已预置节点池'>
        <Row gutter={[16, 16]}>
          {nodePools.map((pool) => (
            <Col key={pool.id} span={12}>
              <Card size='small'>
                <Space direction='vertical' size={4} style={{ display: 'flex' }}>
                  <Typography.Text strong>{pool.name}</Typography.Text>
                  <Space wrap>
                    <Tag>{pool.region}</Tag>
                    <Tag>{labelNodeRole(pool.role)}</Tag>
                    <Tag>{pool.maxNodes} 台上限</Tag>
                  </Space>
                  <Typography.Text type='secondary'>
                    节点: {pool.nodeIds.length ? pool.nodeIds.join(', ') : '仅预置资源'}
                  </Typography.Text>
                </Space>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>

      <Card title='已注册节点'>
        <Table<NodeRegistration>
          columns={[
            { dataIndex: 'id', key: 'id', title: '节点编号' },
            { dataIndex: 'region', key: 'region', title: '区域' },
            {
              dataIndex: 'role',
              key: 'role',
              title: '角色',
              render: (value: NodeRegistration['role']) => labelNodeRole(value),
            },
            {
              key: 'networkProfile',
              title: '网络画像',
              render: (_value: unknown, record) => (
                <Space direction='vertical' size={0}>
                  <Typography.Text>{record.networkProfile.label}</Typography.Text>
                  <Typography.Text type='secondary'>
                    基线 {record.networkProfile.baseLatencyMs} ms / 抖动{' '}
                    {record.networkProfile.jitterMs} ms / 丢包{' '}
                    {formatLossRatio(record.networkProfile.packetLossRatio)}
                  </Typography.Text>
                </Space>
              ),
            },
            {
              dataIndex: 'maxConcurrency',
              key: 'maxConcurrency',
              title: '最大并发',
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
