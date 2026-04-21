import type {
  NodeHealthStatus,
  NodeRole,
  RunStatus,
  TicketTask,
  TicketTaskExecutionObjective,
  TicketTaskLaunchMode,
  ValidationMode,
} from '../../../../packages/contracts/src';

import type { RunStreamState } from '../hooks/use-run-stream';

export const runStatusColors: Record<RunStatus, string> = {
  COMPLETED: 'green',
  DRAFT: 'default',
  FAILED: 'red',
  PLANNED: 'gold',
  RUNNING: 'blue',
  STOPPED: 'default',
  STOPPING: 'orange',
};

export const consoleCopy = {
  nav: {
    nodes: '节点池',
    overview: '作战总览',
    runs: '抢票任务',
  },
  shell: {
    sidebarDescription: '集中管理任务模板、节点池、实时作战台和校准复盘。',
    sidebarTitle: '抢票测试操作台',
    topDescription: '在一个控制台里完成任务创建、启动、实时观测和结果复盘。',
    topTitle: '抢票测试作战面板',
  },
} as const;

const runStatusLabels: Record<RunStatus, string> = {
  COMPLETED: '已完成',
  DRAFT: '草稿',
  FAILED: '失败',
  PLANNED: '已规划',
  RUNNING: '运行中',
  STOPPED: '已停止',
  STOPPING: '停止中',
};

const validationModeLabels: Record<ValidationMode, string> = {
  GRAY_VALIDATION: '灰度校准',
  OBSERVE_ONLY: '仅观测',
  PREPROD: '预发演练',
  WHITELIST_FULL_PATH: '白名单全链路',
};

const nodeRoleLabels: Record<NodeRole, string> = {
  ANCHOR: '锚点节点',
  CONTROL: '控制节点',
  EDGE: '边缘节点',
};

const nodeHealthStatusLabels: Record<NodeHealthStatus, string> = {
  BUSY: '繁忙',
  DEGRADED: '退化',
  OFFLINE: '离线',
  ONLINE: '在线',
};

const runStreamStateLabels: Record<RunStreamState, string> = {
  connecting: '连接中',
  error: '连接异常',
  idle: '空闲',
  open: '已连接',
};

const ticketTaskLaunchModeLabels: Record<TicketTaskLaunchMode, string> = {
  STAGGERED: '错峰启动',
  SYNC_WITH_JITTER: '同步起跑（微抖动）',
};

const ticketTaskExecutionObjectiveLabels: Record<
  TicketTaskExecutionObjective,
  string
> = {
  FULL_SUBMIT: '全链路提交',
  LOCK_ONLY: '锁票优先',
  QUEUE_ENTRY: '排队入场',
};

export function labelRunStatus(status: RunStatus) {
  return runStatusLabels[status];
}

export function labelValidationMode(mode: ValidationMode) {
  return validationModeLabels[mode];
}

export function labelNodeRole(role: NodeRole) {
  return nodeRoleLabels[role];
}

export function labelNodeHealthStatus(status: NodeHealthStatus) {
  return nodeHealthStatusLabels[status];
}

export function labelRunStreamState(state: RunStreamState) {
  return runStreamStateLabels[state];
}

export function labelTicketTaskLaunchMode(mode: TicketTaskLaunchMode) {
  return ticketTaskLaunchModeLabels[mode];
}

export function labelTicketTaskExecutionObjective(
  objective: TicketTaskExecutionObjective,
) {
  return ticketTaskExecutionObjectiveLabels[objective];
}

export function formatTicketTaskEventSummary(ticketTask?: TicketTask) {
  if (!ticketTask) {
    return '未配置场次信息';
  }

  return `${ticketTask.event.eventName} / ${ticketTask.event.sessionLabel}`;
}

export function formatTicketTaskTicketSummary(ticketTask?: TicketTask) {
  if (!ticketTask) {
    return '未配置票档';
  }

  const segments = [ticketTask.ticket.tierLabel];

  if (ticketTask.ticket.priceLabel) {
    segments.push(ticketTask.ticket.priceLabel);
  }

  segments.push(`${ticketTask.ticket.quantity}张`);

  return segments.join(' / ');
}

export function formatTicketTaskConsoleSummary(ticketTask?: TicketTask) {
  if (!ticketTask) {
    return '尚未填写抢票任务元数据';
  }

  const parts = [
    ticketTask.event.platform,
    ticketTask.event.eventName,
    ticketTask.event.sessionLabel,
    ticketTask.ticket.tierLabel,
    ticketTask.ticket.priceLabel,
    `${ticketTask.ticket.quantity}张`,
    labelTicketTaskExecutionObjective(ticketTask.executionStrategy.objective),
  ].filter((value): value is string => Boolean(value));

  return parts.join(' / ');
}
