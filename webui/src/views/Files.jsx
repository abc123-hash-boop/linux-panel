import React, { useState, useEffect, useRef, useCallback } from 'react';
import apiClient from '../api/client';
import {
  Folder, File, FolderOpen, ArrowUp, Search, RefreshCw,
  Plus, Trash2, Edit2, Download, MoreVertical, ChevronRight,
  FileText, Image as ImageIcon, Archive, AlertCircle, X, Upload, Save
} from 'lucide-react';

const cn = (...classes) => classes.filter(Boolean).join(' ');

// ─── 工具函数 ───────────────────────────────────────────────
const formatSize = (bytes) => {
  if (!bytes || bytes === 0) return '--';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0, v = Number(bytes);
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return v.toFixed(1) + ' ' + units[i];
};

const getIcon = (file) => {
  if (file.dir) return <FolderOpen className="text-blue-500" size={18} />;
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  const imgExts = ['png','jpg','jpeg','gif','bmp','svg','webp','ico'];
  const codeExts = ['c','cpp','h','hpp','rs','java','rb','php'];
  if (imgExts.includes(ext)) return <ImageIcon className="text-pink-500" size={18} />;
  if (['txt','md','log','csv','json','xml','yaml','yml','html','css','js','jsx','ts','go','py','sh','conf','ini','cfg','env'].includes(ext)) return <FileText className="text-gray-500" size={18} />;
  if (['zip','tar','gz','bz2','xz','rar','7z'].includes(ext)) return <Archive className="text-yellow-600" size={18} />;
  return <File className="text-gray-400" size={18} />;
};

const formatDate = (mtime) => {
  if (!mtime) return '--';
  const d = new Date(mtime * 1000);
  if (isNaN(d.getTime())) return '--';
  return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
};

const isTextFile = (name) => {
  const ext = '.' + (name.split('.').pop() || '').toLowerCase();
  return ['.js','.jsx','.json','.txt','.log','.md','.csv','.html','.htm','.css','.scss','.less',
    '.xml','.yaml','.yml','.ini','.cfg','.conf','.sh','.bash','.py','.go','.rs','.c','.h',
    '.cpp','.hpp','.java','.rb','.php','.sql','.toml','.env'].includes(ext);
};

