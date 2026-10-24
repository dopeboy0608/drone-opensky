import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { App as AntdApp } from 'antd';
import './App.css';
import { queryClient } from './api/queryClient';
import { router } from './routes/router';

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AntdApp>
      <RouterProvider router={router} />
    </AntdApp>
  </QueryClientProvider>
);

export default App;
