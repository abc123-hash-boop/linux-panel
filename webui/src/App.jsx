import React, { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';

// 懒加载各页面
const Dashboard = lazy(() => import('./views/Dashboard'));
const Docker = lazy(() => import('./views/Docker'));
const Files = lazy(() => import('./views/Files'));
const Terminal = lazy(() => import('./views/Terminal'));
const Copilot = lazy(() => import('./views/Copilot'));
const Browser = lazy(() => import('./views/Browser'));
const Settings = lazy(() => import('./views/Settings'));
const ProcessManager = lazy(() => import('./views/ProcessManager'));
const Services = lazy(() => import('./views/Services'));
const Login = lazy(() => import('./views/Login'));

// Loading 占位
const PageLoader = () => (
  <div className="flex items-center justify-center h-64">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
  </div>
);

// 404 页面
function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-gray-500">
      <h1 className="text-6xl font-bold text-gray-300 mb-4">404</h1>
      <p className="text-xl mb-8">页面未找到</p>
      <a href="/" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
        返回首页
      </a>
    </div>
  );
}

function App() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    }>
      <Routes>
        {/* 公开路由：登录页 */}
        <Route path="/login" element={<Login />} />

        {/* 受保护路由：主应用 */}
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="docker" element={<Docker />} />
          <Route path="files" element={<Files />} />
          <Route path="terminal" element={<Terminal />} />
          <Route path="copilot" element={<Copilot />} />
          <Route path="browser" element={<Browser />} />
          <Route path="settings" element={<Settings />} />
          <Route path="tasks" element={<ProcessManager />} />
          <Route path="services" element={<Services />} />
          <Route path="*" element={<NotFound />} />
        </Route>

        {/* 顶层 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

export default App;
