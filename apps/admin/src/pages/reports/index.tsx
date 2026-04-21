import type { CalibrationReport } from '../../../../../packages/contracts/src';

import {
  Alert,
  Button,
  Card,
  Space,
  Statistic,
  Table,
  Typography,
} from 'antd';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { getCalibrationReport } from '../../services/load-control';

export function ReportsPage() {
  const { baselineRunId, productionRunId } = useParams<{
    baselineRunId: string;
    productionRunId: string;
  }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [report, setReport] = useState<CalibrationReport>();

  async function loadReport() {
    if (!baselineRunId || !productionRunId) {
      setError('基线任务和生产校准任务编号不能为空。');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(undefined);

    try {
      setReport(await getCalibrationReport(baselineRunId, productionRunId));
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : '无法加载校准复盘。',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadReport();
  }, [baselineRunId, productionRunId]);

  return (
    <Space direction='vertical' size={24} style={{ display: 'flex' }}>
      <div>
        <Typography.Title level={2} style={{ marginBottom: 8 }}>
          校准复盘
        </Typography.Title>
        <Typography.Paragraph style={{ marginBottom: 0 }}>
          对比基线任务 <Typography.Text code>{baselineRunId ?? '-'}</Typography.Text>{' '}
          与生产校准任务{' '}
          <Typography.Text code>{productionRunId ?? '-'}</Typography.Text>
          的结果。
        </Typography.Paragraph>
      </div>

      <Space wrap>
        <Button>
          <Link to='/runs'>返回任务列表</Link>
        </Button>
        <Button loading={loading} onClick={() => void loadReport()}>
          刷新复盘
        </Button>
      </Space>

      {error ? <Alert message={error} showIcon type='error' /> : null}

      <Space size={16} style={{ display: 'flex' }} wrap>
        <Card loading={loading}>
          <Statistic title='真实性分' value={report?.realismScore ?? 0} />
        </Card>
        <Card loading={loading}>
          <Statistic title='容量分' value={report?.capacityScore ?? 0} />
        </Card>
        <Card loading={loading}>
          <Statistic title='公平性分' value={report?.fairnessScore ?? 0} />
        </Card>
        <Card loading={loading}>
          <Statistic title='可控性分' value={report?.controlScore ?? 0} />
        </Card>
      </Space>

      <Card loading={loading} title='建议调整项'>
        <Table
          columns={[
            { dataIndex: 'field', key: 'field', title: '字段' },
            {
              dataIndex: 'previousValue',
              key: 'previousValue',
              title: '基线值',
            },
            {
              dataIndex: 'recommendedValue',
              key: 'recommendedValue',
              title: '建议值',
            },
          ]}
          dataSource={report?.recommendedUpdates ?? []}
          pagination={false}
          rowKey='field'
        />
      </Card>
    </Space>
  );
}
