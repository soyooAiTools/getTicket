import type {
  ControlRunDraft,
  ControlRunRecord,
  NodePool,
  ScenarioTemplate,
} from '../../../../../packages/contracts/src';

import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import { useEffect, useState } from 'react';
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

type RunDraftFormState = {
  maxGlobalQps?: number;
  maxNodeConcurrency?: number;
  nodePoolId?: string;
  runId: string;
  targetBaseUrl: string;
  templateId?: string;
  testRunId: string;
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

function createInitialRunId() {
  return `run-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}`;
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
    },
  };
}

export function RunsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const [pendingAction, setPendingAction] = useState<string>();
  const [runs, setRuns] = useState<ControlRunRecord[]>([]);
  const [templates, setTemplates] = useState<ScenarioTemplate[]>([]);
  const [nodePools, setNodePools] = useState<NodePool[]>([]);
  const [form, setForm] = useState<RunDraftFormState>({
    runId: createInitialRunId(),
    targetBaseUrl: '',
    testRunId: '',
  });

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

      const defaultTemplate = nextTemplates[0];
      const defaultNodePool = nextNodePools[0];

      setForm((current) => ({
        ...current,
        maxGlobalQps:
          current.maxGlobalQps ?? defaultTemplate?.definition.maxGlobalQps,
        maxNodeConcurrency:
          current.maxNodeConcurrency ??
          defaultTemplate?.definition.maxNodeConcurrency,
        nodePoolId: current.nodePoolId ?? defaultNodePool?.id,
        targetBaseUrl:
          current.targetBaseUrl || defaultTemplate?.definition.targetBaseUrl || '',
        templateId: current.templateId ?? defaultTemplate?.id,
      }));
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load runs.',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRunsPage();
  }, []);

  const selectedTemplate = templates.find((template) => template.id === form.templateId);

  async function handleCreateRun() {
    if (!selectedTemplate || !form.nodePoolId || !form.runId.trim()) {
      setError('Run id, template, and node pool are required.');
      return;
    }

    setSubmitting(true);
    setError(undefined);

    try {
      await createRun(buildDraft(form, selectedTemplate));
      await loadRunsPage();
      await navigate(`/runs/${form.runId.trim()}`);
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : 'Unable to create the run.',
      );
    } finally {
      setSubmitting(false);
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
          : `Unable to ${action} run ${runId}.`,
      );
    } finally {
      setPendingAction(undefined);
    }
  }

  return (
    <Space direction='vertical' size={24} style={{ display: 'flex' }}>
      <div>
        <Typography.Title level={2} style={{ marginBottom: 8 }}>
          Runs
        </Typography.Title>
        <Typography.Paragraph style={{ marginBottom: 0 }}>
          Create draft rehearsals from the seeded catalog, then plan, start,
          stop, and inspect them from one place.
        </Typography.Paragraph>
      </div>

      {error ? <Alert message={error} showIcon type='error' /> : null}

      <Card title='Create run draft'>
        <Form layout='vertical'>
          <Space align='start' size={16} wrap>
            <Form.Item label='Run id' required style={{ minWidth: 240 }}>
              <Input
                onChange={(event) =>
                  setForm((current) => ({ ...current, runId: event.target.value }))
                }
                value={form.runId}
              />
            </Form.Item>
            <Form.Item label='Template' required style={{ minWidth: 220 }}>
              <Select
                onChange={(value) => {
                  const template = templates.find((entry) => entry.id === value);
                  setForm((current) => ({
                    ...current,
                    maxGlobalQps: template?.definition.maxGlobalQps,
                    maxNodeConcurrency: template?.definition.maxNodeConcurrency,
                    targetBaseUrl: template?.definition.targetBaseUrl ?? '',
                    templateId: value,
                  }));
                }}
                options={templates.map((template) => ({
                  label: template.name,
                  value: template.id,
                }))}
                style={{ width: 220 }}
                value={form.templateId}
              />
            </Form.Item>
            <Form.Item label='Node pool' required style={{ minWidth: 220 }}>
              <Select
                onChange={(value) =>
                  setForm((current) => ({ ...current, nodePoolId: value }))
                }
                options={nodePools.map((pool) => ({
                  label: `${pool.name} (${pool.region})`,
                  value: pool.id,
                }))}
                style={{ width: 220 }}
                value={form.nodePoolId}
              />
            </Form.Item>
            <Form.Item label='Target base URL' style={{ minWidth: 320 }}>
              <Input
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    targetBaseUrl: event.target.value,
                  }))
                }
                value={form.targetBaseUrl}
              />
            </Form.Item>
            <Form.Item label='Global QPS ceiling' style={{ minWidth: 180 }}>
              <InputNumber
                min={1}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    maxGlobalQps: value ?? undefined,
                  }))
                }
                value={form.maxGlobalQps}
              />
            </Form.Item>
            <Form.Item label='Per-node concurrency' style={{ minWidth: 180 }}>
              <InputNumber
                min={1}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    maxNodeConcurrency: value ?? undefined,
                  }))
                }
                value={form.maxNodeConcurrency}
              />
            </Form.Item>
            <Form.Item
              label='test_run_id tag'
              style={{ minWidth: 220 }}
              tooltip='Needed automatically for non-PREPROD modes.'
            >
              <Input
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    testRunId: event.target.value,
                  }))
                }
                placeholder='Optional for PREPROD'
                value={form.testRunId}
              />
            </Form.Item>
          </Space>
        </Form>

        <Space>
          <Button
            loading={submitting}
            onClick={() => void handleCreateRun()}
            type='primary'
          >
            Create draft
          </Button>
          <Button loading={loading} onClick={() => void loadRunsPage()}>
            Refresh runs
          </Button>
        </Space>
      </Card>

      <Card title='Run queue'>
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
            },
            {
              dataIndex: 'nodePoolId',
              key: 'nodePoolId',
              title: 'Node pool',
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
            {
              key: 'actions',
              title: 'Actions',
              render: (_value: unknown, record) => (
                <Space wrap>
                  <Button size='small'>
                    <Link to={`/runs/${record.id}`}>View</Link>
                  </Button>
                  <Button
                    loading={pendingAction === `${record.id}:plan`}
                    onClick={() => void handleRunAction(record.id, 'plan')}
                    size='small'
                  >
                    Plan
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
                    Start
                  </Button>
                  <Button
                    danger
                    disabled={record.status !== 'RUNNING'}
                    loading={pendingAction === `${record.id}:stop`}
                    onClick={() => void handleRunAction(record.id, 'stop')}
                    size='small'
                  >
                    Stop
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
