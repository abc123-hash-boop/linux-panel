import React, { useState, useEffect } from 'react';
import {
  Activity,
  Cpu,
  HardDrive,
  MemoryStick,
  RefreshCcw,
  Server,
  AlertCircle,
  Globe,
} from 'lucide-react';
import apiClient from '../api/client';
import { useI18n } from '../i18n';

const cn = (...classes) => classes.filter(Boolean).join(' ');

const StatCard = ({ title, value, sub, icon: Icon, gradient }) => (
  <div className="glass-strong p-5 rounded-2xl flex items-center gap-4 relative overflow-hidden group hover:shadow-[0_0_30px_rgba(99,102,241,0.25)] hover:-translate-y-0.5 transition-all duration-300">
    <div className={cn("w-14 h-14 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-br text-white shadow-lg", gradient)}>
      <Icon size={26} />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-white/50 text-xs font-semibold uppercase tracking-wider truncate">{title}</p>
      <p className="text-2xl font-bold text-white leading-none mt-0.5">{value}</p>
      {sub && <p className="text-white/40 text-xs mt-1 truncate">{sub}</p>}
    </div>
    <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-white/5 blur-2xl group-hover:bg-white/10 transition-colors" />
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
  const { t } = useI18n();
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
      setError(t('dashboard.error', 'Failed to load system status'));
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
      <div className="glass border border-red-500/30 text-red-200 px-4 py-3 rounded-xl flex items-center gap-3">
        <AlertCircle size={20} />
        <span>{error}</span>
        <button onClick={fetchStatus} className="ml-auto underline text-sm font-medium hover:text-red-100">{t('dashboard.retry', 'Retry')}</button>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-12 h-12 border-4 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
      </div>
    );
  }

  const cpuPercent = Number(status.cpu).toFixed(1) + '%';
  const memPercent = Number(status.memory).toFixed(1) + '%';
  const diskPercent = Number(status.disk).toFixed(1) + '%';
  const uptimeStr = formatUptime(status.uptime || 0);
  const ipInfo = status.ip_info;

  // IP 类型本地化显示：始终显示中文类型（住宅宽带 / 服务器机房 / 内网）
  const ipTypeLabel = ipInfo
    ? (ipInfo.ip_type_zh || ipInfo.ip_type || t('dashboard.unknown', '未知'))
    : t('dashboard.unknown', '未知');

  // IP 国家/城市：ipinfo.io 返回的国家代码（如 SG）+ 城市名（如 Singapore）
  const ipLocation = ipInfo && (ipInfo.country !== '-' || ipInfo.city !== '-')
    ? [ipInfo.city, ipInfo.country].filter(v => v && v !== '-').join(' / ')
    : '-';

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-violet-200 bg-clip-text text-transparent">{t('dashboard.title', 'System Overview')}</h1>
          <p className="text-white/50">{t('dashboard.subtitle', 'Real-time monitoring of your server')}</p>
        </div>
        <button
          onClick={fetchStatus}
          className="glass-btn p-2.5 text-white/80 hover:text-white rounded-xl transition-all disabled:opacity-50"
          disabled={loading}
        >
          <RefreshCcw className={cn("h-5 w-5", loading && "animate-spin")} />
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title={t('dashboard.cpu', 'CPU Usage')}
          value={cpuPercent}
          sub={`${status.cpu_cores}C/${status.cpu_threads}T · ${status.cpu_model || t('dashboard.unknown', 'Unknown')}`}
          icon={Cpu}
          gradient="from-blue-500 to-cyan-600"
        />
        <StatCard
          title={t('dashboard.memory', 'Memory')}
          value={memPercent}
          icon={MemoryStick}
          gradient="from-violet-500 to-purple-600"
        />
        <StatCard
          title={t('dashboard.disk', 'Disk')}
          value={diskPercent}
          icon={HardDrive}
          gradient="from-orange-500 to-amber-600"
        />
        <StatCard
          title={t('dashboard.uptime', 'Uptime')}
          value={uptimeStr}
          sub={`${status.os || ''} ${status.kernel || ''}`}
          icon={Activity}
          gradient="from-green-500 to-emerald-600"
        />
      </div>

      {/* Network & IP Info */}
      <div className="glass-strong p-6 rounded-2xl">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Globe size={18} className="text-white/60" />
          {t('dashboard.networkInfo', 'Network & IP Info')}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: t('dashboard.ipv4', 'IPv4 地址'), value: ipInfo?.ipv4 || '-' },
            { label: t('dashboard.ipv6', 'IPv6 地址'), value: ipInfo?.ipv6 === '-' ? t('dashboard.ipv6None', 'ipv6: -') : (ipInfo?.ipv6 || t('dashboard.ipv6None', 'ipv6: -')) },
            { label: t('dashboard.ispAsn', 'ISP 与 ASN'), value: ipInfo ? `${ipInfo.isp} (${ipInfo.asn})` : '-' },
            { label: t('dashboard.ipType', 'IP 类型'), value: ipTypeLabel },
            { label: t('dashboard.location', 'IP 位置'), value: ipLocation },
          ].map((item) => (
            <div key={item.label} className="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-colors">
              <p className="text-white/50 text-xs font-medium">{item.label}</p>
              <p className="text-sm font-semibold text-white mt-1.5 truncate" title={item.value}>{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Load & Info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-strong p-6 rounded-2xl">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Server size={18} className="text-white/60" />
            {t('dashboard.load', 'System Load')}
          </h3>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: t('dashboard.min1', '1 min'), value: status.load1, grad: 'from-blue-500/20 to-blue-600/5' },
              { label: t('dashboard.min5', '5 min'), value: status.load5, grad: 'from-violet-500/20 to-violet-600/5' },
              { label: t('dashboard.min15', '15 min'), value: status.load15, grad: 'from-fuchsia-500/20 to-fuchsia-600/5' },
            ].map((item) => (
              <div key={item.label} className={cn("text-center p-4 rounded-xl bg-gradient-to-br", item.grad, "border border-white/10 hover:border-white/20 transition-colors")}>
                <p className="text-2xl font-bold text-white">{Number(item.value || 0).toFixed(2)}</p>
                <p className="text-white/50 text-xs mt-1">{item.label}</p>
              </div>
            ))}
          </div>
          {status.network && (
            <div className="mt-4 flex gap-6 text-sm text-white/60">
              <span className="flex items-center gap-1.5">
                <span className="text-green-400">↓</span> {(status.network.rx / 1024).toFixed(1)} KB/s
              </span>
              <span className="flex items-center gap-1.5">
                <span className="text-blue-400">↑</span> {(status.network.tx / 1024).toFixed(1)} KB/s
              </span>
            </div>
          )}
        </div>

        <div className="glass-strong p-6 rounded-2xl">
          <h3 className="text-lg font-semibold text-white mb-4">{t('dashboard.info', 'System Info')}</h3>
          <div className="space-y-0 divide-y divide-white/8">
            {[
              [t('dashboard.hostname', 'Hostname'), status.hostname],
              [t('dashboard.os', 'OS'), status.os],
              [t('dashboard.kernel', 'Kernel'), status.kernel],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between py-2.5 px-2 -mx-2 hover:bg-white/5 rounded-lg transition-colors">
                <span className="text-white/50">{label}</span>
                <span className="font-medium text-white">{value || '--'}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
