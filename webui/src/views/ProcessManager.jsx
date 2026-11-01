import React, { useState, useEffect } from 'react';
import apiClient from '../api/client';
import { useI18n } from '../i18n';
import { 
  Play, 
  Square, 
  RotateCw, 
  Trash2, 
  Loader2, 
  AlertCircle, 
  Search,
  Cpu,
  MemoryStick,
  Timer,
} from 'lucide-react';

const cn = (...classes) => classes.filter(Boolean).join(' ');

// ==================== Stats Bar ====================
const StatsBar = ({ processes }) => {
  const { t } = useI18n();
  const running = processes.length;
  const topCPU = processes.reduce((max, p) => p.cpu > max ? p.cpu : max, 0);
  const topMem = processes.reduce((max, p) => p.memory > max ? p.memory : max, 0);
  const totalCPU = processes.reduce((s, p) => s + p.cpu, 0);
  const totalMem = processes.reduce((s, p) => s + p.memory, 0);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
      {[
        { label: t('process.stats.processes', 'Processes'), value: running, icon: Timer, color: 'blue' },
        { label: t('process.stats.totalCPU', 'Total CPU%'), value: totalCPU.toFixed(1), icon: Cpu, color: 'purple' },
        { label: t('process.stats.maxCPU', 'Max CPU%'), value: topCPU.toFixed(1), icon: Cpu, color: 'orange' },
        { label: t('process.stats.totalMem', 'Total Mem%'), value: totalMem.toFixed(1), icon: MemoryStick, color: 'green' },
      ].map(s => (
        <div key={s.label} className="glass-strong rounded-2xl border border-white/10 flex items-center gap-3">
          <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
            s.color === 'blue' ? 'bg-blue-100 text-blue-600' :
            s.color === 'purple' ? 'bg-purple-100 text-purple-600' :
            s.color === 'orange' ? 'bg-orange-100 text-orange-600' :
            'bg-green-100 text-green-600'
          )}>
            <s.icon size={18} />
          </div>
          <div>
            <p className="text-xs text-white/50 font-medium">{s.label}</p>
            <p className="text-lg font-bold text-white leading-none">{s.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

// ==================== Process Row ====================
const ProcessRow = ({ proc, onKill }) => {
  const { t } = useI18n();
  const [killing, setKilling] = useState(false);

  const handleKill = async () => {
    const confirmMsg = t('process.kill.confirm', 'Kill process "{name}" (PID {pid})?')
      .replace('{name}', proc.name)
      .replace('{pid}', proc.pid);
    if (!window.confirm(confirmMsg)) return;
    setKilling(true);
    try {
      await apiClient.post(`/process/${proc.pid}`);
      onKill(proc.pid);
    } catch (err) {
      alert('Kill failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setKilling(false);
    }
  };

  return (
    <tr className="hover:bg-white/5 transition-colors group">
      <td className="px-5 py-3 font-mono text-xs text-white/40 w-20">{proc.pid}</td>
      <td className="px-5 py-3 text-sm font-medium text-white max-w-[260px] truncate" title={proc.name}>{proc.name}</td>
      <td className="px-5 py-3">
        <div className="flex items-center gap-2">
          <div className="w-16 bg-gray-200 rounded-full h-1.5 overflow-hidden">
            <div 
              className={cn("h-full rounded-full transition-all duration-300", 
                proc.cpu > 50 ? 'bg-red-500' : proc.cpu > 10 ? 'bg-orange-500' : 'bg-blue-500'
              )}
              style={{ width: `${Math.min(proc.cpu, 100)}%` }}
            />
          </div>
          <span className={cn("text-xs font-medium w-12",
            proc.cpu > 50 ? 'text-red-600' : proc.cpu > 10 ? 'text-orange-600' : 'text-white/50'
          )}>{proc.cpu.toFixed(1)}%</span>
        </div>
      </td>
      <td className="px-5 py-3">
        <div className="flex items-center gap-2">
          <div className="w-16 bg-gray-200 rounded-full h-1.5 overflow-hidden">
            <div 
              className={cn("h-full rounded-full transition-all duration-300",
                proc.memory > 10 ? 'bg-red-500' : proc.memory > 3 ? 'bg-orange-500' : 'bg-green-500'
              )}
              style={{ width: `${Math.min(proc.memory, 100)}%` }}
            />
          </div>
          <span className={cn("text-xs font-medium w-12",
            proc.memory > 10 ? 'text-red-600' : proc.memory > 3 ? 'text-orange-600' : 'text-white/50'
          )}>{proc.memory.toFixed(1)}%</span>
        </div>
      </td>
      <td className="px-5 py-3 text-right">
        <button
          onClick={handleKill}
          disabled={killing}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50"
          title={t('process.kill.button.title', 'Kill process')}
        >
          {killing ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
          {t('process.kill.button', 'Kill')}
        </button>
      </td>
    </tr>
  );
};

// ==================== Main View ====================
const ProcessManagerView = () => {
  const { t } = useI18n();
  const [processes, setProcesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState('cpu');
  const [sortDir, setSortDir] = useState('desc');
  const [refreshing, setRefreshing] = useState(false);

  const fetchProcesses = async () => {
    setRefreshing(true);
    try {
      const res = await apiClient.get('/processes');
      setProcesses(Array.isArray(res.data) ? res.data : []);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchProcesses();
    const interval = setInterval(fetchProcesses, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleKill = (pid) => {
    setProcesses(prev => prev.filter(p => p.pid !== pid));
  };

  const filtered = processes
    .filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const av = a[sortField] ?? 0;
      const bv = b[sortField] ?? 0;
      return sortDir === 'desc' ? bv - av : av - bv;
    });

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <span className="text-white/40 ml-1">↕</span>;
    return <span className="text-blue-400 ml-1">{sortDir === 'desc' ? '↓' : '↑'}</span>;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">{t('process.title', 'Process Manager')}</h1>
        <button
          onClick={fetchProcesses}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-3 py-2 glass-input rounded-lg text-sm text-white/70 hover:text-white transition-colors disabled:opacity-50"
        >
          <RotateCw size={14} className={refreshing ? 'animate-spin' : ''} />
          {t('process.refresh', 'Refresh')}
        </button>
      </div>

      <StatsBar processes={processes} />

      {/* Search bar */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('process.filter.placeholder', 'Filter by process name…')}
          className="glass-input w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none"
        />
      </div>

      {/* Table */}
      <div className="glass rounded-xl border border-white/10 overflow-hidden">
        {error && (
          <div className="bg-red-50 border-b border-red-100 px-5 py-3 flex items-center gap-2 text-red-600 text-sm">
            <AlertCircle size={16} />
            {error}
            <button onClick={fetchProcesses} className="ml-auto underline">{t('process.retry', 'Retry')}</button>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[600px]">
            <thead className="bg-white/5 border-b border-white/8">
              <tr>
                <th className="px-5 py-3 text-xs font-bold text-white/50 uppercase cursor-pointer select-none" onClick={() => handleSort('pid')}>
                  {t('process.table.pid', 'PID')} <SortIcon field="pid" />
                </th>
                <th className="px-5 py-3 text-xs font-bold text-white/50 uppercase cursor-pointer select-none" onClick={() => handleSort('name')}>
                  {t('process.table.name', 'Name')} <SortIcon field="name" />
                </th>
                <th className="px-5 py-3 text-xs font-bold text-white/50 uppercase cursor-pointer select-none" onClick={() => handleSort('cpu')}>
                  {t('process.table.cpu', 'CPU %')} <SortIcon field="cpu" />
                </th>
                <th className="px-5 py-3 text-xs font-bold text-white/50 uppercase cursor-pointer select-none" onClick={() => handleSort('memory')}>
                  {t('process.table.memory', 'Mem %')} <SortIcon field="memory" />
                </th>
                <th className="px-5 py-3 text-xs font-bold text-white/50 uppercase text-right w-24">{t('process.table.actions', 'Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-5 py-12 text-center text-white/40">
                    {loading ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 size={28} className="animate-spin text-blue-500" />
                        <span className="text-sm">{t('process.loading', 'Loading processes…')}</span>
                      </div>
                    ) : (
                      <span>{t('process.noMatch', 'No processes match your search')}</span>
                    )}
                  </td>
                </tr>
              ) : filtered.map(proc => (
                <ProcessRow key={proc.pid} proc={proc} onKill={handleKill} />
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-2.5 bg-white/5 border-t border-white/8 text-xs text-white/40 flex justify-between">
          <span>{t('process.summary', '{shown} of {total} processes').replace('{shown}', filtered.length).replace('{total}', processes.length)}</span>
          <span>{t('process.autorefresh', 'Auto-refresh every 5s')}</span>
        </div>
      </div>
    </div>
  );
};

export default ProcessManagerView;
