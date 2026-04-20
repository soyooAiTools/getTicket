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
import {
  formatTicketTaskEventSummary,
  formatTicketTaskTicketSummary,
  labelRunStatus,
  labelTicketTaskExecutionObjective,
  labelValidationMode,
  runStatusColors,
} from '../../shared/console-copy';

type OverviewPageViewProps = {
  error?: string;
  loading: boolean;
  nodePools: NodePool[];
  onRefresh?: () => void;
  runs: ControlRunRecord[];
  templates: ScenarioTemplate[];
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
          作战总览
        </Typography.Title>
        <Typography.Paragraph style={{ marginBottom: 0 }}>
          查看当前演练态势、可用节点资源和最近任务，快速进入新建任务或任务作战台。
        </Typography.Paragraph>
      </div>

      {error ? <Alert message={error} showIcon type='error' /> : null}

      <Space wrap>
        <Button loading={loading} onClick={onRefresh}>
          刷新
        </Button>
        <Button type='primary'>
          <Link to='/runs'>新建抢票任务</Link>
        </Button>
        {comparisonLink ? (
          <Button>
            <Link to={comparisonLink}>打开最近一次校准复盘</Link>
          </Button>
        ) : null}
      </Space>

      <Row gutter={[16, 16]}>
        <Col span={6}>
          <Card>
            <Statistic title='运行中任务' value={countActiveRuns(runs)} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title='已完成任务' value={completedRuns.length} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title='节点池' value={nodePools.length} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title='任务模板' value={templates.length} />
          </Card>
        </Col>
      </Row>

      <Card title='最近任务'>
        <Table<ControlRunRecord>
          columns={[
            {
              dataIndex: 'id',
              key: 'task',
              title: '任务',
              render: (_value: string, record) => (
                <Space direction='vertical' size={0}>
                  <Link to={`/runs/${record.id}`}>
                    {formatTicketTaskEventSummary(record.ticketTask)}
                  </Link>
                  <Typography.Text type='secondary'>
                    {record.id} / {labelValidationMode(record.mode)}
                  </Typography.Text>
                </Space>
              ),
            },
            {
              key: 'ticket',
              title: '票档目标',
              render: (_value: unknown, record) => (
                <Space direction='vertical' size={0}>
                  <Typography.Text>
                    {formatTicketTaskTicketSummary(record.ticketTask)}
                  </Typography.Text>
                  <Typography.Text type='secondary'>
                    {record.targetBaseUrl}
                  </Typography.Text>
                </Space>
              ),
            },
            {
              key: 'nodePoolId',
              title: '节点池',
              render: (_value: unknown, record) =>
                nodePoolNames.get(record.nodePoolId) ?? record.nodePoolId,
            },
            {
              key: 'objective',
              title: '执行目标',
              render: (_value: unknown, record) =>
                record.ticketTask
                  ? labelTicketTaskExecutionObjective(
                      record.ticketTask.executionStrategy.objective,
                    )
                  : '-',
            },
            {
              dataIndex: 'status',
              key: 'status',
              title: '状态',
              render: (value: ControlRunRecord['status']) => (
                <Tag color={runStatusColors[value]}>{labelRunStatus(value)}</Tag>
              ),
            },
            {
              dataIndex: 'updatedAt',
              key: 'updatedAt',
              title: '更新时间',
              render: (value: string) => formatTimestamp(value),
            },
          ]}
          dataSource={recentRuns}
          loading={loading}
          pagination={false}
          rowKey='id'
        />
      </Card>

      <Card title='已预置任务模板'>
        <Row gutter={[16, 16]}>
          {templates.map((template) => (
            <Col key={template.id} span={12}>
              <Card size='small'>
                <Space direction='vertical' size={4} style={{ display: 'flex' }}>
                  <Typography.Text strong>{template.name}</Typography.Text>
                  <Typography.Text type='secondary'>
                    {template.description}
                  </Typography.Text>
                  <Typography.Text>
                    {formatTicketTaskEventSummary(template.definition.ticketTask)}
                  </Typography.Text>
                  <Typography.Text type='secondary'>
                    {formatTicketTaskTicketSummary(template.definition.ticketTask)}
                  </Typography.Text>
                  <Space wrap>
                    <Tag>{labelValidationMode(template.definition.mode)}</Tag>
                    {template.definition.ticketTask ? (
                      <Tag>
                        {labelTicketTaskExecutionObjective(
                          template.definition.ticketTask.executionStrategy.objective,
                        )}
                      </Tag>
                    ) : null}
                    <Tag>全局 QPS {template.definition.maxGlobalQps}</Tag>
                    <Tag>单节点 {template.definition.maxNodeConcurrency}</Tag>
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
          : '无法加载作战总览。',
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