// ─── 新建 Modal ─────────────────────────────────────────────
const NewItemModal = ({ type, currentPath, onClose, onCreated }) => {
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const submit = async () => {
    const base = currentPath === '/' ? '/' + name : currentPath + '/' + name;
    if (!base || base === '/') { setError('名称不能为空'); return; }
    try {
      setLoading(true);
      if (type === 'folder') {
        await apiClient.post('/file/mkdir', { path: base });
      } else {
        await apiClient.post('/file/create', { path: base });
      }
      onCreated();
    } catch (e) { setError(e.response?.data?.error || e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
            {type === 'folder' ? <Folder size={18} className="text-blue-500" /> : <FileText size={18} className="text-gray-500" />}
            New {type === 'folder' ? 'Folder' : 'File'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="mb-3">
          <label className="block text-xs text-gray-500 mb-1">Name</label>
          <input ref={inputRef} value={name} onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !loading && submit()}
            placeholder={type === 'folder' ? 'my-folder' : 'file.txt'}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        {type === 'file' && (
          <div className="mb-3">
            <label className="block text-xs text-gray-500 mb-1">Content (optional)</label>
            <textarea value={content} onChange={e => setContent(e.target.value)} rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        )}
        {error && <p className="text-red-500 text-xs mb-3">{error}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
          <button onClick={submit} disabled={loading} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">Create</button>
        </div>
      </div>
    </div>
  );
};

// ─── 重命名 Modal ───────────────────────────────────────────
const RenameModal = ({ item, currentPath, onClose, onRenamed }) => {
  const [name, setName] = useState(item?.name || '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); inputRef.current?.select(); }, []);

  const submit = async () => {
    if (!name.trim()) { setError('名称不能为空'); return; }
    const oldPath = currentPath === '/' ? '/' + item.name : currentPath + '/' + item.name;
    const newPath = currentPath === '/' ? '/' + name : currentPath + '/' + name;
    try {
      setLoading(true);
      await apiClient.post('/file/rename', { path: oldPath, newPath });
      onRenamed(name);
    } catch (e) { setError(e.response?.data?.error || e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-800">Rename</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="mb-3">
          <label className="block text-xs text-gray-500 mb-1">New name</label>
          <input ref={inputRef} value={name} onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !loading && submit()}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        {error && <p className="text-red-500 text-xs mb-3">{error}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
          <button onClick={submit} disabled={loading} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">Rename</button>
        </div>
      </div>
    </div>
  );
};

// ─── 删除确认 ───────────────────────────────────────────────
const DeleteConfirmModal = ({ item, currentPath, onClose, onDeleted }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const doDelete = async () => {
    const path = currentPath === '/' ? '/' + item.name : currentPath + '/' + item.name;
    try {
      setLoading(true);
      await apiClient.post('/file/delete', { path });
      onDeleted();
    } catch (e) { setError(e.response?.data?.error || e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center gap-3 mb-4 text-red-600">
          <AlertCircle size={24} />
          <h3 className="font-bold text-gray-800">Delete {item.dir ? 'Folder' : 'File'}</h3>
        </div>
        <p className="text-sm text-gray-600 mb-1">Are you sure you want to delete:</p>
        <p className="text-sm font-mono text-gray-800 mb-4 bg-gray-50 p-2 rounded truncate">
          {currentPath === '/' ? '/' + item.name : currentPath + '/' + item.name}
        </p>
        {item.dir && <p className="text-xs text-orange-600 mb-4">⚠ This will recursively delete all contents.</p>}
        {error && <p className="text-red-500 text-xs mb-3">{error}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
          <button onClick={doDelete} disabled={loading} className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50">Delete</button>
        </div>
      </div>
    </div>
  );
};

// ─── 文件内容查看 Modal ─────────────────────────────────────
const FileViewModal = ({ file, currentPath, onClose, onEdit }) => {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const path = currentPath === '/' ? '/' + file.name : currentPath + '/' + file.name;
    apiClient.get('/file/read', { params: { path } })
      .then(r => setContent(r.data.content || ''))
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, [file, currentPath]);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            {getIcon(file)}
            <h3 className="font-bold text-gray-800">{file.name}</h3>
            <span className="text-xs text-gray-400 font-mono hidden sm:inline">{currentPath === '/' ? '/' + file.name : currentPath + '/' + file.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { onClose(); onEdit && onEdit(); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors">
              <Edit2 size={14} /> Edit
            </button>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4 bg-gray-950">
          {loading ? (
            <p className="text-gray-500 text-sm">Loading...</p>
          ) : error ? (
            <p className="text-red-400 text-sm">{error}</p>
          ) : (
            <pre className="text-xs font-mono text-green-400 whitespace-pre-wrap break-all leading-relaxed">{content}</pre>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── 文件编辑 Modal ─────────────────────────────────────────
const FileEditModal = ({ file, currentPath, onClose, onSave }) => {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const textareaRef = useRef(null);

  useEffect(() => {
    const path = currentPath === '/' ? '/' + file.name : currentPath + '/' + file.name;
    apiClient.get('/file/read', { params: { path } })
      .then(r => { setContent(r.data.content || ''); setTimeout(() => textareaRef.current?.focus(), 100); })
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, [file, currentPath]);

  const handleSave = async () => {
    const path = currentPath === '/' ? '/' + file.name : currentPath + '/' + file.name;
    try {
      setSaving(true);
      await apiClient.post('/file/write', { path, content });
      setSuccess(true);
      setTimeout(() => onSave(), 800);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            {getIcon(file)}
            <h3 className="font-bold text-gray-800">{file.name}</h3>
            <span className="text-xs text-gray-400 font-mono hidden sm:inline">{currentPath === '/' ? '/' + file.name : currentPath + '/' + file.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors">
              {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
          </div>
        </div>
        <div className="flex-1 overflow-auto bg-gray-950">
          {loading ? (
            <p className="text-gray-500 text-sm p-4">Loading...</p>
          ) : error ? (
            <p className="text-red-400 text-sm p-4">{error}</p>
          ) : (
            <textarea ref={textareaRef} value={content} onChange={e => setContent(e.target.value)}
              spellCheck={false}
              className="w-full h-full min-h-[400px] p-4 bg-gray-950 text-green-400 font-mono text-xs resize-none outline-none" />
          )}
        </div>
        {success && (
          <div className="px-4 py-2 bg-green-500/10 border-t border-green-500/20 text-green-400 text-sm">
            ✓ File saved successfully
          </div>
        )}
        {error && success === false && (
          <div className="px-4 py-2 bg-red-500/10 border-t border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── 上传 Modal ─────────────────────────────────────────────
const UploadModal = ({ currentPath, onClose, onUploaded }) => {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  const handleSelect = (e) => {
    setFiles(Array.from(e.target.files));
    setError('');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    setFiles(Array.from(e.dataTransfer.files));
    setError('');
  };

  const doUpload = async () => {
    if (files.length === 0) { setError('请先选择文件'); return; }
    try {
      setUploading(true);
      setProgress(0);
      const formData = new FormData();
      files.forEach(f => formData.append('file', f));
      formData.append('target', currentPath === '/' ? '/' : currentPath);

      const res = await apiClient.post('/file/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: e => setProgress(Math.round((e.loaded * 100) / e.total)),
      });

      onUploaded(res.data.uploaded || []);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
            <Upload size={18} className="text-blue-600" /> Upload Files
          </h3>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Drop Zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={cn(
              "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors",
              dragOver ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"
            )}
          >
            <Upload size={32} className={cn("mx-auto mb-3", dragOver ? "text-blue-500" : "text-gray-400")} />
            <p className="text-sm font-medium text-gray-700">Drop files here or click to browse</p>
            <p className="text-xs text-gray-400 mt-1">Target: {currentPath}</p>
            <input ref={inputRef} type="file" multiple onChange={handleSelect} className="hidden" />
          </div>

          {/* Selected Files */}
          {files.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-gray-500 font-medium">{files.length} file(s) selected</p>
              <div className="max-h-32 overflow-y-auto space-y-0.5">
                {files.map((f, i) => (
                  <p key={i} className="text-xs text-gray-600 font-mono truncate px-2 py-1 bg-gray-50 rounded">{f.name} <span className="text-gray-400">({formatSize(f.size)})</span></p>
                ))}
              </div>
            </div>
          )}

          {/* Progress */}
          {uploading && (
            <div>
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Uploading...</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          {error && <p className="text-red-500 text-xs">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 p-5 border-t border-gray-100 bg-gray-50 rounded-b-xl">
          <button onClick={onClose} disabled={uploading} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50">Cancel</button>
          <button onClick={doUpload} disabled={uploading || files.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
            <Upload size={16} /> {uploading ? 'Uploading...' : `Upload ${files.length} file${files.length > 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── 主视图 ─────────────────────────────────────────────────
const FilesView = () => {
  const [files, setFiles] = useState([]);
  const [currentPath, setCurrentPath] = useState('/');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortAsc, setSortAsc] = useState(true);

  // 操作 Modal 状态
  const [showNew, setShowNew] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [renameTarget, setRenameTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [viewTarget, setViewTarget] = useState(null);
  const [editTarget, setEditTarget] = useState(null);

  const fetchFiles = useCallback(async (path) => {
    try {
      setLoading(true);
      const res = await apiClient.get('/files', { params: { path } });
      const data = res.data || {};
      setFiles(Array.isArray(data.files) ? data.files : []);
      setCurrentPath(data.path || path);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch files:', err);
      setError(err.response?.data?.error || 'Failed to load directory');
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchFiles('/'); }, [fetchFiles]);

  const sortedFiles = React.useMemo(() => {
    let list = [...files];
    if (search) list = list.filter(f => f.name.toLowerCase().includes(search.toLowerCase()));
    list.sort((a, b) => {
      if (a.dir !== b.dir) return a.dir ? -1 : 1;
      let cmp = 0;
      if (sortBy === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortBy === 'size') cmp = (a.size || 0) - (b.size || 0);
      else if (sortBy === 'mtime') cmp = (a.mtime || 0) - (b.mtime || 0);
      return sortAsc ? cmp : -cmp;
    });
    return list;
  }, [files, search, sortBy, sortAsc]);

  const goUp = () => {
    if (currentPath === '/') return;
    const parent = currentPath.substring(0, currentPath.lastIndexOf('/')) || '/';
    fetchFiles(parent);
  };

  const navigate = (name, isDir) => {
    if (!isDir) return;
    const newPath = currentPath === '/' ? '/' + name : currentPath + '/' + name;
    fetchFiles(newPath);
  };

  const handleSort = (col) => {
    if (sortBy === col) setSortAsc(!sortAsc);
    else { setSortBy(col); setSortAsc(true); }
  };

  const breadcrumbs = currentPath === '/'
    ? [{ label: '/', path: '/' }]
    : currentPath.split('/').filter(Boolean).map((part, i, arr) => ({
        label: part, path: '/' + arr.slice(0, i + 1).join('/'),
      }));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">File Manager</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowUpload(true)}
            className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium transition-colors">
            <Upload size={16} /> Upload
          </button>
          <button onClick={() => setShowNew('folder')}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors">
            <Plus size={16} /> New Folder
          </button>
          <button onClick={() => setShowNew('file')}
            className="flex items-center gap-2 px-3 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 text-sm font-medium transition-colors">
            <FileText size={16} /> New File
          </button>
          <button onClick={() => fetchFiles(currentPath)}
            className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors" title="Refresh">
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex-wrap">
        <button onClick={goUp} disabled={currentPath === '/'}
          className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors" title="Parent directory">
          <ArrowUp size={18} />
        </button>

        <div className="flex items-center gap-1 text-sm flex-wrap flex-1 min-w-0">
          {breadcrumbs.map((crumb, i) => (
            <React.Fragment key={crumb.path}>
              {i > 0 && <ChevronRight size={14} className="text-gray-300 shrink-0" />}
              <button onClick={() => fetchFiles(crumb.path)}
                className={cn('px-2 py-1 rounded hover:bg-gray-100 transition-colors shrink-0',
                  i === breadcrumbs.length - 1 ? 'font-semibold text-blue-600' : 'text-gray-600')}>
                {crumb.label}
              </button>
            </React.Fragment>
          ))}
        </div>

        <div className="relative shrink-0">
          <Search size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search..."
            className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 w-40" />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-3">
          <AlertCircle size={18} />
          <span className="text-sm">{error}</span>
          <button onClick={() => fetchFiles(currentPath)} className="ml-auto underline text-sm font-medium">Retry</button>
        </div>
      )}

      {/* File Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none" onClick={() => handleSort('name')}>
                  Name {sortBy === 'name' && (sortAsc ? '↑' : '↓')}
                </th>
                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none" onClick={() => handleSort('size')}>
                  Size {sortBy === 'size' && (sortAsc ? '↑' : '↓')}
                </th>
                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none" onClick={() => handleSort('mtime')}>
                  Modified {sortBy === 'mtime' && (sortAsc ? '↑' : '↓')}
                </th>
                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan="4" className="text-center py-16 text-gray-400">
                  <RefreshCw size={24} className="animate-spin mx-auto mb-2" />Loading...
                </td></tr>
              ) : sortedFiles.length === 0 ? (
                <tr><td colSpan="4" className="text-center py-16 text-gray-400 italic">
                  {search ? 'No matching files.' : 'This directory is empty.'}
                </td></tr>
              ) : sortedFiles.map((file) => (
                <tr key={file.name} className="group hover:bg-blue-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      {getIcon(file)}
                      <span className={cn(
                        "font-medium text-sm cursor-pointer truncate max-w-[280px]",
                        file.dir ? 'text-blue-700' : 'text-gray-800'
                      )}
                        onClick={() => navigate(file.name, file.dir)}
                        onDoubleClick={() => navigate(file.name, file.dir)}
                        title={file.name}
                      >
                        {file.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 font-mono">{file.dir ? '--' : formatSize(file.size)}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{formatDate(file.mtime)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {file.dir ? (
                        <button onClick={() => navigate(file.name, true)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors" title="Open">
                          <FolderOpen size={15} />
                        </button>
                      ) : (
                        <>
                          <button onClick={() => setViewTarget(file)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors" title="View">
                            <FileText size={15} />
                          </button>
                          {isTextFile(file.name) && (
                            <button onClick={() => setEditTarget(file)}
                              className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-md transition-colors" title="Edit">
                              <Edit2 size={15} />
                            </button>
                          )}
                          <button onClick={async () => {
                            try {
                              const path = currentPath === '/' ? '/' + file.name : currentPath + '/' + file.name;
                              const res = await apiClient.get('/file/raw', { params: { path, download: '1' }, responseType: 'blob' });
                              const url = URL.createObjectURL(new Blob([res.data]));
                              const a = document.createElement('a'); a.href = url; a.download = file.name; a.click();
                              URL.revokeObjectURL(url);
                            } catch (e) { alert('Download failed: ' + (e.response?.data?.error || e.message)); }
                          }} className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-md transition-colors" title="Download">
                            <Download size={15} />
                          </button>
                        </>
                      )}
                      <button onClick={() => setRenameTarget(file)}
                        className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-md transition-colors" title="Rename">
                        <Edit2 size={15} />
                      </button>
                      <button onClick={() => setDeleteTarget(file)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors" title="Delete">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {showNew && (
        <NewItemModal type={showNew} currentPath={currentPath} onClose={() => setShowNew(null)}
          onCreated={() => { setShowNew(null); fetchFiles(currentPath); }} />
      )}
      {showUpload && (
        <UploadModal currentPath={currentPath} onClose={() => setShowUpload(false)}
          onUploaded={() => { setShowUpload(false); fetchFiles(currentPath); }} />
      )}
      {renameTarget && (
        <RenameModal item={renameTarget} currentPath={currentPath} onClose={() => setRenameTarget(null)}
          onRenamed={() => { setRenameTarget(null); fetchFiles(currentPath); }} />
      )}
      {deleteTarget && (
        <DeleteConfirmModal item={deleteTarget} currentPath={currentPath} onClose={() => setDeleteTarget(null)}
          onDeleted={() => { setDeleteTarget(null); fetchFiles(currentPath); }} />
      )}
      {viewTarget && !viewTarget.dir && (
        <FileViewModal file={viewTarget} currentPath={currentPath} onClose={() => setViewTarget(null)}
          onEdit={() => { setViewTarget(null); setEditTarget(viewTarget); }} />
      )}
      {editTarget && (
        <FileEditModal file={editTarget} currentPath={currentPath} onClose={() => setEditTarget(null)}
          onSave={() => { setEditTarget(null); fetchFiles(currentPath); }} />
      )}
    </div>
  );
};

export default FilesView;
