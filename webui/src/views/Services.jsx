import React, { useState, useEffect } from 'react';
import apiClient from '../api/client';
import { 
  Play, 
  Square, 
  RotateCw, 
  Loader2, 
  AlertCircle, 
  Search,
  Server,
  Clock,
  FileText,
} from 'lucide-react';

const cn = (...classes) => classes.filter(Boolean).join(' ');

// ==================== Stats Bar ====================
const StatsBar = ({ services }) => {
  const running = services.filter(s => s.status === 'active').length;
  const failed = services.filter(s => s.status === 'failed').length;
  const inactive = services.filter(s => s.status !== 'active' && s.status !== 'failed').length;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
      {[
        { label: 'Total Services', value: services.length, icon: Server, color: 'blue' },
        { label: 'Running', value: running, icon: Play, color: 'green' },
        { label: 'Failed', value: failed, icon: AlertCircle, color: 'red' },
        { label: 'Stopped', value: inactive, icon: Square, color: 'gray' },
      ].map(s => (
        <div key={s.label} className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex items-center gap-3">
          <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
            s.color === 'blue' ? 'bg-blue-100 text-blue-600' :
            s.color === 'green' ? 'bg-green-100 text-green-600' :
            s.color === 'red' ? 'bg-red-100 text-red-600' :
            'bg-gray-100 text-gray-500'
          )}>
            <s.icon size={18} />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">{s.label}</p>
            <p className="text-lg font-bold text-gray-800 leading-none">{s.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

// ==================== Service Row ====================
const ServiceRow = ({ service, onAction }) => {
  const [loading, setLoading] = useState(null);
  const isRunning = service.status === 'active';
  const isFailed = service.status === 'failed';

  const handleAction = async (action) => {
    setLoading(action);
    try {
      await apiClient.post(`/service/${encodeURIComponent(service.name)}/${action}`);
      onAction(service.name, action);
    } catch (err) {
      alert(`${action} failed: ${err.response?.data?.error || err.message}`);
    } finally {
      setLoading(null);
    }
  };

  const statusColor = isRunning ? 'bg-green-100 text-green-700' :
                     isFailed ? 'bg-red-100 text-red-700' :
                     'bg-gray-100 text-gray-500';
  const statusLabel = isRunning ? 'running' : isFailed ? 'failed' : service.status || 'inactive';

  return (
    <tr className={cn("hover:bg-gray-50 transition-colors group border-b border-gray-50 last:border-0",
      isFailed && "bg-red-50/50"
    )}>
      <td className="px-5 py-3">
        <div className="flex items-center gap-2">
          <div className={cn("w-2 h-2 rounded-full",
            isRunning ? 'bg-green-500' : isFailed ? 'bg-red-500' : 'bg-gray-300'
          )} />
          <span className="font-mono text-sm text-gray-800 max-w-[240px] truncate" title={service.name}>
            {service.name}
          </span>
        </div>
      </td>
      <td className="px-5 py-3">
        <span className={cn("inline-flex px-2 py-0.5 rounded-full text-xs font-medium", statusColor)}>
          {statusLabel}
        </span>
      </td>
      <td className="px-5 py-3">
        <span className={cn("inline-flex px-2 py-0.5 rounded-full text-xs font-medium",
          service.enabled === 'enabled' ? 'bg-blue-100 text-blue-700' :
          service.enabled === 'disabled' ? 'bg-gray-100 text-gray-500' :
          'bg-yellow-100 text-yellow-700'
        )}>
          {service.enabled || '-'}
        </span>
      </td>
      <td className="px-5 py-3 text-right">
        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {!isRunning && (
            <button
              onClick={() => handleAction('start')}
              disabled={loading === 'start'}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors disabled:opacity-50"
              title="Start"
            >
              {loading === 'start' ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
              Start
            </button>
          )}
          {isRunning && (
            <>
              <button
                onClick={() => handleAction('restart')}
                disabled={loading === 'restart'}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors disabled:opacity-50"
                title="Restart"
              >
                {loading === 'restart' ? <Loader2 size={12} className="animate-spin" /> : <RotateCw size={12} />}
                Restart
              </button>
              <button
                onClick={() => handleAction('stop')}
                disabled={loading === 'stop'}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50"
                title="Stop"
              >
                {loading === 'stop' ? <Loader2 size={12} className="animate-spin" /> : <Square size={12} />}
                Stop
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
};

// ==================== Main View ====================
const ServicesView = () => {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);

  const fetchServices = async () => {
    setRefreshing(true);
    try {
      const res = await apiClient.get('/services');
      setServices(Array.isArray(res.data) ? res.data : []);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchServices();
    const interval = setInterval(fetchServices, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleAction = (name, action) => {
    if (action === 'stop') {
      setServices(prev => prev.map(s => s.name === name ? { ...s, status: 'inactive' } : s));
    } else if (action === 'start') {
      setServices(prev => prev.map(s => s.name === name ? { ...s, status: 'active' } : s));
    } else if (action === 'restart') {
      // just refresh after a brief delay
      setTimeout(fetchServices, 1500);
    }
  };

  const filtered = services
    .filter(s => s.name.toLowerCase().includes(search.toLowerCase()))
    .filter(s => filter === 'all' || s.status === filter);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">Services</h1>
        <button
          onClick={fetchServices}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <RotateCw size={14} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <StatsBar services={services} />

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search services…"
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1">
          {[
            { key: 'all', label: 'All' },
            { key: 'active', label: 'Running' },
            { key: 'failed', label: 'Failed' },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn("px-3 py-1.5 text-xs font-medium rounded-lg transition-colors",
                filter === f.key
                  ? "bg-blue-600 text-white"
                  : "text-gray-500 hover:bg-gray-100"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {error && (
          <div className="bg-red-50 border-b border-red-100 px-5 py-3 flex items-center gap-2 text-red-600 text-sm">
            <AlertCircle size={16} />
            {error}
            <button onClick={fetchServices} className="ml-auto underline">Retry</button>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[500px]">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-5 py-3 text-xs font-bold text-gray-500 uppercase">Service</th>
                <th className="px-5 py-3 text-xs font-bold text-gray-500 uppercase">Status</th>
                <th className="px-5 py-3 text-xs font-bold text-gray-500 uppercase">Enabled</th>
                <th className="px-5 py-3 text-xs font-bold text-gray-500 uppercase text-right w-40">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-5 py-12 text-center text-gray-400">
                    {loading ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 size={28} className="animate-spin text-blue-500" />
                        <span className="text-sm">Loading services…</span>
                      </div>
                    ) : (
                      <span>No services match your search</span>
                    )}
                  </td>
                </tr>
              ) : filtered.map(s => (
                <ServiceRow key={s.name} service={s} onAction={handleAction} />
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-2.5 bg-gray-50 border-t border-gray-100 text-xs text-gray-400 flex justify-between">
          <span>{filtered.length} of {services.length} services</span>
          <span>Auto-refresh every 10s</span>
        </div>
      </div>
    </div>
  );
};

export default ServicesView;
