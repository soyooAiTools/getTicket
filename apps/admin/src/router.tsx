import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { EventsPage } from './pages/events';
import { FulfillmentPage } from './pages/fulfillment';
import { OrdersPage } from './pages/orders';
import { RefundsPage } from './pages/refunds';

export function AppRouter() {
  return (
    <ConfigProvider locale={zhCN}>
      <BrowserRouter>
        <Routes>
          <Route path='/' element={<Navigate replace to='/events' />} />
          <Route path='/events' element={<EventsPage />} />
          <Route path='/orders' element={<OrdersPage />} />
          <Route path='/fulfillment' element={<FulfillmentPage />} />
          <Route path='/refunds' element={<RefundsPage />} />
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
}
