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

const cn = (...classes) => classes.filter(Boolean).join(' ');

// ==================== Info View ====================
const InfoView = ({ dockerInfo, containers, images }) => {
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
          { label: 'Total Containers', value: containers.length, color: 'blue' },
          { label: 'Running', value: runningCount, color: 'green' },
          { label: 'Stopped', value: stoppedCount, color: 'gray' },
          { label: 'Images', value: images?.length || '--', color: 'purple' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
            <p className="text-xs text-gray-500 uppercase font-bold">{stat.label}</p>
            <p className={cn("text-2xl font-bold mt-1",
              stat.color === 'green' ? 'text-green-600' :
              stat.color === 'blue' ? 'text-blue-600' :
              stat.color === 'purple' ? 'text-purple-600' : 'text-gray-600'
            )}>{stat.value}</p>
          </div>
        ))}
      </div>
      {dockerInfo && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-sm font-semibold text-gray-500 uppercase mb-4">Engine Details</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {[
              ['Version', dockerInfo.server_version],
              ['Operating System', dockerInfo.os],
              ['Architecture', dockerInfo.architecture],
              ['Storage Driver', dockerInfo.storage_driver],
              ['CPUs', dockerInfo.cpu],
              ['Memory', formatBytes(dockerInfo.memory)],
              ['CGroup', 'v' + (dockerInfo.cgroup_version || '--')],
              ['Kernel', dockerInfo.kernel],
            ].map(([label, value]) => (
              <div key={label}>
                <span className="text-gray-500">{label}</span>
                <p className="font-medium text-gray-800 mt-1">{value || '--'}</p>
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
        <button onClick={() => setShowPull(!showPull)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
          <Download size={16} />Pull Image
        </button>
      </div>
      {showPull && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={imageInput}
              onChange={e => setImageInput(e.target.value)}
              placeholder="e.g. nginx:latest, ubuntu:22.04"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
              onKeyDown={e => e.key === 'Enter' && handlePull()}
            />
            <button onClick={handlePull} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">Pull</button>
            <button onClick={() => { setShowPull(false); setImageInput(''); }} className="px-3 py-2 text-gray-400 hover:text-gray-600"><X size={16} /></button>
          </div>
        </div>
      )}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[640px]">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Repository</th>
                <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Tag</th>
                <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Size</th>
                <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Created</th>
                <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Containers</th>
                <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {images.length === 0 ? (
                <tr><td colSpan="6" className="px-6 py-12 text-center text-gray-400 italic">No images found.</td></tr>
              ) : images.map(img => (
                <tr key={img.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-800 text-sm">{(img.tags?.[0]?.split(':')[0]) || img.id.slice(0, 12)}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{(img.tags?.[0]?.split(':')[1]) || 'latest'}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{formatBytes(img.size)}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{new Date(img.created * 1000).toLocaleDateString()}</td>
                  <td className="px-6 py-4">
                    <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", img.containers > 0 ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500")}>
                      {img.containers > 0 ? `${img.containers} using` : 'None'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => onDeleteImage(img.id, (img.tags?.[0]) || img.id.slice(0, 12))} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Delete image"><Trash2 size={16} /></button>
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
  return containers.length === 0 ? (
    <div className="text-center py-16 text-gray-400">
      <ContainerIcon size={48} className="mx-auto mb-4 opacity-30" />
      <p className="text-lg font-medium">No containers</p>
      <p className="text-sm mt-1">Create one to get started</p>
    </div>
  ) : (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left min-w-[720px]">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Name</th>
              <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Image</th>
              <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">IP</th>
              <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase">Ports</th>
              <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {containers.map(c => (
              <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 font-medium text-gray-800">{c.name}</td>
                <td className="px-6 py-4 text-sm text-gray-500">{c.image}</td>
                <td className="px-6 py-4">
                  <span className={cn("px-2 py-1 rounded-full text-xs font-medium", c.state === 'running' ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600")}>{c.state}</span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500 font-mono">{c.ip || '--'}</td>
                <td className="px-6 py-4 text-sm text-gray-500">{c.ports?.join(', ') || '--'}</td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-1">
                    {c.state === 'running' ? (
                      <>
                        <button onClick={() => onAction(c.id, 'stop')} className="p-2 text-orange-600 hover:bg-orange-50 rounded-md" title="Stop"><Square size={16} /></button>
                        <button onClick={() => onAction(c.id, 'restart')} className="p-2 text-blue-600 hover:bg-blue-50 rounded-md" title="Restart"><RotateCw size={16} /></button>
                      </>
                    ) : (
                      <button onClick={() => onAction(c.id, 'start')} className="p-2 text-green-600 hover:bg-green-50 rounded-md" title="Start"><Play size={16} /></button>
                    )}
                    <button onClick={() => onAction(c.id, 'remove')} className="p-2 text-red-600 hover:bg-red-50 rounded-md" title="Remove"><Trash2 size={16} /></button>
                    {c.state === 'running' && (
                      <button onClick={() => navigate(`/terminal?container=${c.id}`)} className="p-2 text-purple-600 hover:bg-purple-50 rounded-md" title="Open Terminal">
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
      alert('Upload failed: ' + (e.response?.data?.error || e.message));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowUpload(!showUpload)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
          <FolderOpen size={16} />Upload Compose
        </button>
      </div>
      {showUpload && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
          <h3 className="font-semibold text-gray-800">Upload docker-compose.yml</h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Project Name</label>
            <input type="text" value={projectName} onChange={e => setProjectName(e.target.value)} placeholder="e.g. nginx, minecraft" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">YAML Content</label>
            <textarea value={composeContent} onChange={e => setComposeContent(e.target.value)} rows={10} placeholder="version: '3'\nservices:\n  nginx:\n    image: nginx:latest" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowUpload(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm">Cancel</button>
            <button onClick={handleUpload} disabled={uploading} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">{uploading ? 'Uploading...' : 'Upload'}</button>
          </div>
        </div>
      )}
      {composeProjects.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <FolderOpen size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">No Compose projects</p>
          <p className="text-sm mt-1">Upload a docker-compose.yml to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {composeProjects.map(proj => (
            <div key={proj.name} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <FolderOpen className="text-blue-600" size={20} />
                </div>
                <div>
                  <p className="font-semibold text-gray-800">{proj.name}</p>
                  <p className="text-xs text-gray-500 font-mono">{proj.path}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => onLogs(proj.name)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="View Logs"><TerminalIcon size={16} /></button>
                <button onClick={() => onStart(proj.name)} className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Start"><Play size={16} /></button>
                <button onClick={() => onRestart(proj.name)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Restart"><RotateCw size={16} /></button>
                <button onClick={() => onStop(proj.name)} className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors" title="Stop"><Square size={16} /></button>
                <button onClick={() => onDelete(proj.name)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete"><Trash2 size={16} /></button>
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
      setError(err.response?.data?.error || 'Failed to load Docker information');
    } finally {
      setLoading(false);
    }
  };

  const handleContainerAction = async (id, action) => {
    try {
      if (action === 'remove') {
        if (!window.confirm('确定要删除此容器吗？')) return;
        await apiClient.delete(`/docker/container/${id}`);
      } else {
        await apiClient.post(`/docker/container/${action}/${id}`);
      }
      fetchData();
    } catch (err) {
      alert('操作失败: ' + (err.response?.data?.error || err.message));
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
              alert('Pull failed: ' + (data.logs?.join('\n') || 'Unknown error'));
            }
          }
        } catch {}
      }, 1000);
    } catch (err) {
      alert('Pull failed: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleDeleteImage = async (imageId, imageTag) => {
    if (!window.confirm(`确定要删除镜像 "${imageTag}" 吗？`)) return;
    try {
      await apiClient.delete(`/docker/image/${encodeURIComponent(imageId)}`);
      fetchData();
    } catch (err) {
      alert('删除失败: ' + (err.response?.data?.error || err.message));
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
      alert('获取日志失败: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleContainerCreate = async () => {
    var _a, _b;
    if (!createForm.name.trim() || !createForm.image.trim()) {
      alert('容器名称和镜像名称不能为空');
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
        alert(`容器 "${res.data.id.slice(0, 12)}" 创建成功${res.data.started ? '，并已自动启动' : ''}`);
        fetchData();
      }
    } catch (err) {
      alert('创建失败: ' + ((_b = (_a = err.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.error) || err.message);
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
        <Loader2 className="animate-spin text-blue-600" size={48} />
        <p className="text-gray-500 font-medium">Loading Docker data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
        {error}
        <button onClick={fetchData} className="ml-4 underline">Retry</button>
      </div>
    );
  }

  const tabs = [
    { id: 'containers', label: 'Containers', icon: ContainerIcon },
    { id: 'images', label: 'Images', icon: HardDrive },
    { id: 'compose', label: 'Compose', icon: FolderOpen },
    { id: 'info', label: 'Info', icon: Info },
  ];

  return (
    <div className="flex gap-6">
      <aside className="w-48 shrink-0">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-2 sticky top-4">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn("w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  activeTab === tab.id ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"
                )}
              >
                <Icon size={18} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-gray-800">{tabs.find(t => t.id === activeTab)?.label}</h1>
          {activeTab === 'containers' && (
            <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
              <Plus size={16} />Create
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-white rounded-t-xl z-10">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2"><Plus size={20} className="text-blue-600" />Create Container</h3>
              <button onClick={() => setShowCreate(false)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Container Name <span className="text-red-500">*</span></label>
                  <input type="text" value={createForm.name} onChange={e => setCreateForm({ ...createForm, name: e.target.value })} placeholder="my-container" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Image <span className="text-red-500">*</span></label>
                  <input type="text" value={createForm.image} onChange={e => setCreateForm({ ...createForm, image: e.target.value })} placeholder="nginx:latest" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Command <span className="text-gray-400 text-xs font-normal">(optional)</span></label>
                <input type="text" value={createForm.command} onChange={e => setCreateForm({ ...createForm, command: e.target.value })} placeholder="/bin/sh -c 'echo hello'" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Environment Variables <span className="text-gray-400 text-xs font-normal">(one per line, KEY=value)</span></label>
                <textarea value={createForm.env} onChange={e => setCreateForm({ ...createForm, env: e.target.value })} rows={3} placeholder="DB_HOST=127.0.0.1\nDB_PORT=3306" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Port Mappings <span className="text-gray-400 text-xs font-normal">(one per line)</span></label>
                <textarea value={createForm.ports} onChange={e => setCreateForm({ ...createForm, ports: e.target.value })} rows={2} placeholder="8080:80\n443:443/tcp" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Volume Mounts <span className="text-gray-400 text-xs font-normal">(one per line, /host:/container[:ro])</span></label>
                <textarea value={createForm.volumes} onChange={e => setCreateForm({ ...createForm, volumes: e.target.value })} rows={2} placeholder="/data/app:/app/data\n/logs:/var/log/app ro" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={createForm.privileged} onChange={e => setCreateForm({ ...createForm, privileged: e.target.checked })} className="w-4 h-4 text-blue-600 rounded border-gray-300" />
                  <span className="text-sm text-gray-700">Privileged</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={createForm.autoStart} onChange={e => setCreateForm({ ...createForm, autoStart: e.target.checked })} className="w-4 h-4 text-blue-600 rounded border-gray-300" />
                  <span className="text-sm text-gray-700">Auto Start</span>
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-gray-100 bg-gray-50 rounded-b-xl">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors">Cancel</button>
              <button onClick={handleContainerCreate} disabled={creating || !createForm.name.trim() || !createForm.image.trim()} className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors">
                {creating ? (<><Loader2 size={16} className="animate-spin" />Creating...</>) : (<><Plus size={16} />Create Container</>)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pull Image Modal */}
      {pulling && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Download className="text-blue-600" size={20} />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800">Pulling Image</h3>
                  <p className="text-xs text-gray-500 font-mono">{pulling.image}</p>
                </div>
              </div>
              <div className="mb-3">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-500">Progress</span>
                  <span className="font-medium text-blue-600">{pulling.progress ?? '—'}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                  <div className="h-full bg-blue-600 rounded-full transition-all duration-500 ease-out" style={{ width: pulling.progress != null ? `${pulling.progress}%` : '75%' }} />
                </div>
              </div>
              <div className="text-center py-2">
                {pulling.status === 'done' ? (
                  <p className="text-green-600 font-medium flex items-center justify-center gap-1"><CheckCircle size={16} /> Complete</p>
                ) : pulling.status === 'failed' ? (
                  <p className="text-red-600 font-medium">Failed</p>
                ) : (
                  <p className="text-gray-400 text-sm flex items-center justify-center gap-2"><Loader2 size={14} className="animate-spin" /> Pulling...</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Compose Logs Modal */}
      {logsModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <h3 className="font-semibold text-gray-800">Logs: {logsModal.name}</h3>
                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">docker compose logs</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => { if(window.confirm('确定要重启此 compose 项目？')) { handleComposeRestart(logsModal.name); } }} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Restart"><RotateCw size={16} /></button>
                <button onClick={() => { if(window.confirm('确定要停止此 compose 项目？')) { handleComposeStop(logsModal.name); setLogsModal(null); } }} className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors" title="Stop"><Square size={16} /></button>
                <button onClick={() => { if(window.confirm('确定要删除此 compose 项目？')) { handleComposeDelete(logsModal.name); } }} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete"><Trash2 size={16} /></button>
                <button onClick={() => setLogsModal(null)} className="ml-2 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"><X size={18} /></button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4 bg-gray-950">
              <pre className="text-xs font-mono text-green-400 whitespace-pre-wrap break-all leading-relaxed">
                {logsModal.logs || <span className="text-gray-500 italic">No logs available</span>}
              </pre>
            </div>
            <div className="px-4 py-3 border-t border-gray-800 flex items-center justify-between text-xs text-gray-500">
              <span>Showing last 200 lines</span>
              <button onClick={() => handleComposeLogs(logsModal.name)} className="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors"><RotateCw size={12} /> Refresh</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DockerView;
