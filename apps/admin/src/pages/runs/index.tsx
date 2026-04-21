import type {
  ControlRunDraft,
  ControlRunRecord,
  NodePool,
  ScenarioTemplate,
  TicketTask,
  TicketTaskExecutionObjective,
  TicketTaskLaunchMode,
} from '../../../../../packages/contracts/src';

import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import {
  createRun,
  listNodePools,
  listRuns,
  listTemplates,
  planRun,
  startRun,
  stopRun,
} from '../../services/load-control';
import {
  formatTicketTaskConsoleSummary,
  formatTicketTaskEventSummary,
  formatTicketTaskTicketSummary,
  labelRunStatus,
  labelTicketTaskExecutionObjective,
  labelTicketTaskLaunchMode,
  labelValidationMode,
  runStatusColors,
} from '../../shared/console-copy';

type SubmitAction = 'draft' | 'plan' | 'start';

type RunDraftFormState = {
  city: string;
  eventName: string;
  expectedNodeCount?: number;
  launchMode?: TicketTaskLaunchMode;
  lockRetryLimit?: number;
  maxGlobalQps?: number;
  maxNodeConcurrency?: number;
  nodePoolId?: string;
  objective?: TicketTaskExecutionObjective;
  orderSubmitLimit?: number;
  platform: string;
  preferredRegions: string;
  prewarmSeconds?: number;
  priceLabel: string;
  quantity?: number;
  queuePollIntervalMs?: number;
  runId: string;
  saleStartsAt: string;
  sessionLabel: string;
  targetBaseUrl: string;
  templateId?: string;
  testRunId: string;
  tierLabel: string;
  venue: string;
  workerLaunchIntervalMs?: number;
  zoneLabel: string;
};

const launchModeOptions: {
  label: string;
  value: TicketTaskLaunchMode;
}[] = [
  { label: labelTicketTaskLaunchMode('SYNC_WITH_JITTER'), value: 'SYNC_WITH_JITTER' },
  { label: labelTicketTaskLaunchMode('STAGGERED'), value: 'STAGGERED' },
];

const executionObjectiveOptions: {
  label: string;
  value: TicketTaskExecutionObjective;
}[] = [
  { label: labelTicketTaskExecutionObjective('QUEUE_ENTRY'), value: 'QUEUE_ENTRY' },
  { label: labelTicketTaskExecutionObjective('LOCK_ONLY'), value: 'LOCK_ONLY' },
  { label: labelTicketTaskExecutionObjective('FULL_SUBMIT'), value: 'FULL_SUBMIT' },
];

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString('zh-CN', {
    hour12: false,
  });
}

function createInitialRunId() {
  return `run-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}`;
}

function createEmptyFormState(): RunDraftFormState {
  return {
    city: '',
    eventName: '',
    platform: '',
    preferredRegions: '',
    priceLabel: '',
    quantity: 2,
    runId: createInitialRunId(),
    saleStartsAt: '',
    sessionLabel: '',
    targetBaseUrl: '',
    testRunId: '',
    tierLabel: '',
    venue: '',
    zoneLabel: '',
  };
}

function toFormState(
  template?: ScenarioTemplate,
  fallbackNodePoolId?: string,
): Partial<RunDraftFormState> {
  const ticketTask = template?.definition.ticketTask;

  return {
    city: ticketTask?.event.city ?? '',
    eventName: ticketTask?.event.eventName ?? '',
    expectedNodeCount: ticketTask?.nodeStrategy.expectedNodeCount,
    launchMode: ticketTask?.nodeStrategy.launchMode,
    lockRetryLimit: ticketTask?.executionStrategy.lockRetryLimit,
    maxGlobalQps: template?.definition.maxGlobalQps,
    maxNodeConcurrency: template?.definition.maxNodeConcurrency,
    nodePoolId: ticketTask?.nodeStrategy.poolId ?? fallbackNodePoolId,
    objective: ticketTask?.executionStrategy.objective,
    orderSubmitLimit: ticketTask?.executionStrategy.orderSubmitLimit,
    platform: ticketTask?.event.platform ?? '',
    preferredRegions: (ticketTask?.nodeStrategy.preferredRegions ?? []).join(', '),
    prewarmSeconds: ticketTask?.executionStrategy.prewarmSeconds,
    priceLabel: ticketTask?.ticket.priceLabel ?? '',
    quantity: ticketTask?.ticket.quantity ?? 2,
    saleStartsAt: ticketTask?.event.saleStartsAt ?? '',
    sessionLabel: ticketTask?.event.sessionLabel ?? '',
    targetBaseUrl: template?.definition.targetBaseUrl ?? '',
    templateId: template?.id,
    tierLabel: ticketTask?.ticket.tierLabel ?? '',
    venue: ticketTask?.event.venue ?? '',
    workerLaunchIntervalMs: ticketTask?.executionStrategy.workerLaunchIntervalMs,
    queuePollIntervalMs: ticketTask?.executionStrategy.queuePollIntervalMs,
    zoneLabel: ticketTask?.ticket.zoneLabel ?? '',
  };
}

