import type {
  LiveRunSnapshot,
  NodePool,
  NodeRunSummary,
  PlannedNodeAssignment,
} from '../../../../../packages/contracts/src';

import {
  Alert,
  Button,
  Card,
  Descriptions,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { useRunStream, type RunStreamState } from '../../hooks/use-run-stream';
import {
  getLiveRunSnapshot,
  getRun,
  listNodePools,
  planRun,
  startRun,
  stopRun,
  type LoadControlRun,
} from '../../services/load-control';
import {
  formatTicketTaskEventSummary,
  formatTicketTaskTicketSummary,
  labelNodeHealthStatus,
  labelNodeRole,
  labelRunStatus,
  labelRunStreamState,
  labelTicketTaskExecutionObjective,
  labelTicketTaskLaunchMode,
  labelValidationMode,
  runStatusColors,
} from '../../shared/console-copy';

type RunDetailPageViewProps = {
  actionPending?: 'plan' | 'start' | 'stop';
  error?: string;
  liveSnapshot?: LiveRunSnapshot;
  loading: boolean;
  nodePools?: NodePool[];
  onPlan?: () => void;
  onStart?: () => void;
  onStop?: () => void;
  run?: LoadControlRun;
  runId?: string;
  streamError?: string;
  streamState: RunStreamState;
};

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString('zh-CN', {
    hour12: false,
  });
}

function flattenPhaseSummaries(summaries: NodeRunSummary[]) {
  return summaries.flatMap((summary) =>
    summary.phaseSummaries.map((phaseSummary) => ({
      averageLatencyMs: phaseSummary.averageLatencyMs,
      nodeId: summary.nodeId,
      phaseId: phaseSummary.phaseId,
      requestCount: phaseSummary.requestCount,
      successCount: phaseSummary.successCount,
    })),
  );
}

