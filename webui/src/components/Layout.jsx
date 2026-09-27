import React from 'react';
import { 
  LayoutDashboard, 
  Container, 
  Files, 
  Terminal, 
  Settings, 
  LogOut, 
  Menu
} from 'lucide-react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import apiClient from '../api/client';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const NavItem = ({ to, icon: Icon, label, active }) => {
  return (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
        active 
          ? "bg-blue-600 text-white" 
          : "text-gray-400 hover:bg-gray-800 hover:text-white"
      )}
    >
      <Icon size={20} />
      <span className="font-medium">{label}</span>
    </Link>
  );
};

const Sidebar = ({ isOpen, setIsOpen }) => {
  const location = useLocation();

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-gray-900 text-white transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="h-16 flex items-center px-6 border-b border-gray-800">
            <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center mr-3">
              <span className="font-bold text-xl">P</span>
            </div>
            <span className="text-xl font-bold tracking-wider">PPanel</span>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
            <NavItem 
              to="/" 
              icon={LayoutDashboard} 
              label="Dashboard" 
              active={location.pathname === '/'} 
            />
            <NavItem 
              to="/docker" 
              icon={Container} 
              label="Docker" 
              active={location.pathname === '/docker'} 
            />
            <NavItem 
              to="/files" 
              icon={Files} 
              label="File Manager" 
              active={location.pathname.startsWith('/files')} 
            />
            <NavItem 
              to="/terminal" 
              icon={Terminal} 
              label="Terminal" 
              active={location.pathname === '/terminal'} 
            />
            <NavItem 
              to="/settings" 
              icon={Settings} 
              label="Settings" 
              active={location.pathname === '/settings'} 
            />
          </nav>

          {/* User/Logout */}
          <div className="p-4 border-t border-gray-800">
            <button 
              onClick={async () => {
                try {
                  await apiClient.post('/logout');
                } catch (e) {
                  // 即使请求失败也继续退出（如网络问题）
                  console.warn('Logout request failed, proceeding anyway:', e);
                }
                window.location.href = '/login';
              }}
              className="flex items-center gap-3 px-4 py-3 w-full text-gray-400 hover:bg-red-900/20 hover:text-red-400 rounded-lg transition-colors"
            >
              <LogOut size={20} />
              <span className="font-medium">Logout</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

const Header = ({ setIsOpen }) => {
  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-8 sticky top-0 z-30">
      <div className="flex items-center">
        <button 
          onClick={() => setIsOpen(true)}
          className="p-2 -ml-2 text-gray-600 lg:hidden hover:bg-gray-100 rounded-md"
        >
          <Menu size={24} />
        </button>
        <h2 className="ml-2 lg:ml-0 text-lg font-semibold text-gray-800">
          Panel Control
        </h2>
      </div>
      
      <div className="flex items-center gap-4">
        <div className="hidden sm:flex items-center text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
          <div className="w-2 h-2 bg-green-500 rounded-full mr-2" />
          System Online
        </div>
        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
          A
        </div>
      </div>
    </header>
  );
};

const Layout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header setIsOpen={setIsSidebarOpen} />
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          <div className="max-w-7xl mx-auto">
            {/* Outlet 渲染当前匹配的路由组件 */}
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