function buildTicketTask(form: RunDraftFormState): TicketTask {
  const preferredRegions = form.preferredRegions
    .split(/[\s,，]+/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  return {
    event: {
      platform: form.platform.trim(),
      eventName: form.eventName.trim(),
      city: form.city.trim() || undefined,
      venue: form.venue.trim() || undefined,
      sessionLabel: form.sessionLabel.trim(),
      saleStartsAt: form.saleStartsAt.trim() || undefined,
    },
    ticket: {
      tierLabel: form.tierLabel.trim(),
      priceLabel: form.priceLabel.trim() || undefined,
      zoneLabel: form.zoneLabel.trim() || undefined,
      quantity: form.quantity ?? 2,
    },
    nodeStrategy: {
      poolId: form.nodePoolId ?? '',
      launchMode: form.launchMode ?? 'SYNC_WITH_JITTER',
      preferredRegions: preferredRegions.length > 0 ? preferredRegions : undefined,
      expectedNodeCount: form.expectedNodeCount,
    },
    executionStrategy: {
      objective: form.objective ?? 'FULL_SUBMIT',
      prewarmSeconds: form.prewarmSeconds ?? 30,
      workerLaunchIntervalMs: form.workerLaunchIntervalMs,
      queuePollIntervalMs: form.queuePollIntervalMs,
      lockRetryLimit: form.lockRetryLimit,
      orderSubmitLimit: form.orderSubmitLimit,
    },
  };
}

function buildDraft(
  form: RunDraftFormState,
  template: ScenarioTemplate,
): ControlRunDraft {
  const runId = form.runId.trim();
  const definitionTags = { ...template.definition.tags };

  if (template.definition.mode !== 'PREPROD') {
    definitionTags.test_run_id = form.testRunId.trim() || runId;
  } else if (form.testRunId.trim()) {
    definitionTags.test_run_id = form.testRunId.trim();
  }

  return {
    id: runId,
    templateId: form.templateId ?? template.id,
    nodePoolId: form.nodePoolId ?? '',
    definition: {
      ...template.definition,
      id: runId,
      maxGlobalQps: form.maxGlobalQps ?? template.definition.maxGlobalQps,
      maxNodeConcurrency:
        form.maxNodeConcurrency ?? template.definition.maxNodeConcurrency,
      tags: definitionTags,
      targetBaseUrl: form.targetBaseUrl.trim() || template.definition.targetBaseUrl,
      ticketTask: buildTicketTask(form),
    },
  };
}

export function RunsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [submittingAction, setSubmittingAction] = useState<SubmitAction>();
  const [pendingAction, setPendingAction] = useState<string>();
  const [runs, setRuns] = useState<ControlRunRecord[]>([]);
  const [templates, setTemplates] = useState<ScenarioTemplate[]>([]);
  const [nodePools, setNodePools] = useState<NodePool[]>([]);
  const [form, setForm] = useState<RunDraftFormState>(createEmptyFormState());

  async function loadRunsPage() {
    setLoading(true);
    setError(undefined);

    try {
      const [nextRuns, nextTemplates, nextNodePools] = await Promise.all([
        listRuns(),
        listTemplates(),
        listNodePools(),
      ]);

      setRuns(nextRuns);
      setTemplates(nextTemplates);
      setNodePools(nextNodePools);

      setForm((current) => {
        const defaultTemplate =
          nextTemplates.find((template) => template.id === current.templateId) ??
          nextTemplates[0];
        const defaultNodePoolId =
          current.nodePoolId ??
          nextNodePools[0]?.id ??
          defaultTemplate?.definition.ticketTask?.nodeStrategy.poolId;

        if (!defaultTemplate) {
          return current;
        }

        const defaults = toFormState(defaultTemplate, defaultNodePoolId);

        return {
          ...current,
          ...defaults,
          nodePoolId: current.nodePoolId ?? defaults.nodePoolId,
          runId: current.runId || createInitialRunId(),
          testRunId: current.testRunId,
        };
      });
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : '无法加载抢票任务页面。',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRunsPage();
  }, []);

  const selectedTemplate = templates.find((template) => template.id === form.templateId);
  const nodePoolNames = useMemo(
    () => new Map(nodePools.map((pool) => [pool.id, pool.name])),
    [nodePools],
  );

  const summaryText = formatTicketTaskConsoleSummary(buildTicketTask(form));

  function updateForm<K extends keyof RunDraftFormState>(
    key: K,
    value: RunDraftFormState[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function applyTemplate(templateId: string) {
    const template = templates.find((entry) => entry.id === templateId);

    if (!template) {
      return;
    }

    const defaults = toFormState(
      template,
      template.definition.ticketTask?.nodeStrategy.poolId ?? nodePools[0]?.id,
    );

    setForm((current) => ({
      ...current,
      ...defaults,
      runId: current.runId,
      testRunId: current.testRunId,
    }));
  }

  async function handleCreate(action: SubmitAction) {
    if (!selectedTemplate || !form.nodePoolId || !form.runId.trim()) {
      setError('任务编号、模板和节点池不能为空。');
      return;
    }

    if (!form.eventName.trim() || !form.sessionLabel.trim() || !form.tierLabel.trim()) {
      setError('请至少填写演出名称、场次和票档。');
      return;
    }

    setSubmittingAction(action);
    setError(undefined);

    try {
      const draft = buildDraft(form, selectedTemplate);

      await createRun(draft);

      if (action === 'plan' || action === 'start') {
        await planRun(draft.id);
      }

      if (action === 'start') {
        await startRun(draft.id);
      }

      await loadRunsPage();

      if (action === 'draft') {
        setForm((current) => ({
          ...current,
          runId: createInitialRunId(),
          testRunId: '',
        }));
        return;
      }

      await navigate(`/runs/${draft.id}`);
    } catch (createError) {
      setError(
        createError instanceof Error ? createError.message : '无法创建抢票任务。',
      );
    } finally {
      setSubmittingAction(undefined);
    }
  }

  async function handleRunAction(
    runId: string,
    action: 'plan' | 'start' | 'stop',
  ) {
    setPendingAction(`${runId}:${action}`);
    setError(undefined);

    try {
      if (action === 'plan') {
        await planRun(runId);
      }

      if (action === 'start') {
        await startRun(runId);
      }

      if (action === 'stop') {
        await stopRun(runId);
      }

      await loadRunsPage();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : `无法执行任务操作：${runId}。`,
      );
    } finally {
      setPendingAction(undefined);
    }
  }

  return (
    <Space direction='vertical' size={24} style={{ display: 'flex' }}>
      <div>
        <Typography.Title level={2} style={{ marginBottom: 8 }}>
          抢票任务
        </Typography.Title>
        <Typography.Paragraph style={{ marginBottom: 0 }}>
          按场次、票档、节点和执行策略创建一场真实可复盘的抢票演练任务。
        </Typography.Paragraph>
      </div>

      {error ? <Alert message={error} showIcon type='error' /> : null}

      <Card title='新建抢票任务'>
        <Space direction='vertical' size={16} style={{ display: 'flex' }}>
          <Alert description={summaryText} message='任务摘要' showIcon type='info' />

          <Form layout='vertical'>
            <Card size='small' title='基础参数'>
              <Row gutter={16}>
                <Col span={6}>
                  <Form.Item label='任务编号' required>
                    <Input
                      onChange={(event) => updateForm('runId', event.target.value)}
                      value={form.runId}
                    />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item label='任务模板' required>
                    <Select
                      onChange={(value) => applyTemplate(value)}
                      options={templates.map((template) => ({
                        label: template.name,
                        value: template.id,
                      }))}
                      value={form.templateId}
                    />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item label='目标地址'>
                    <Input
                      onChange={(event) =>
                        updateForm('targetBaseUrl', event.target.value)
                      }
                      value={form.targetBaseUrl}
                    />
                  </Form.Item>
                </Col>
                <Col span={3}>
                  <Form.Item label='全局 QPS 上限'>
                    <InputNumber
                      min={1}
                      onChange={(value) => updateForm('maxGlobalQps', value ?? undefined)}
                      style={{ width: '100%' }}
                      value={form.maxGlobalQps}
                    />
                  </Form.Item>
                </Col>
                <Col span={3}>
                  <Form.Item label='单节点并发'>
                    <InputNumber
                      min={1}
                      onChange={(value) =>
                        updateForm('maxNodeConcurrency', value ?? undefined)
                      }
                      style={{ width: '100%' }}
                      value={form.maxNodeConcurrency}
                    />
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            <Card size='small' title='场次信息' style={{ marginTop: 16 }}>
              <Row gutter={16}>
                <Col span={4}>
                  <Form.Item label='平台'>
                    <Input
                      onChange={(event) => updateForm('platform', event.target.value)}
                      value={form.platform}
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label='演出名称' required>
                    <Input
                      onChange={(event) => updateForm('eventName', event.target.value)}
                      value={form.eventName}
                    />
                  </Form.Item>
                </Col>
                <Col span={4}>
                  <Form.Item label='城市'>
                    <Input
                      onChange={(event) => updateForm('city', event.target.value)}
                      value={form.city}
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label='场馆'>
                    <Input
                      onChange={(event) => updateForm('venue', event.target.value)}
                      value={form.venue}
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label='场次' required>
                    <Input
                      onChange={(event) =>
                        updateForm('sessionLabel', event.target.value)
                      }
                      value={form.sessionLabel}
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label='开售时间'>
                    <Input
                      onChange={(event) =>
                        updateForm('saleStartsAt', event.target.value)
                      }
                      placeholder='2026-04-25T12:00:00.000Z'
                      value={form.saleStartsAt}
                    />
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            <Card size='small' title='票档目标' style={{ marginTop: 16 }}>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item label='票档名称' required>
                    <Input
                      onChange={(event) => updateForm('tierLabel', event.target.value)}
                      value={form.tierLabel}
                    />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item label='价位'>
                    <Input
                      onChange={(event) => updateForm('priceLabel', event.target.value)}
                      value={form.priceLabel}
                    />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item label='区域'>
                    <Input
                      onChange={(event) => updateForm('zoneLabel', event.target.value)}
                      value={form.zoneLabel}
                    />
                  </Form.Item>
                </Col>
                <Col span={4}>
                  <Form.Item label='张数'>
                    <InputNumber
                      min={1}
                      onChange={(value) => updateForm('quantity', value ?? 2)}
                      style={{ width: '100%' }}
                      value={form.quantity}
                    />
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            <Card size='small' title='节点策略' style={{ marginTop: 16 }}>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item label='节点池' required>
                    <Select
                      onChange={(value) => updateForm('nodePoolId', value)}
                      options={nodePools.map((pool) => ({
                        label: `${pool.name} (${pool.region})`,
                        value: pool.id,
                      }))}
                      value={form.nodePoolId}
                    />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item label='启动方式'>
                    <Select
                      onChange={(value: TicketTaskLaunchMode) =>
                        updateForm('launchMode', value)
                      }
                      options={launchModeOptions}
                      value={form.launchMode}
                    />
                  </Form.Item>
                </Col>
                <Col span={4}>
                  <Form.Item label='预期节点数'>
                    <InputNumber
                      min={1}
                      onChange={(value) =>
                        updateForm('expectedNodeCount', value ?? undefined)
                      }
                      style={{ width: '100%' }}
                      value={form.expectedNodeCount}
                    />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item label='优先区域'>
                    <Input
                      onChange={(event) =>
                        updateForm('preferredRegions', event.target.value)
                      }
                      placeholder='hk, sg'
                      value={form.preferredRegions}
                    />
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            <Card size='small' title='执行策略' style={{ marginTop: 16 }}>
              <Row gutter={16}>
                <Col span={6}>
                  <Form.Item label='执行目标'>
                    <Select
                      onChange={(value: TicketTaskExecutionObjective) =>
                        updateForm('objective', value)
                      }
                      options={executionObjectiveOptions}
                      value={form.objective}
                    />
                  </Form.Item>
                </Col>
                <Col span={4}>
                  <Form.Item label='预热秒数'>
                    <InputNumber
                      min={0}
                      onChange={(value) =>
                        updateForm('prewarmSeconds', value ?? undefined)
                      }
                      style={{ width: '100%' }}
                      value={form.prewarmSeconds}
                    />
                  </Form.Item>
                </Col>
                <Col span={4}>
                  <Form.Item label='Worker 启动间隔(ms)'>
                    <InputNumber
                      min={1}
                      onChange={(value) =>
                        updateForm('workerLaunchIntervalMs', value ?? undefined)
                      }
                      style={{ width: '100%' }}
                      value={form.workerLaunchIntervalMs}
                    />
                  </Form.Item>
                </Col>
                <Col span={4}>
                  <Form.Item label='排队轮询间隔(ms)'>
                    <InputNumber
                      min={1}
                      onChange={(value) =>
                        updateForm('queuePollIntervalMs', value ?? undefined)
                      }
                      style={{ width: '100%' }}
                      value={form.queuePollIntervalMs}
                    />
                  </Form.Item>
                </Col>
                <Col span={3}>
                  <Form.Item label='锁票重试'>
                    <InputNumber
                      min={0}
                      onChange={(value) =>
                        updateForm('lockRetryLimit', value ?? undefined)
                      }
                      style={{ width: '100%' }}
                      value={form.lockRetryLimit}
                    />
                  </Form.Item>
                </Col>
                <Col span={3}>
                  <Form.Item label='提交上限'>
                    <InputNumber
                      min={0}
                      onChange={(value) =>
                        updateForm('orderSubmitLimit', value ?? undefined)
                      }
                      style={{ width: '100%' }}
                      value={form.orderSubmitLimit}
                    />
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            <Form.Item
              label='测试批次标识'
              style={{ marginTop: 16, marginBottom: 0 }}
              tooltip='在非 PREPROD 模式下会自动写入 test_run_id。'
            >
              <Input
                onChange={(event) => updateForm('testRunId', event.target.value)}
                placeholder='PREPROD 模式可留空'
                value={form.testRunId}
              />
            </Form.Item>
          </Form>

          <Space wrap>
            <Button
              loading={submittingAction === 'draft'}
              onClick={() => void handleCreate('draft')}
            >
              保存任务草稿
            </Button>
            <Button
              loading={submittingAction === 'plan'}
              onClick={() => void handleCreate('plan')}
            >
              创建并规划
            </Button>
            <Button
              loading={submittingAction === 'start'}
              onClick={() => void handleCreate('start')}
              type='primary'
            >
              创建、规划并启动
            </Button>
            <Button loading={loading} onClick={() => void loadRunsPage()}>
              刷新任务列表
            </Button>
          </Space>
        </Space>
      </Card>

      <Card title='任务中心'>
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
                    {record.ticketTask?.ticket.zoneLabel ?? record.targetBaseUrl}
                  </Typography.Text>
                </Space>
              ),
            },
            {
              key: 'nodePool',
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
            {
              key: 'actions',
              title: '操作',
              render: (_value: unknown, record) => (
                <Space wrap>
                  <Button size='small'>
                    <Link to={`/runs/${record.id}`}>作战台</Link>
                  </Button>
                  <Button
                    loading={pendingAction === `${record.id}:plan`}
                    onClick={() => void handleRunAction(record.id, 'plan')}
                    size='small'
                  >
                    规划
                  </Button>
                  <Button
                    disabled={
                      record.status !== 'PLANNED' && record.status !== 'STOPPED'
                    }
                    loading={pendingAction === `${record.id}:start`}
                    onClick={() => void handleRunAction(record.id, 'start')}
                    size='small'
                    type='primary'
                  >
                    启动
                  </Button>
                  <Button
                    danger
                    disabled={record.status !== 'RUNNING'}
                    loading={pendingAction === `${record.id}:stop`}
                    onClick={() => void handleRunAction(record.id, 'stop')}
                    size='small'
                  >
                    停止
                  </Button>
                </Space>
              ),
            },
          ]}
          dataSource={runs}
          loading={loading}
          rowKey='id'
        />
      </Card>
    </Space>
  );
}
