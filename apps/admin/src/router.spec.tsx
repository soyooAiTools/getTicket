import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { AppRoutes } from './router';

function renderRoute(path: string) {
  return renderToStaticMarkup(
    <ConfigProvider locale={zhCN}>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </ConfigProvider>,
  );
}

describe('AppRoutes', () => {
  it('renders the operator overview route inside the control shell', () => {
    const html = renderRoute('/overview');

    expect(html).toContain('抢票测试操作台');
    expect(html).toContain('作战总览');
  });

  it('renders the run detail route for a specific run id', () => {
    const html = renderRoute('/runs/run-2026-04-18');

    expect(html).toContain('任务作战台');
    expect(html).toContain('run-2026-04-18');
  });
});
