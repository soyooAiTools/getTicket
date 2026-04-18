import { Layout, Menu, Space, Typography } from 'antd';
import { Link, Outlet, useLocation } from 'react-router-dom';

const { Content, Header, Sider } = Layout;

const navigationItems = [
  {
    key: '/overview',
    label: <Link to='/overview'>Overview</Link>,
  },
  {
    key: '/runs',
    label: <Link to='/runs'>Runs</Link>,
  },
  {
    key: '/nodes',
    label: <Link to='/nodes'>Nodes</Link>,
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
            Load-testing operator console
          </Typography.Title>
          <Typography.Text type='secondary'>
            Manage seeded templates, live runs, node pools, and calibration
            reports.
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
              SaaS control surface
            </Typography.Title>
            <Typography.Text type='secondary'>
              Drive load-test planning, monitor live telemetry, and compare
              rehearsal outcomes without leaving the operator console.
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
