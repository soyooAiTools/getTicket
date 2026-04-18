import type {
  ControlRunRecord,
  NodePool,
  ScenarioTemplate,
} from '../../../../../packages/contracts/src';

import {
  Alert,
  Button,
  Card,
  Col,
  Row,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  listNodePools,
  listRuns,
  listTemplates,
} from '../../services/load-control';

type OverviewPageViewProps = {
  error?: string;
  loading: boolean;
  nodePools: NodePool[];
  onRefresh?: () => void;
  runs: ControlRunRecord[];
  templates: ScenarioTemplate[];
};

const statusColors: Record<ControlRunRecord['status'], string> = {
  COMPLETED: 'green',
  DRAFT: 'default',
  FAILED: 'red',
  PLANNED: 'gold',
  RUNNING: 'blue',
  STOPPED: 'default',
  STOPPING: 'orange',
};

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString('zh-CN', {
    hour12: false,
  });
}

function countActiveRuns(runs: ControlRunRecord[]) {
  return runs.filter((run) => run.status === 'RUNNING' || run.status === 'STOPPING')
    .length;
}

export function OverviewPageView({
  error,
  loading,
  nodePools,
  onRefresh,
  runs,
  templates,
}: OverviewPageViewProps) {
  const templateNames = new Map(templates.map((template) => [template.id, template.name]));
  const nodePoolNames = new Map(nodePools.map((pool) => [pool.id, pool.name]));
  const recentRuns = [...runs]
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, 6);
  const completedRuns = [...runs]
    .filter((run) => run.status === 'COMPLETED')
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  const comparisonLink =
    completedRuns.length >= 2
      ? `/reports/${completedRuns[1].id}/${completedRuns[0].id}`
      : undefined;

  return (
    <Space direction='vertical' size={24} style={{ display: 'flex' }}>
      <div>
        <Typography.Title level={2} style={{ marginBottom: 8 }}>
          Operator overview
        </Typography.Title>
        <Typography.Paragraph style={{ marginBottom: 0 }}>
          Keep an eye on seeded capacity, active rehearsals, and the freshest
          runs that still need operator action.
        </Typography.Paragraph>
      </div>

      {error ? <Alert message={error} showIcon type='error' /> : null}

      <Space wrap>
        <Button loading={loading} onClick={onRefresh}>
          Refresh
        </Button>
        {comparisonLink ? (
          <Button type='primary'>
            <Link to={comparisonLink}>Open latest calibration report</Link>
          </Button>
        ) : null}
      </Space>

      <Row gutter={[16, 16]}>
        <Col span={6}>
          <Card>
            <Statistic title='Active runs' value={countActiveRuns(runs)} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title='Completed runs' value={completedRuns.length} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title='Node pools' value={nodePools.length} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title='Scenario templates' value={templates.length} />
          </Card>
        </Col>
      </Row>

      <Card title='Recent runs'>
        <Table<ControlRunRecord>
          columns={[
            {
              dataIndex: 'id',
              key: 'id',
              title: 'Run',
              render: (_value: string, record) => (
                <Space direction='vertical' size={0}>
                  <Link to={`/runs/${record.id}`}>{record.id}</Link>
                  <Typography.Text type='secondary'>
                    {record.targetBaseUrl}
                  </Typography.Text>
                </Space>
              ),
            },
            {
              dataIndex: 'templateId',
              key: 'templateId',
              title: 'Template',
              render: (value: string) => templateNames.get(value) ?? value,
            },
            {
              dataIndex: 'nodePoolId',
              key: 'nodePoolId',
              title: 'Node pool',
              render: (value: string) => nodePoolNames.get(value) ?? value,
            },
            {
              dataIndex: 'status',
              key: 'status',
              title: 'Status',
              render: (value: ControlRunRecord['status']) => (
                <Tag color={statusColors[value]}>{value}</Tag>
              ),
            },
            {
              dataIndex: 'updatedAt',
              key: 'updatedAt',
              title: 'Updated',
              render: (value: string) => formatTimestamp(value),
            },
          ]}
          dataSource={recentRuns}
          loading={loading}
          pagination={false}
          rowKey='id'
        />
      </Card>

      <Card title='Seeded scenario templates'>
        <Row gutter={[16, 16]}>
          {templates.map((template) => (
            <Col key={template.id} span={12}>
              <Card size='small'>
                <Space direction='vertical' size={4} style={{ display: 'flex' }}>
                  <Typography.Text strong>{template.name}</Typography.Text>
                  <Typography.Text type='secondary'>
                    {template.description}
                  </Typography.Text>
                  <Space wrap>
                    <Tag>{template.definition.mode}</Tag>
                    <Tag>{template.definition.maxGlobalQps} global QPS</Tag>
                    <Tag>{template.definition.maxNodeConcurrency} / node</Tag>
                  </Space>
                </Space>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>
    </Space>
  );
}

export function OverviewPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [runs, setRuns] = useState<ControlRunRecord[]>([]);
  const [nodePools, setNodePools] = useState<NodePool[]>([]);
  const [templates, setTemplates] = useState<ScenarioTemplate[]>([]);

  async function loadOverview() {
    setLoading(true);
    setError(undefined);

    try {
      const [nextRuns, nextNodePools, nextTemplates] = await Promise.all([
        listRuns(),
        listNodePools(),
        listTemplates(),
      ]);

      setRuns(nextRuns);
      setNodePools(nextNodePools);
      setTemplates(nextTemplates);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load the operator overview.',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadOverview();
  }, []);

  return (
    <OverviewPageView
      error={error}
      loading={loading}
      nodePools={nodePools}
      onRefresh={() => void loadOverview()}
      runs={runs}
      templates={templates}
    />
  );
}
