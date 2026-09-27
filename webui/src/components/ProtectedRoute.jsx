import React, { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import apiClient from '../api/client';

const ProtectedRoute = ({ children }) => {
  const [authenticated, setAuthenticated] = useState(null);
  const location = useLocation();

  useEffect(() => {
    // 检查登录状态（不依赖 token，依赖后端验证 Cookie）
    const checkAuth = async () => {
      try {
        const response = await apiClient.get('/hello');
        // 如果能访问 /hello，说明已登录
        setAuthenticated(response.data.logged_in);
      } catch (error) {
        // 401 或其他错误，说明未登录
        setAuthenticated(false);
      }
    };

    checkAuth();
  }, []);

  // 加载中显示转圈
  if (authenticated === null) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Verifying session...</p>
        </div>
      </div>
    );
  }

  // 未登录，重定向到登录页
  if (!authenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 已登录，渲染子组件
  return children;
};

export default ProtectedRoute;
