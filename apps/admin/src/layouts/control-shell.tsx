import { Layout, Menu, Space, Typography } from 'antd';
import { Link, Outlet, useLocation } from 'react-router-dom';

import { consoleCopy } from '../shared/console-copy';

const { Content, Header, Sider } = Layout;

const navigationItems = [
  {
    key: '/overview',
    label: <Link to='/overview'>{consoleCopy.nav.overview}</Link>,
  },
  {
    key: '/runs',
    label: <Link to='/runs'>{consoleCopy.nav.runs}</Link>,
  },
  {
    key: '/nodes',
    label: <Link to='/nodes'>{consoleCopy.nav.nodes}</Link>,
  },
];

function selectedNavigationKey(pathname: string) {
  if (pathname.startsWith('/runs') || pathname.startsWith('/reports')) {
    return '/runs';
  }

  if (pathname.startsWith('/nodes')) {
    return '/nodes';
  }

  return '/overview';
}

export function ControlShell() {
  const location = useLocation();

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider breakpoint='lg' theme='light' width={232}>
        <div style={{ padding: '24px 20px 16px' }}>
          <Typography.Title level={4} style={{ marginBottom: 8 }}>
            {consoleCopy.shell.sidebarTitle}
          </Typography.Title>
          <Typography.Text type='secondary'>
            {consoleCopy.shell.sidebarDescription}
          </Typography.Text>
        </div>
        <Menu
          items={navigationItems}
          mode='inline'
          selectedKeys={[selectedNavigationKey(location.pathname)]}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            alignItems: 'center',
            background: '#fff',
            borderBottom: '1px solid #f0f0f0',
            display: 'flex',
            height: 'auto',
            padding: '16px 24px',
          }}
        >
          <Space direction='vertical' size={2}>
            <Typography.Title level={3} style={{ margin: 0 }}>
              {consoleCopy.shell.topTitle}
            </Typography.Title>
            <Typography.Text type='secondary'>
              {consoleCopy.shell.topDescription}
            </Typography.Text>
          </Space>
        </Header>
        <Content style={{ padding: 24 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
