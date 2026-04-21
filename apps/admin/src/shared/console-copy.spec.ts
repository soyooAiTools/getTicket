import type { TicketTask } from '../../../../packages/contracts/src';

import { describe, expect, it } from 'vitest';

import {
  formatTicketTaskConsoleSummary,
  formatTicketTaskEventSummary,
  formatTicketTaskTicketSummary,
  labelNodeRole,
  labelRunStatus,
  labelTicketTaskExecutionObjective,
  labelTicketTaskLaunchMode,
} from './console-copy';

const sampleTicketTask: TicketTask = {
  event: {
    platform: '大麦',
    eventName: '周杰伦上海站',
    city: '上海',
    venue: '上海体育场',
    sessionLabel: '2026-05-01 19:30',
    saleStartsAt: '2026-04-25T12:00:00.000Z',
  },
  ticket: {
    tierLabel: '内场票',
    priceLabel: '980元',
    zoneLabel: 'A区',
    quantity: 2,
  },
  nodeStrategy: {
    poolId: 'pool-control-01',
    launchMode: 'SYNC_WITH_JITTER',
    preferredRegions: ['hk'],
    expectedNodeCount: 6,
  },
  executionStrategy: {
    objective: 'FULL_SUBMIT',
    prewarmSeconds: 30,
    workerLaunchIntervalMs: 1000,
    queuePollIntervalMs: 1500,
    lockRetryLimit: 3,
    orderSubmitLimit: 2,
  },
};

describe('console copy', () => {
  it('returns clean Chinese labels for core statuses and strategies', () => {
    expect(labelRunStatus('RUNNING')).toBe('运行中');
    expect(labelNodeRole('CONTROL')).toBe('控制节点');
    expect(labelTicketTaskLaunchMode('SYNC_WITH_JITTER')).toBe('同步起跑（微抖动）');
    expect(labelTicketTaskExecutionObjective('FULL_SUBMIT')).toBe('全链路提交');
  });

  it('formats ticket-task summaries without mojibake', () => {
    expect(formatTicketTaskEventSummary(sampleTicketTask)).toBe(
      '周杰伦上海站 / 2026-05-01 19:30',
    );
    expect(formatTicketTaskTicketSummary(sampleTicketTask)).toBe(
      '内场票 / 980元 / 2张',
    );
    expect(formatTicketTaskConsoleSummary(sampleTicketTask)).toBe(
      '大麦 / 周杰伦上海站 / 2026-05-01 19:30 / 内场票 / 980元 / 2张 / 全链路提交',
    );
  });

  it('returns fallback copy when no ticket-task metadata is present', () => {
    expect(formatTicketTaskEventSummary()).toBe('未配置场次信息');
    expect(formatTicketTaskTicketSummary()).toBe('未配置票档');
    expect(formatTicketTaskConsoleSummary()).toBe('尚未填写抢票任务元数据');
  });
});