export function RunDetailPageView({
  actionPending,
  error,
  liveSnapshot,
  loading,
  nodePools,
  onPlan,
  onStart,
  onStop,
  run,
  runId,
  streamError,
  streamState,
}: RunDetailPageViewProps) {
  const resolvedRunId = run?.definition.id ?? runId ?? 'unknown-run';
  const liveNodes = liveSnapshot?.nodes ?? [];
  const phaseRows = run?.definition.phases ?? [];
  const assignments = run?.assignments ?? [];
  const phaseSummaries = flattenPhaseSummaries(run?.summaries ?? []);
  const ticketTask = run?.definition.ticketTask;
  const nodePoolNames = useMemo(
    () => new Map((nodePools ?? []).map((pool) => [pool.id, pool.name])),
    [nodePools],
  );

  return (
    <Space direction='vertical' size={24} style={{ display: 'flex' }}>
      <div>
        <Typography.Title level={2} style={{ marginBottom: 8 }}>
          任务作战台
        </Typography.Title>
        <Typography.Paragraph style={{ marginBottom: 0 }}>
          查看任务 <Typography.Text code>{resolvedRunId}</Typography.Text>{' '}
          的节点分配、实时遥测和阶段汇总。
        </Typography.Paragraph>
      </div>

      <Space wrap>
        <Button>
          <Link to='/runs'>返回任务列表</Link>
        </Button>
        <Button loading={actionPending === 'plan'} onClick={onPlan}>
          规划任务
        </Button>
        <Button loading={actionPending === 'start'} onClick={onStart} type='primary'>
          启动任务
        </Button>
        <Button danger loading={actionPending === 'stop'} onClick={onStop}>
          停止任务
        </Button>
      </Space>

      {error ? <Alert message={error} showIcon type='error' /> : null}
      {streamError ? <Alert message={streamError} showIcon type='warning' /> : null}

      <Card loading={loading}>
        <Space direction='vertical' size={16} style={{ display: 'flex' }}>
          <Space wrap>
            <Tag color={runStatusColors[run?.status ?? 'DRAFT']}>
              {labelRunStatus(run?.status ?? 'DRAFT')}
            </Tag>
            <Tag>{labelRunStreamState(streamState)}</Tag>
            {liveSnapshot?.currentPhaseId ? (
              <Tag color='blue'>当前阶段 {liveSnapshot.currentPhaseId}</Tag>
            ) : null}
          </Space>
          <Descriptions column={2} size='small'>
            <Descriptions.Item label='任务编号'>{resolvedRunId}</Descriptions.Item>
            <Descriptions.Item label='执行模式'>
              {run ? labelValidationMode(run.definition.mode) : '-'}
            </Descriptions.Item>
            <Descriptions.Item label='目标地址'>
              {run?.definition.targetBaseUrl ?? '-'}
            </Descriptions.Item>
            <Descriptions.Item label='库存池'>
              {run?.definition.inventoryPoolId ?? '-'}
            </Descriptions.Item>
            <Descriptions.Item label='标签'>
              {run
                ? Object.entries(run.definition.tags)
                    .map(([key, value]) => `${key}=${value}`)
                    .join(', ')
                : '-'}
            </Descriptions.Item>
            <Descriptions.Item label='最新快照'>
              {liveSnapshot ? formatTimestamp(liveSnapshot.updatedAt) : '-'}
            </Descriptions.Item>
          </Descriptions>
        </Space>
      </Card>

      <Card title='抢票目标摘要'>
        {ticketTask ? (
          <Descriptions column={2} size='small'>
            <Descriptions.Item label='场次信息'>
              {formatTicketTaskEventSummary(ticketTask)}
            </Descriptions.Item>
            <Descriptions.Item label='票档目标'>
              {formatTicketTaskTicketSummary(ticketTask)}
            </Descriptions.Item>
            <Descriptions.Item label='平台'>
              {ticketTask.event.platform}
            </Descriptions.Item>
            <Descriptions.Item label='场馆'>
              {ticketTask.event.venue ?? '-'}
            </Descriptions.Item>
            <Descriptions.Item label='节点策略'>
              {(nodePoolNames.get(ticketTask.nodeStrategy.poolId) ??
                ticketTask.nodeStrategy.poolId) +
                ' / ' +
                labelTicketTaskLaunchMode(ticketTask.nodeStrategy.launchMode)}
            </Descriptions.Item>
            <Descriptions.Item label='执行目标'>
              {labelTicketTaskExecutionObjective(
                ticketTask.executionStrategy.objective,
              )}
            </Descriptions.Item>
            <Descriptions.Item label='开售时间'>
              {ticketTask.event.saleStartsAt
                ? formatTimestamp(ticketTask.event.saleStartsAt)
                : '-'}
            </Descriptions.Item>
            <Descriptions.Item label='预热秒数'>
              {ticketTask.executionStrategy.prewarmSeconds}
            </Descriptions.Item>
          </Descriptions>
        ) : (
          <Typography.Text type='secondary'>
            当前任务还没有抢票任务元数据。
          </Typography.Text>
        )}
      </Card>

      <Space size={16} style={{ display: 'flex' }} wrap>
        <Card>
          <Statistic title='节点分配' value={assignments.length} />
        </Card>
        <Card>
          <Statistic title='已回传汇总' value={run?.summaries.length ?? 0} />
        </Card>
        <Card>
          <Statistic title='聚合 QPS' value={liveSnapshot?.aggregateQps ?? 0} />
        </Card>
        <Card>
          <Statistic
            precision={2}
            title='聚合错误率'
            value={liveSnapshot?.aggregateErrorRate ?? 0}
          />
        </Card>
      </Space>

      <Card title='阶段计划'>
        <Table
          columns={[
            { dataIndex: 'id', key: 'id', title: '阶段' },
            {
              dataIndex: 'durationMs',
              key: 'durationMs',
              title: '持续时间(ms)',
            },
            {
              dataIndex: 'queryConcurrency',
              key: 'queryConcurrency',
              title: '查询',
            },
            {
              dataIndex: 'queuePollingConcurrency',
              key: 'queuePollingConcurrency',
              title: '排队',
            },
            {
              dataIndex: 'inventoryLockConcurrency',
              key: 'inventoryLockConcurrency',
              title: '锁库',
            },
            {
              dataIndex: 'orderSubmissionConcurrency',
              key: 'orderSubmissionConcurrency',
              title: '下单',
            },
          ]}
          dataSource={phaseRows}
          pagination={false}
          rowKey='id'
        />
      </Card>

      <Card title='节点分配'>
        <Table<PlannedNodeAssignment>
          columns={[
            { dataIndex: 'nodeId', key: 'nodeId', title: '节点' },
            { dataIndex: 'region', key: 'region', title: '区域' },
            {
              dataIndex: 'role',
              key: 'role',
              title: '角色',
              render: (value: PlannedNodeAssignment['role']) => labelNodeRole(value),
            },
            {
              key: 'networkProfile',
              title: '网络画像',
              render: (_value: unknown, record) => record.networkProfile.label,
            },
            {
              key: 'phaseCount',
              title: '阶段数',
              render: (_value: unknown, record) => record.phases.length,
            },
          ]}
          dataSource={assignments}
          pagination={false}
          rowKey='nodeId'
        />
      </Card>

      <Card title='节点汇总'>
        <Table<NodeRunSummary>
          columns={[
            { dataIndex: 'nodeId', key: 'nodeId', title: '节点' },
            { dataIndex: 'averageRttMs', key: 'averageRttMs', title: '平均 RTT' },
            {
              dataIndex: 'startupSkewMs',
              key: 'startupSkewMs',
              title: '启动偏移',
            },
            {
              key: 'phaseCount',
              title: '阶段数',
              render: (_value: unknown, record) => record.phaseSummaries.length,
            },
          ]}
          dataSource={run?.summaries ?? []}
          pagination={false}
          rowKey='nodeId'
        />
      </Card>

      <Card title='阶段汇总'>
        <Table
          columns={[
            { dataIndex: 'nodeId', key: 'nodeId', title: '节点' },
            { dataIndex: 'phaseId', key: 'phaseId', title: '阶段' },
            {
              dataIndex: 'requestCount',
              key: 'requestCount',
              title: '请求数',
            },
            {
              dataIndex: 'successCount',
              key: 'successCount',
              title: '成功数',
            },
            {
              dataIndex: 'averageLatencyMs',
              key: 'averageLatencyMs',
              title: '平均延迟',
            },
          ]}
          dataSource={phaseSummaries}
          pagination={false}
          rowKey={(row) => `${row.nodeId}:${row.phaseId}`}
        />
      </Card>

      <Card title='实时节点'>
        <Table
          columns={[
            { dataIndex: 'nodeId', key: 'nodeId', title: '节点' },
            {
              dataIndex: 'status',
              key: 'status',
              title: '状态',
              render: (value: LiveRunSnapshot['nodes'][number]['status']) =>
                labelNodeHealthStatus(value),
            },
            { dataIndex: 'phaseId', key: 'phaseId', title: '阶段' },
            { dataIndex: 'qps', key: 'qps', title: 'QPS' },
            { dataIndex: 'errorRate', key: 'errorRate', title: '错误率' },
            {
              dataIndex: 'p95LatencyMs',
              key: 'p95LatencyMs',
              title: 'P95 延迟',
            },
            {
              dataIndex: 'activeWorkers',
              key: 'activeWorkers',
              title: '活跃 Worker',
            },
          ]}
          dataSource={liveNodes}
          pagination={false}
          rowKey='nodeId'
        />
      </Card>

      <Card title='实时告警'>
        {liveSnapshot?.alerts.length ? (
          <Space direction='vertical' size={8} style={{ display: 'flex' }}>
            {liveSnapshot.alerts.map((alert) => (
              <Alert
                key={alert.id}
                message={alert.message}
                showIcon
                type={alert.severity === 'CRITICAL' ? 'error' : 'warning'}
              />
            ))}
          </Space>
        ) : (
          <Typography.Text type='secondary'>
            当前任务暂无实时告警。
          </Typography.Text>
        )}
      </Card>
    </Space>
  );
}

