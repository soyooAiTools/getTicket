import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { ControlShell } from './layouts/control-shell';
import { NodesPage } from './pages/nodes';
import { OverviewPage } from './pages/overview';
import { ReportsPage } from './pages/reports';
import { RunDetailPage } from './pages/run-detail';
import { RunsPage } from './pages/runs';

export function AppRoutes() {
  return (
    <Routes>
      <Route path='/' element={<ControlShell />}>
        <Route index element={<Navigate replace to='/overview' />} />
        <Route path='overview' element={<OverviewPage />} />
        <Route path='runs' element={<RunsPage />} />
        <Route path='runs/:runId' element={<RunDetailPage />} />
        <Route
          path='reports/:baselineRunId/:productionRunId'
          element={<ReportsPage />}
        />
        <Route path='nodes' element={<NodesPage />} />
      </Route>
      <Route path='*' element={<Navigate replace to='/overview' />} />
    </Routes>
  );
}

export function AppRouter() {
  return (
    <ConfigProvider locale={zhCN}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </ConfigProvider>
  );
}
