import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Cpu, 
  HardDrive, 
  MemoryStick, 
  RefreshCcw,
  Server
} from 'lucide-react';
import apiClient from '../api/client';

const cn = (...classes) => classes.filter(Boolean).join(' ');

const StatCard = ({ title, value, sub, icon: Icon, color }) => (
  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
    <div className={cn("p-3 rounded-lg", color)}>
      <Icon className="text-white" size={24} />
    </div>
    <div>
      <p className="text-sm text-gray-500 font-medium">{title}</p>
      <p className="text-2xl font-bold text-gray-800">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  </div>
);

function formatUptime(totalSeconds) {
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);

  return parts.join(' ');
}

const Dashboard = () => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/system/status');
      setStatus(response.data);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch status:', err);
      setError('Failed to load system status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative">
        <strong className="font-bold">Error! </strong>
        <span className="block sm:inline">{error}</span>
        <button onClick={fetchStatus} className="mt-2 sm:mt-0 sm:ml-4 underline font-medium">
          Retry
        </button>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  const cpuPercent = Number(status.cpu).toFixed(1) + '%';
  const memPercent = Number(status.memory).toFixed(1) + '%';
  const diskPercent = Number(status.disk).toFixed(1) + '%';
  const uptimeStr = formatUptime(status.uptime || 0);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">System Overview</h1>
          <p className="text-gray-500">Real-time monitoring of your server</p>
        </div>
        <button
          onClick={fetchStatus}
          className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
          disabled={loading}
        >
          <RefreshCcw className={cn("h-5 w-5", loading && "animate-spin")} />
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="CPU Usage"
          value={cpuPercent}
          sub={`${status.cpu_cores}C/${status.cpu_threads}T · ${status.cpu_model || 'Unknown'}`}
          icon={Cpu}
          color="bg-blue-500"
        />
        <StatCard
          title="Memory"
          value={memPercent}
          icon={MemoryStick}
          color="bg-purple-500"
        />
        <StatCard
          title="Disk"
          value={diskPercent}
          icon={HardDrive}
          color="bg-orange-500"
        />
        <StatCard
          title="Uptime"
          value={uptimeStr}
          sub={`${status.os || ''} ${status.kernel || ''}`}
          icon={Activity}
          color="bg-green-500"
        />
      </div>

      {/* Load & Info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Server size={18} className="text-gray-400" />
            System Load
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-gray-800">{Number(status.load1 || 0).toFixed(2)}</p>
              <p className="text-xs text-gray-500 mt-1">1 min</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-gray-800">{Number(status.load5 || 0).toFixed(2)}</p>
              <p className="text-xs text-gray-500 mt-1">5 min</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-gray-800">{Number(status.load15 || 0).toFixed(2)}</p>
              <p className="text-xs text-gray-500 mt-1">15 min</p>
            </div>
          </div>
          {status.network && (
            <div className="mt-4 flex gap-6 text-sm text-gray-500">
              <span>↓ {(status.network.rx / 1024).toFixed(1)} KB/s</span>
              <span>↑ {(status.network.tx / 1024).toFixed(1)} KB/s</span>
            </div>
          )}
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">System Info</h3>
          <div className="space-y-3 text-sm">
            {[
              ['Hostname', status.hostname],
              ['OS', status.os],
              ['Kernel', status.kernel],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between py-2 border-b border-gray-50">
                <span className="text-gray-500">{label}</span>
                <span className="font-medium text-gray-800">{value || '--'}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