export function RunDetailPage() {
  const { runId } = useParams<{ runId: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [actionPending, setActionPending] = useState<'plan' | 'start' | 'stop'>();
  const [run, setRun] = useState<LoadControlRun>();
  const [liveSnapshot, setLiveSnapshot] = useState<LiveRunSnapshot>();
  const [nodePools, setNodePools] = useState<NodePool[]>([]);
  const stream = useRunStream(runId);

  async function loadRunDetail() {
    if (!runId) {
      setError('缺少任务编号。');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(undefined);

    try {
      const [nextRun, nextSnapshot, nextNodePools] = await Promise.all([
        getRun(runId),
        getLiveRunSnapshot(runId),
        listNodePools(),
      ]);

      setRun(nextRun);
      setLiveSnapshot(nextSnapshot);
      setNodePools(nextNodePools);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : `无法加载任务 ${runId}。`,
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRunDetail();
  }, [runId]);

  useEffect(() => {
    if (!stream.snapshot) {
      return;
    }

    setLiveSnapshot(stream.snapshot);
    setRun((current) =>
      current
        ? {
            ...current,
            status: stream.snapshot?.status ?? current.status,
          }
        : current,
    );
  }, [stream.snapshot]);

  async function handleAction(action: 'plan' | 'start' | 'stop') {
    if (!runId) {
      return;
    }

    setActionPending(action);
    setError(undefined);

    try {
      if (action === 'plan') {
        setRun(await planRun(runId));
      }

      if (action === 'start') {
        setRun(await startRun(runId));
      }

      if (action === 'stop') {
        setRun(await stopRun(runId));
      }

      setLiveSnapshot(await getLiveRunSnapshot(runId));
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : `无法执行任务操作：${runId}。`,
      );
    } finally {
      setActionPending(undefined);
    }
  }

  return (
    <RunDetailPageView
      actionPending={actionPending}
      error={error}
      liveSnapshot={liveSnapshot}
      loading={loading}
      nodePools={nodePools}
      onPlan={() => void handleAction('plan')}
      onStart={() => void handleAction('start')}
      onStop={() => void handleAction('stop')}
      run={run}
      runId={runId}
      streamError={stream.error}
      streamState={stream.state}
    />
  );
}
