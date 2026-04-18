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
      setError('Both baseline and production run ids are required.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(undefined);

    try {
      setReport(await getCalibrationReport(baselineRunId, productionRunId));
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load the calibration report.',
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
          Calibration report
        </Typography.Title>
        <Typography.Paragraph style={{ marginBottom: 0 }}>
          Compare baseline run{' '}
          <Typography.Text code>{baselineRunId ?? '-'}</Typography.Text> against
          production run{' '}
          <Typography.Text code>{productionRunId ?? '-'}</Typography.Text>.
        </Typography.Paragraph>
      </div>

      <Space wrap>
        <Button>
          <Link to='/runs'>Back to runs</Link>
        </Button>
        <Button loading={loading} onClick={() => void loadReport()}>
          Refresh report
        </Button>
      </Space>

      {error ? <Alert message={error} showIcon type='error' /> : null}

      <Space size={16} style={{ display: 'flex' }} wrap>
        <Card loading={loading}>
          <Statistic title='Realism score' value={report?.realismScore ?? 0} />
        </Card>
        <Card loading={loading}>
          <Statistic title='Capacity score' value={report?.capacityScore ?? 0} />
        </Card>
        <Card loading={loading}>
          <Statistic title='Fairness score' value={report?.fairnessScore ?? 0} />
        </Card>
        <Card loading={loading}>
          <Statistic title='Control score' value={report?.controlScore ?? 0} />
        </Card>
      </Space>

      <Card loading={loading} title='Recommended updates'>
        <Table
          columns={[
            { dataIndex: 'field', key: 'field', title: 'Field' },
            {
              dataIndex: 'previousValue',
              key: 'previousValue',
              title: 'Baseline',
            },
            {
              dataIndex: 'recommendedValue',
              key: 'recommendedValue',
              title: 'Recommended',
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
