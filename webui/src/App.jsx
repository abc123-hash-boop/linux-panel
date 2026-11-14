import React, { Suspense, lazy, useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import apiClient from './api/client';

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
const News = lazy(() => import('./views/News'));
const Sites = lazy(() => import('./views/Sites'));
const Login = lazy(() => import('./views/Login'));
const Onboarding = lazy(() => import('./views/Onboarding'));

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

function SetupGate({ children }) {
  const location = useLocation();
  const [initialized, setInitialized] = useState(null);
  const [failed, setFailed] = useState(false);

  const checkSetup = () => {
    setFailed(false);
    apiClient.get('/setup/status')
      .then((response) => setInitialized(Boolean(response.data?.initialized)))
      .catch(() => setFailed(true));
  };

  useEffect(() => {
    checkSetup();
  }, []);

  if (initialized === null) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-indigo-500/25 border-t-indigo-400 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-white/50">正在检查初始化状态…</p>
          {failed && <button onClick={checkSetup} className="mt-4 text-sm text-indigo-300 hover:text-indigo-200">连接失败，点击重试</button>}
        </div>
      </div>
    );
  }

  if (!initialized && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }
  if (initialized && location.pathname === '/onboarding') {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function App() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    }>
      <SetupGate>
        <Routes>
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/login" element={<Login />} />

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
            <Route path="news" element={<News />} />
            <Route path="sites" element={<Sites />} />
            <Route path="*" element={<NotFound />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </SetupGate>
    </Suspense>
  );
}

export default App;
