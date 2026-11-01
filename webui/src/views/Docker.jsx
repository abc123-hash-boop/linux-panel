import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/client';
import { 
  Play, 
  Square, 
  RotateCw, 
  Trash2, 
  Container as ContainerIcon,
  Info,
  Loader2,
  HardDrive,
  Plus,
  Download,
  X,
  CheckCircle,
  AlertCircle,
  Terminal as TerminalIcon,
  FolderOpen
} from 'lucide-react';
import '@xterm/xterm/css/xterm.css';
import { useI18n } from '../i18n';

const cn = (...classes) => classes.filter(Boolean).join(' ');

// ==================== Info View ====================
const InfoView = ({ dockerInfo, containers, images }) => {
  const { t } = useI18n();
  const runningCount = containers.filter(c => c.state === 'running').length;
  const stoppedCount = containers.length - runningCount;

  const formatBytes = (bytes) => {
    if (!bytes) return '--';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0, val = bytes;
    while (val >= 1024 && i < units.length - 1) { val /= 1024; i++; }
    return val.toFixed(1) + ' ' + units[i];
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: t('docker.totalContainers', 'Total Containers'), value: containers.length, color: 'blue' },
          { label: t('docker.running', 'Running'), value: runningCount, color: 'green' },
          { label: t('docker.stopped', 'Stopped'), value: stoppedCount, color: 'gray' },
          { label: t('docker.images', 'Images'), value: images?.length || '--', color: 'purple' },
        ].map((stat) => (
          <div key={stat.label} className="glass-strong rounded-2xl border border-white/10 p-5">
            <p className="text-xs text-white/50 uppercase font-bold">{stat.label}</p>
            <p className={cn("text-2xl font-bold mt-1",
              stat.color === 'green' ? 'text-green-400' :
              stat.color === 'blue' ? 'text-blue-400' :
              stat.color === 'purple' ? 'text-purple-400' : 'text-white/70'
            )}>{stat.value}</p>
          </div>
        ))}
      </div>
      {dockerInfo && (
        <div className="glass rounded-xl border border-white/10 p-6">
          <h3 className="text-sm font-semibold text-white/50 uppercase mb-4">{t('docker.info', 'Engine Details')}</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {[
              [t('docker.version', 'Version'), dockerInfo.server_version],
              [t('docker.os', 'Operating System'), dockerInfo.os],
              [t('docker.arch', 'Architecture'), dockerInfo.architecture],
              [t('docker.storageDriver', 'Storage Driver'), dockerInfo.storage_driver],
              [t('docker.cpus', 'CPUs'), dockerInfo.cpu],
              [t('docker.memory', 'Memory'), formatBytes(dockerInfo.memory)],
              [t('docker.cgroup', 'CGroup'), 'v' + (dockerInfo.cgroup_version || '--')],
              [t('docker.kernel', 'Kernel'), dockerInfo.kernel],
            ].map(([label, value]) => (
              <div key={label}>
                <span className="text-white/50">{label}</span>
                <p className="font-medium text-white mt-1">{value || '--'}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ==================== Images View ====================
const ImagesView = ({ images, onPull, onDeleteImage }) => {
  const { t } = useI18n();
  const [showPull, setShowPull] = useState(false);
  const [imageInput, setImageInput] = useState('');

  const formatBytes = (bytes) => {
    if (!bytes) return '--';
    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0, val = bytes;
    while (val >= 1024 && i < units.length - 1) { val /= 1024; i++; }
    return val.toFixed(1) + ' ' + units[i];
  };

  const handlePull = async () => {
    if (!imageInput.trim()) return;
    await onPull(imageInput.trim());
    setImageInput('');
    setShowPull(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowPull(!showPull)} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl hover:from-violet-500 hover:to-indigo-500 transition-all text-sm font-medium shadow-lg shadow-violet-600/20">
          <Download size={16} />{t('docker.pull', 'Pull Image')}
        </button>
      </div>
      {showPull && (
        <div className="glass rounded-xl border border-white/10 p-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={imageInput}
              onChange={e => setImageInput(e.target.value)}
              placeholder="e.g. nginx:latest, ubuntu:22.04"
              className="glass-input flex-1 px-3 py-2 rounded-lg text-sm outline-none"
              onKeyDown={e => e.key === 'Enter' && handlePull()}
            />
            <button onClick={handlePull} className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm hover:bg-violet-500">{t('docker.pullBtn', 'Pull')}</button>
            <button onClick={() => { setShowPull(false); setImageInput(''); }} className="px-3 py-2 text-white/40 hover:text-white"><X size={16} /></button>
          </div>
        </div>
      )}
      <div className="glass rounded-xl border border-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[640px]">
            <thead className="glass-table-head border-b border-white/8">
              <tr>
                <th className="px-6 py-3 text-xs font-bold text-white/50 uppercase">{t('docker.repository', 'Repository')}</th>
                <th className="px-6 py-3 text-xs font-bold text-white/50 uppercase">{t('docker.tag', 'Tag')}</th>
                <th className="px-6 py-3 text-xs font-bold text-white/50 uppercase">{t('docker.size', 'Size')}</th>
                <th className="px-6 py-3 text-xs font-bold text-white/50 uppercase">{t('docker.created', 'Created')}</th>
                <th className="px-6 py-3 text-xs font-bold text-white/50 uppercase">{t('docker.containers', 'Containers')}</th>
                <th className="px-6 py-3 text-xs font-bold text-white/50 uppercase text-right">{t('docker.actions', 'Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/8">
              {images.length === 0 ? (
                <tr><td colSpan="6" className="px-6 py-12 text-center text-white/40 italic">{t('docker.noImages', 'No images found.')}</td></tr>
              ) : images.map(img => (
                <tr key={img.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4 font-medium text-white text-sm">{(img.tags?.[0]?.split(':')[0]) || img.id.slice(0, 12)}</td>
                  <td className="px-6 py-4 text-sm text-white/50">{(img.tags?.[0]?.split(':')[1]) || 'latest'}</td>
                  <td className="px-6 py-4 text-sm text-white/50">{formatBytes(img.size)}</td>
                  <td className="px-6 py-4 text-sm text-white/50">{new Date(img.created * 1000).toLocaleDateString()}</td>
                  <td className="px-6 py-4">
                    <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium border", img.containers > 0 ? "bg-green-500/15 text-green-300 border-green-500/30" : "bg-white/5 text-white/50 border-white/10")}>
                      {img.containers > 0 ? `${img.containers} ${t('docker.using', 'using')}` : t('docker.none', 'None')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => onDeleteImage(img.id, (img.tags?.[0]) || img.id.slice(0, 12))} className="p-2 text-red-400 hover:bg-red-500/15 rounded-lg transition-colors" title={t('docker.remove', 'Remove')}><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ==================== Containers View ====================
const ContainersView = ({ containers, onAction, navigate }) => {
  const { t } = useI18n();
  return containers.length === 0 ? (
    <div className="text-center py-16 text-white/40">
      <ContainerIcon size={48} className="mx-auto mb-4 opacity-30" />
      <p className="text-lg font-medium">{t('docker.noContainers', 'No containers')}</p>
    </div>
  ) : (
    <div className="glass rounded-xl border border-white/10 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left min-w-[720px]">
          <thead className="glass-table-head border-b border-white/8">
            <tr>
              <th className="px-6 py-3 text-xs font-bold text-white/50 uppercase">{t('docker.name', 'Name')}</th>
              <th className="px-6 py-3 text-xs font-bold text-white/50 uppercase">{t('docker.image', 'Image')}</th>
              <th className="px-6 py-3 text-xs font-bold text-white/50 uppercase">{t('docker.status', 'Status')}</th>
              <th className="px-6 py-3 text-xs font-bold text-white/50 uppercase">{t('docker.ip', 'IP')}</th>
              <th className="px-6 py-3 text-xs font-bold text-white/50 uppercase">{t('docker.ports', 'Ports')}</th>
              <th className="px-6 py-3 text-xs font-bold text-white/50 uppercase text-right">{t('docker.actions', 'Actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/8">
            {containers.map(c => (
              <tr key={c.id} className="hover:bg-white/5 transition-colors">
                <td className="px-6 py-4 font-medium text-white">{c.name}</td>
                <td className="px-6 py-4 text-sm text-white/50">{c.image}</td>
                <td className="px-6 py-4">
                  <span className={cn("px-2.5 py-1 rounded-full text-xs font-medium border", c.state === 'running' ? "bg-green-500/15 text-green-300 border-green-500/30" : "bg-white/5 text-white/70 border-white/10")}>{c.state}</span>
                </td>
                <td className="px-6 py-4 text-sm text-white/50 font-mono">{c.ip || '--'}</td>
                <td className="px-6 py-4 text-sm text-white/50">{c.ports?.join(', ') || '--'}</td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-1">
                    {c.state === 'running' ? (
                      <>
                        <button onClick={() => onAction(c.id, 'stop')} className="p-2 text-orange-400 hover:bg-orange-500/15 rounded-md" title={t('docker.stop', 'Stop')}><Square size={16} /></button>
                        <button onClick={() => onAction(c.id, 'restart')} className="p-2 text-blue-400 hover:bg-blue-500/15 rounded-md" title={t('docker.restart', 'Restart')}><RotateCw size={16} /></button>
                      </>
                    ) : (
                      <button onClick={() => onAction(c.id, 'start')} className="p-2 text-green-400 hover:bg-green-500/15 rounded-md" title={t('docker.start', 'Start')}><Play size={16} /></button>
                    )}
                    <button onClick={() => onAction(c.id, 'remove')} className="p-2 text-red-400 hover:bg-red-500/15 rounded-md" title={t('docker.remove', 'Remove')}><Trash2 size={16} /></button>
                    {c.state === 'running' && (
                      <button onClick={() => navigate(`/terminal?container=${c.id}`)} className="p-2 text-violet-300 hover:bg-violet-500/15 rounded-md" title={t('docker.openTerminal', 'Open Terminal')}>
                        <TerminalIcon size={16} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ==================== Compose View ====================
const ComposeView = ({ composeProjects, onUpload, onStart, onStop, onRestart, onDelete, onLogs }) => {
  const { t } = useI18n();
  const [showUpload, setShowUpload] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [composeContent, setComposeContent] = useState('');
  const [uploading, setUploading] = useState(false);

  const handleUpload = async () => {
    if (!projectName.trim() || !composeContent.trim()) return;
    setUploading(true);
    try {
      await onUpload(projectName.trim(), composeContent);
      setProjectName('');
      setComposeContent('');
      setShowUpload(false);
    } catch (e) {
      alert(t('docker.uploadFailed', 'Upload failed') + ': ' + (e.response?.data?.error || e.message));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowUpload(!showUpload)} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl hover:from-violet-500 hover:to-indigo-500 transition-all text-sm font-medium shadow-lg shadow-violet-600/20">
          <FolderOpen size={16} />{t('docker.uploadCompose', 'Upload Compose')}
        </button>
      </div>
      {showUpload && (
        <div className="glass-strong rounded-xl border border-white/10 p-6 space-y-4">
          <h3 className="font-semibold text-white">{t('docker.uploadTitle', 'Upload docker-compose.yml')}</h3>
          <div>
            <label className="block text-sm font-medium text-white/80 mb-1">{t('docker.projectName', 'Project Name')}</label>
            <input type="text" value={projectName} onChange={e => setProjectName(e.target.value)} placeholder="e.g. nginx, minecraft" className="glass-input w-full px-3 py-2 rounded-lg text-sm outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-white/80 mb-1">{t('docker.yamlContent', 'YAML Content')}</label>
            <textarea value={composeContent} onChange={e => setComposeContent(e.target.value)} rows={10} placeholder="version: '3'\nservices:\n  nginx:\n    image: nginx:latest" className="glass-input w-full px-3 py-2 rounded-lg text-sm font-mono outline-none" />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowUpload(false)} className="px-4 py-2 text-white/70 hover:bg-white/10 rounded-lg text-sm">{t('docker.cancel', 'Cancel')}</button>
            <button onClick={handleUpload} disabled={uploading} className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm hover:bg-violet-500 disabled:opacity-50">{uploading ? t('docker.uploading', 'Uploading...') : t('docker.upload', 'Upload')}</button>
          </div>
        </div>
      )}
      {composeProjects.length === 0 ? (
        <div className="text-center py-16 text-white/40">
          <FolderOpen size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">{t('docker.noCompose', 'No Compose projects')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {composeProjects.map(proj => (
            <div key={proj.name} className="glass rounded-xl border border-white/10 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-violet-500/20 rounded-lg flex items-center justify-center border border-violet-500/30">
                  <FolderOpen className="text-violet-300" size={20} />
                </div>
                <div>
                  <p className="font-semibold text-white">{proj.name}</p>
                  <p className="text-xs text-white/50 font-mono">{proj.path}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => onLogs(proj.name)} className="p-2 text-white/60 hover:text-violet-300 hover:bg-violet-500/15 rounded-lg transition-colors" title={t('docker.viewLogs', 'View Logs')}><TerminalIcon size={16} /></button>
                <button onClick={() => onStart(proj.name)} className="p-2 text-green-400 hover:bg-green-500/15 rounded-lg transition-colors" title={t('docker.start', 'Start')}><Play size={16} /></button>
                <button onClick={() => onRestart(proj.name)} className="p-2 text-blue-400 hover:bg-blue-500/15 rounded-lg transition-colors" title={t('docker.restart', 'Restart')}><RotateCw size={16} /></button>
                <button onClick={() => onStop(proj.name)} className="p-2 text-orange-400 hover:bg-orange-500/15 rounded-lg transition-colors" title={t('docker.stop', 'Stop')}><Square size={16} /></button>
                <button onClick={() => onDelete(proj.name)} className="p-2 text-red-400 hover:bg-red-500/15 rounded-lg transition-colors" title={t('docker.remove', 'Remove')}><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ==================== Main Docker View ====================
const DockerView = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('containers');
  const [containers, setContainers] = useState([]);
  const [dockerInfo, setDockerInfo] = useState(null);
  const [images, setImages] = useState([]);
  const [composeProjects, setComposeProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pulling, setPulling] = useState(null);
  const [logsModal, setLogsModal] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    image: '',
    command: '',
    env: '',
    ports: '',
    volumes: '',
    privileged: false,
    autoStart: true,
  });
  const [creating, setCreating] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [infoRes, containerRes, imageRes, composeRes] = await Promise.all([
        apiClient.get('/docker/info'),
        apiClient.get('/docker/containers'),
        apiClient.get('/docker/images'),
        apiClient.get('/docker/compose/list'),
      ]);
      setDockerInfo(infoRes.data);
      setContainers(containerRes.data || []);
      setImages(imageRes.data || []);
      setComposeProjects(composeRes.data || []);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch Docker data:', err);
      setError(err.response?.data?.error || t('docker.loadError', 'Failed to load Docker information'));
    } finally {
      setLoading(false);
    }
  };

  const handleContainerAction = async (id, action) => {
    try {
      if (action === 'remove') {
        if (!window.confirm(t('docker.deleteConfirm', 'Are you sure you want to delete this container?'))) return;
        await apiClient.delete(`/docker/container/${id}`);
      } else {
        await apiClient.post(`/docker/container/${action}/${id}`);
      }
      fetchData();
    } catch (err) {
      alert(t('docker.opFailed', 'Operation failed') + ': ' + (err.response?.data?.error || err.message));
    }
  };

  const handleImagePull = async (imageName) => {
    try {
      const res = await apiClient.post('/docker/image/pull', { image: imageName });
      const taskId = res.data.task_id;
      const encodedTaskId = encodeURIComponent(taskId);
      setPulling({ image: imageName, taskId, progress: null, status: null });

      const poll = setInterval(async () => {
        try {
          const statusRes = await apiClient.get(`/docker/image/pull/status/${encodedTaskId}`);
          const data = statusRes.data;
          setPulling({ image: imageName, taskId, progress: data.progress, status: data.status });
          if (data.status === 'done' || data.status === 'failed') {
            clearInterval(poll);
            setPulling(null);
            if (data.status === 'done') {
              fetchData();
            } else {
              alert(t('docker.pullFailed', 'Pull failed') + ': ' + (data.logs?.join('\n') || t('docker.unknownError', 'Unknown error')));
            }
          }
        } catch {}
      }, 1000);
    } catch (err) {
      alert(t('docker.pullFailed', 'Pull failed') + ': ' + (err.response?.data?.error || err.message));
    }
  };

  const handleDeleteImage = async (imageId, imageTag) => {
    if (!window.confirm(`${t('docker.deleteImageConfirm', 'Are you sure you want to delete image')} "${imageTag}"?`)) return;
    try {
      await apiClient.delete(`/docker/image/${encodeURIComponent(imageId)}`);
      fetchData();
    } catch (err) {
      alert(t('docker.deleteFailed', 'Delete failed') + ': ' + (err.response?.data?.error || err.message));
    }
  };

  const handleComposeUpload = async (name, content) => {
    await apiClient.post('/docker/compose/upload', { name, content });
    fetchData();
  };

  const handleComposeStart = async (name) => {
    await apiClient.post(`/docker/compose/${name}/up`);
    fetchData();
  };

  const handleComposeStop = async (name) => {
    await apiClient.post(`/docker/compose/${name}/down`);
    fetchData();
  };

  const handleComposeRestart = async (name) => {
    await apiClient.post(`/docker/compose/${name}/restart`);
    fetchData();
  };

  const handleComposeDelete = async (name) => {
    await apiClient.delete(`/docker/compose/${name}`);
    fetchData();
  };

  const handleComposeLogs = async (name) => {
    try {
      const res = await apiClient.get(`/docker/compose/${name}/logs`);
      setLogsModal({ name, logs: res.data.logs });
    } catch (err) {
      alert(t('docker.fetchLogsFailed', 'Failed to fetch logs') + ': ' + (err.response?.data?.error || err.message));
    }
  };

  const handleContainerCreate = async () => {
    var _a, _b;
    if (!createForm.name.trim() || !createForm.image.trim()) {
      alert(t('docker.nameImageRequired', 'Container name and image are required'));
      return;
    }
    try {
      setCreating(true);
      const env = createForm.env.trim() ? createForm.env.split('\n').map(l => l.trim()).filter(Boolean) : [];
      const ports = createForm.ports.trim() ? createForm.ports.split('\n').map(l => l.trim()).filter(Boolean) : [];
      const volumes = createForm.volumes.trim() ? createForm.volumes.split('\n').map(l => {
        const [host, container, ...mode] = l.trim().split(':');
        return { host, container, mode: mode[0] || 'rw' };
      }).filter(v => v.host && v.container) : [];
      const res = await apiClient.post('/docker/container/create', {
        name: createForm.name.trim(),
        image: createForm.image.trim(),
        command: createForm.command.trim() || undefined,
        env,
        tty: false,
        stdin: false,
        privileged: createForm.privileged,
        auto_start: createForm.autoStart,
        ports,
        volumes,
      });
      if (res.data.success) {
        setShowCreate(false);
        setCreateForm({ name: '', image: '', command: '', env: '', ports: '', volumes: '', privileged: false, autoStart: true });
        alert(`"${res.data.id.slice(0, 12)}" ${res.data.started ? t('docker.createdAndStarted', 'created successfully and auto-started') : t('docker.createSuccess', 'created successfully')}`);
        fetchData();
      }
    } catch (err) {
      alert(t('docker.createFailed', 'Create failed') + ': ' + ((_b = (_a = err.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.error) || err.message);
    } finally {
      setCreating(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <Loader2 className="animate-spin text-violet-400" size={48} />
        <p className="text-white/50 font-medium">{t('docker.loadingData', 'Loading Docker data...')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass border border-red-500/30 text-red-200 px-4 py-3 rounded-xl flex items-center gap-3">
        <AlertCircle size={20} />
        <span>{error}</span>
        <button onClick={fetchData} className="ml-auto underline text-sm font-medium hover:text-red-100">{t('docker.retry', 'Retry')}</button>
      </div>
    );
  }

  const tabs = [
    { id: 'containers', label: t('docker.containers', 'Containers'), icon: ContainerIcon },
    { id: 'images', label: t('docker.images', 'Images'), icon: HardDrive },
    { id: 'compose', label: t('docker.compose', 'Compose'), icon: FolderOpen },
    { id: 'info', label: t('docker.engineDetails', 'Engine Details'), icon: Info },
  ];

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <aside className="w-full lg:w-48 shrink-0">
        <div className="glass-strong rounded-2xl border border-white/10 p-2 flex lg:flex-col gap-1 overflow-x-auto">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn("flex-1 lg:flex-none flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
                  activeTab === tab.id ? "glass-strong text-white shadow-[0_0_20px_rgba(139,92,246,0.3)]" : "text-white/60 hover:text-white hover:glass"
                )}
              >
                <Icon size={18} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </aside>

      <div className="flex-1 min-w-0 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-violet-200 bg-clip-text text-transparent">
            {tabs.find(t => t.id === activeTab)?.label}
          </h1>
          {activeTab === 'containers' && (
            <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl hover:from-violet-500 hover:to-indigo-500 transition-all text-sm font-medium shadow-lg shadow-violet-600/20">
              <Plus size={16} />{t('docker.create', 'Create')}
            </button>
          )}
        </div>

        {activeTab === 'containers' && <ContainersView containers={containers} onAction={handleContainerAction} navigate={navigate} />}
        {activeTab === 'images' && <ImagesView images={images} onPull={handleImagePull} onDeleteImage={handleDeleteImage} />}
        {activeTab === 'compose' && (
          <ComposeView
            composeProjects={composeProjects}
            onUpload={handleComposeUpload}
            onStart={handleComposeStart}
            onStop={handleComposeStop}
            onRestart={handleComposeRestart}
            onDelete={handleComposeDelete}
            onLogs={handleComposeLogs}
          />
        )}
        {activeTab === 'info' && <InfoView dockerInfo={dockerInfo} containers={containers} images={images} />}
      </div>

      {/* Create Container Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-dark rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-white/8 sticky top-0 bg-[#0f1020]/90 backdrop-blur-md z-10">
              <h3 className="text-lg font-bold text-white flex items-center gap-2"><Plus size={20} className="text-violet-400" />{t('docker.createTitle', 'Create Container')}</h3>
              <button onClick={() => setShowCreate(false)} className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-1">{t('docker.containerName', 'Container Name')} <span className="text-red-400">*</span></label>
                  <input type="text" value={createForm.name} onChange={e => setCreateForm({ ...createForm, name: e.target.value })} placeholder="my-container" className="glass-input w-full px-3 py-2 rounded-xl text-sm outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-1">{t('docker.image', 'Image')} <span className="text-red-400">*</span></label>
                  <input type="text" value={createForm.image} onChange={e => setCreateForm({ ...createForm, image: e.target.value })} placeholder="nginx:latest" className="glass-input w-full px-3 py-2 rounded-xl text-sm outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-white/80 mb-1">{t('docker.cmdLabel', 'Command')} <span className="text-white/40 text-xs font-normal">({t('docker.optional', 'optional')})</span></label>
                <input type="text" value={createForm.command} onChange={e => setCreateForm({ ...createForm, command: e.target.value })} placeholder="/bin/sh -c 'echo hello'" className="glass-input w-full px-3 py-2 rounded-xl text-sm font-mono outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/80 mb-1">{t('docker.envVars', 'Environment Variables')} <span className="text-white/40 text-xs font-normal">({t('docker.envHint', 'one per line, KEY=value')})</span></label>
                <textarea value={createForm.env} onChange={e => setCreateForm({ ...createForm, env: e.target.value })} rows={3} placeholder="DB_HOST=127.0.0.1\nDB_PORT=3306" className="glass-input w-full px-3 py-2 rounded-xl text-sm font-mono outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/80 mb-1">{t('docker.portMappings', 'Port Mappings')} <span className="text-white/40 text-xs font-normal">({t('docker.onePerLine', 'one per line')})</span></label>
                <textarea value={createForm.ports} onChange={e => setCreateForm({ ...createForm, ports: e.target.value })} rows={2} placeholder="8080:80\n443:443/tcp" className="glass-input w-full px-3 py-2 rounded-xl text-sm font-mono outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/80 mb-1">{t('docker.volumeMounts', 'Volume Mounts')} <span className="text-white/40 text-xs font-normal">({t('docker.volumeHint', 'one per line, /host:/container[:ro]')})</span></label>
                <textarea value={createForm.volumes} onChange={e => setCreateForm({ ...createForm, volumes: e.target.value })} rows={2} placeholder="/data/app:/app/data\n/logs:/var/log/app ro" className="glass-input w-full px-3 py-2 rounded-xl text-sm font-mono outline-none" />
              </div>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={createForm.privileged} onChange={e => setCreateForm({ ...createForm, privileged: e.target.checked })} className="w-4 h-4 text-violet-600 rounded border-white/20 bg-white/10" />
                  <span className="text-sm text-white/80">{t('docker.privileged', 'Privileged')}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={createForm.autoStart} onChange={e => setCreateForm({ ...createForm, autoStart: e.target.checked })} className="w-4 h-4 text-violet-600 rounded border-white/20 bg-white/10" />
                  <span className="text-sm text-white/80">{t('docker.autoStart', 'Auto Start')}</span>
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-white/8 bg-white/5 rounded-b-2xl">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-white/70 hover:bg-white/10 rounded-xl text-sm font-medium transition-colors">{t('docker.cancel', 'Cancel')}</button>
              <button onClick={handleContainerCreate} disabled={creating || !createForm.name.trim() || !createForm.image.trim()} className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 text-sm font-medium transition-all">
                {creating ? (<><Loader2 size={16} className="animate-spin" />{t('docker.creating', 'Creating...')}</>) : (<><Plus size={16} />{t('docker.createTitle', 'Create Container')}</>)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pull Image Modal */}
      {pulling && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-dark rounded-2xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-violet-500/20 rounded-xl flex items-center justify-center border border-violet-500/30">
                  <Download className="text-violet-300" size={20} />
                </div>
                <div>
                  <h3 className="font-semibold text-white">{t('docker.pulling', 'Pulling Image')}</h3>
                  <p className="text-xs text-white/50 font-mono">{pulling.image}</p>
                </div>
              </div>
              <div className="mb-3">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-white/50">{t('docker.progress', 'Progress')}</span>
                  <span className="font-medium text-violet-300">{pulling.progress ?? '—'}%</span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-violet-600 to-indigo-600 rounded-full transition-all duration-500 ease-out" style={{ width: pulling.progress != null ? `${pulling.progress}%` : '75%' }} />
                </div>
              </div>
              <div className="text-center py-2">
                {pulling.status === 'done' ? (
                  <p className="text-green-400 font-medium flex items-center justify-center gap-1"><CheckCircle size={16} /> {t('docker.complete', 'Complete')}</p>
                ) : pulling.status === 'failed' ? (
                  <p className="text-red-400 font-medium">{t('docker.failed', 'Failed')}</p>
                ) : (
                  <p className="text-white/50 text-sm flex items-center justify-center gap-2"><Loader2 size={14} className="animate-spin" /> {t('docker.pullingBtn', 'Pulling...')}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Compose Logs Modal */}
      {logsModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-dark rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-white/8">
              <div className="flex items-center gap-3">
                <h3 className="font-semibold text-white">{t('docker.logsFor', 'Logs:')} {logsModal.name}</h3>
                <span className="px-2.5 py-0.5 bg-violet-500/20 text-violet-300 text-xs rounded-full font-medium border border-violet-500/30">docker compose logs</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => { if(window.confirm(t('docker.composeRestartConfirm', 'Restart this Compose project?'))) { handleComposeRestart(logsModal.name); } }} className="p-2 text-blue-400 hover:bg-blue-500/15 rounded-lg transition-colors" title={t('docker.restart', 'Restart')}><RotateCw size={16} /></button>
                <button onClick={() => { if(window.confirm(t('docker.composeStopConfirm', 'Stop this Compose project?'))) { handleComposeStop(logsModal.name); setLogsModal(null); } }} className="p-2 text-orange-400 hover:bg-orange-500/15 rounded-lg transition-colors" title={t('docker.stop', 'Stop')}><Square size={16} /></button>
                <button onClick={() => { if(window.confirm(t('docker.composeDeleteConfirm', 'Delete this Compose project?'))) { handleComposeDelete(logsModal.name); } }} className="p-2 text-red-400 hover:bg-red-500/15 rounded-lg transition-colors" title={t('docker.remove', 'Remove')}><Trash2 size={16} /></button>
                <button onClick={() => setLogsModal(null)} className="ml-2 p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"><X size={18} /></button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4 bg-[#0d0d14]">
              <pre className="text-xs font-mono text-green-400 whitespace-pre-wrap break-all leading-relaxed">
                {logsModal.logs || <span className="text-white/40 italic">{t('docker.noLogs', 'No logs available')}</span>}
              </pre>
            </div>
            <div className="px-4 py-3 border-t border-white/8 flex items-center justify-between text-xs text-white/50">
              <span>{t('docker.lastLines', 'Showing last 200 lines')}</span>
              <button onClick={() => handleComposeLogs(logsModal.name)} className="flex items-center gap-1 text-violet-300 hover:text-violet-200 transition-colors"><RotateCw size={12} /> {t('docker.refresh', 'Refresh')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DockerView;
