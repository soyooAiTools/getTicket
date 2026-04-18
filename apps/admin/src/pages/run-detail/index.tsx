import type {
  LiveRunSnapshot,
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
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { useRunStream, type RunStreamState } from '../../hooks/use-run-stream';
import {
  getLiveRunSnapshot,
  getRun,
  planRun,
  startRun,
  stopRun,
  type LoadControlRun,
} from '../../services/load-control';

type RunDetailPageViewProps = {
  actionPending?: 'plan' | 'start' | 'stop';
  error?: string;
  liveSnapshot?: LiveRunSnapshot;
  loading: boolean;
  onPlan?: () => void;
  onStart?: () => void;
  onStop?: () => void;
  run?: LoadControlRun;
  runId?: string;
  streamError?: string;
  streamState: RunStreamState;
};

const statusColors = {
  COMPLETED: 'green',
  DRAFT: 'default',
  FAILED: 'red',
  PLANNED: 'gold',
  RUNNING: 'blue',
  STOPPED: 'default',
  STOPPING: 'orange',
} as const;

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

  return (
    <Space direction='vertical' size={24} style={{ display: 'flex' }}>
      <div>
        <Typography.Title level={2} style={{ marginBottom: 8 }}>
          Run detail
        </Typography.Title>
        <Typography.Paragraph style={{ marginBottom: 0 }}>
          Inspect assignments, live telemetry, and summary rollups for{' '}
          <Typography.Text code>{resolvedRunId}</Typography.Text>.
        </Typography.Paragraph>
      </div>

      <Space wrap>
        <Button>
          <Link to='/runs'>Back to runs</Link>
        </Button>
        <Button loading={actionPending === 'plan'} onClick={onPlan}>
          Plan run
        </Button>
        <Button loading={actionPending === 'start'} onClick={onStart} type='primary'>
          Start run
        </Button>
        <Button danger loading={actionPending === 'stop'} onClick={onStop}>
          Stop run
        </Button>
      </Space>

      {error ? <Alert message={error} showIcon type='error' /> : null}
      {streamError ? <Alert message={streamError} showIcon type='warning' /> : null}

      <Card loading={loading}>
        <Space direction='vertical' size={16} style={{ display: 'flex' }}>
          <Space wrap>
            <Tag color={statusColors[run?.status ?? 'DRAFT']}>
              {run?.status ?? 'DRAFT'}
            </Tag>
            <Tag>{streamState.toUpperCase()}</Tag>
            {liveSnapshot?.currentPhaseId ? (
              <Tag color='blue'>Phase {liveSnapshot.currentPhaseId}</Tag>
            ) : null}
          </Space>
          <Descriptions column={2} size='small'>
            <Descriptions.Item label='Run id'>{resolvedRunId}</Descriptions.Item>
            <Descriptions.Item label='Mode'>
              {run?.definition.mode ?? '-'}
            </Descriptions.Item>
            <Descriptions.Item label='Target'>
              {run?.definition.targetBaseUrl ?? '-'}
            </Descriptions.Item>
            <Descriptions.Item label='Inventory pool'>
              {run?.definition.inventoryPoolId ?? '-'}
            </Descriptions.Item>
            <Descriptions.Item label='Tags'>
              {run
                ? Object.entries(run.definition.tags)
                    .map(([key, value]) => `${key}=${value}`)
                    .join(', ')
                : '-'}
            </Descriptions.Item>
            <Descriptions.Item label='Latest snapshot'>
              {liveSnapshot ? formatTimestamp(liveSnapshot.updatedAt) : '-'}
            </Descriptions.Item>
          </Descriptions>
        </Space>
      </Card>

      <Space size={16} style={{ display: 'flex' }} wrap>
        <Card>
          <Statistic title='Assignments' value={assignments.length} />
        </Card>
        <Card>
          <Statistic title='Collected summaries' value={run?.summaries.length ?? 0} />
        </Card>
        <Card>
          <Statistic title='Aggregate QPS' value={liveSnapshot?.aggregateQps ?? 0} />
        </Card>
        <Card>
          <Statistic
            precision={2}
            title='Aggregate error rate'
            value={liveSnapshot?.aggregateErrorRate ?? 0}
          />
        </Card>
      </Space>

      <Card title='Phase plan'>
        <Table
          columns={[
            { dataIndex: 'id', key: 'id', title: 'Phase' },
            {
              dataIndex: 'durationMs',
              key: 'durationMs',
              title: 'Duration (ms)',
            },
            {
              dataIndex: 'queryConcurrency',
              key: 'queryConcurrency',
              title: 'Query',
            },
            {
              dataIndex: 'queuePollingConcurrency',
              key: 'queuePollingConcurrency',
              title: 'Queue',
            },
            {
              dataIndex: 'inventoryLockConcurrency',
              key: 'inventoryLockConcurrency',
              title: 'Inventory',
            },
            {
              dataIndex: 'orderSubmissionConcurrency',
              key: 'orderSubmissionConcurrency',
              title: 'Orders',
            },
          ]}
          dataSource={phaseRows}
          pagination={false}
          rowKey='id'
        />
      </Card>

      <Card title='Assignments'>
        <Table<PlannedNodeAssignment>
          columns={[
            { dataIndex: 'nodeId', key: 'nodeId', title: 'Node' },
            { dataIndex: 'region', key: 'region', title: 'Region' },
            { dataIndex: 'role', key: 'role', title: 'Role' },
            {
              key: 'networkProfile',
              title: 'Network profile',
              render: (_value: unknown, record) => record.networkProfile.label,
            },
            {
              key: 'phaseCount',
              title: 'Phases',
              render: (_value: unknown, record) => record.phases.length,
            },
          ]}
          dataSource={assignments}
          pagination={false}
          rowKey='nodeId'
        />
      </Card>

      <Card title='Node summaries'>
        <Table<NodeRunSummary>
          columns={[
            { dataIndex: 'nodeId', key: 'nodeId', title: 'Node' },
            { dataIndex: 'averageRttMs', key: 'averageRttMs', title: 'Avg RTT' },
            {
              dataIndex: 'startupSkewMs',
              key: 'startupSkewMs',
              title: 'Startup skew',
            },
            {
              key: 'phaseCount',
              title: 'Phase count',
              render: (_value: unknown, record) => record.phaseSummaries.length,
            },
          ]}
          dataSource={run?.summaries ?? []}
          pagination={false}
          rowKey='nodeId'
        />
      </Card>

      <Card title='Phase summary rollup'>
        <Table
          columns={[
            { dataIndex: 'nodeId', key: 'nodeId', title: 'Node' },
            { dataIndex: 'phaseId', key: 'phaseId', title: 'Phase' },
            {
              dataIndex: 'requestCount',
              key: 'requestCount',
              title: 'Requests',
            },
            {
              dataIndex: 'successCount',
              key: 'successCount',
              title: 'Successes',
            },
            {
              dataIndex: 'averageLatencyMs',
              key: 'averageLatencyMs',
              title: 'Avg latency',
            },
          ]}
          dataSource={phaseSummaries}
          pagination={false}
          rowKey={(row) => `${row.nodeId}:${row.phaseId}`}
        />
      </Card>

      <Card title='Live nodes'>
        <Table
          columns={[
            { dataIndex: 'nodeId', key: 'nodeId', title: 'Node' },
            { dataIndex: 'status', key: 'status', title: 'Status' },
            { dataIndex: 'phaseId', key: 'phaseId', title: 'Phase' },
            { dataIndex: 'qps', key: 'qps', title: 'QPS' },
            { dataIndex: 'errorRate', key: 'errorRate', title: 'Error rate' },
            {
              dataIndex: 'p95LatencyMs',
              key: 'p95LatencyMs',
              title: 'P95 latency',
            },
            {
              dataIndex: 'activeWorkers',
              key: 'activeWorkers',
              title: 'Workers',
            },
          ]}
          dataSource={liveNodes}
          pagination={false}
          rowKey='nodeId'
        />
      </Card>

      <Card title='Live alerts'>
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
            No live alerts are active for this run.
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
  const stream = useRunStream(runId);

  async function loadRunDetail() {
    if (!runId) {
      setError('Missing run id.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(undefined);

    try {
      const [nextRun, nextSnapshot] = await Promise.all([
        getRun(runId),
        getLiveRunSnapshot(runId),
      ]);

      setRun(nextRun);
      setLiveSnapshot(nextSnapshot);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : `Unable to load run ${runId}.`,
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
          : `Unable to ${action} run ${runId}.`,
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
