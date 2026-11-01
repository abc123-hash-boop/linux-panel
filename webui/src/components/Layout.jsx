import React from 'react';
import {
  LayoutDashboard,
  Container,
  Files,
  Terminal,
  Bot,
  Globe,
  Settings,
  LogOut,
  Menu,
  List,
  Server,
  Newspaper,
  Network,
} from 'lucide-react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import apiClient from '../api/client';
import { useI18n } from '../i18n';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const NavItem = ({ to, icon: Icon, label, active }) => {
  return (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
        active 
          ? "glass-strong text-white shadow-[0_0_20px_rgba(139,92,246,0.3)]" 
          : "text-white/60 hover:text-white hover:glass"
      )}
    >
      <Icon size={20} className={cn("shrink-0 transition-transform duration-200", active ? "scale-110 text-violet-300" : "group-hover:scale-110 text-white/70 group-hover:text-violet-200")} />
      <span className="font-medium">{label}</span>
    </Link>
  );
};

const Sidebar = ({ isOpen, setIsOpen }) => {
  const location = useLocation();
  const { t } = useI18n();

  return (
    <>
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 glass-dark text-white transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          <div className="h-16 flex items-center px-6 border-b border-white/8 glass-input">
            <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-xl flex items-center justify-center mr-3 shadow-lg shadow-violet-500/30 animate-float-slow">
              <span className="font-bold text-lg text-white">P</span>
            </div>
            <span className="text-xl font-bold tracking-wider bg-gradient-to-r from-white to-violet-200 bg-clip-text text-transparent">PPanel</span>
          </div>

          <nav className="flex-1 px-3 py-5 space-y-2 overflow-y-auto">
            <NavItem to="/" icon={LayoutDashboard} label={t('nav.dashboard', 'Dashboard')} active={location.pathname === '/'} />
            <NavItem to="/docker" icon={Container} label={t('nav.docker', 'Docker')} active={location.pathname === '/docker'} />
            <NavItem to="/files" icon={Files} label={t('nav.files', 'File Manager')} active={location.pathname.startsWith('/files')} />
            <NavItem to="/terminal" icon={Terminal} label={t('nav.terminal', 'Terminal')} active={location.pathname === '/terminal'} />
            <NavItem to="/copilot" icon={Bot} label={t('nav.copilot', 'Copilot')} active={location.pathname === '/copilot'} />
            <NavItem to="/browser" icon={Globe} label={t('nav.browser', 'Browser')} active={location.pathname === '/browser'} />
            <NavItem to="/tasks" icon={List} label={t('nav.tasks', 'Task Manager')} active={location.pathname === '/tasks'} />
            <NavItem to="/services" icon={Server} label={t('nav.services', 'Services')} active={location.pathname === '/services'} />
            <NavItem to="/news" icon={Newspaper} label={t('nav.news', 'News')} active={location.pathname === '/news'} />
            <NavItem to="/sites" icon={Network} label={t('nav.sites', 'Sites')} active={location.pathname === '/sites'} />
            <NavItem to="/settings" icon={Settings} label={t('nav.settings', 'Settings')} active={location.pathname === '/settings'} />
          </nav>

          <div className="p-4 border-t border-white/8">
            <button 
              onClick={async () => {
                try {
                  await apiClient.post('/logout');
                } catch (e) {
                  console.warn('Logout request failed:', e);
                }
                window.location.href = '/login';
              }}
              className="flex items-center gap-3 px-4 py-3 w-full glass-btn text-white/80 hover:text-white rounded-xl transition-all group"
            >
              <LogOut size={20} className="group-hover:rotate-180 transition-transform duration-300" />
              <span className="font-medium">{t('nav.logout', 'Logout')}</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

const Header = ({ setIsOpen }) => {
  const { t } = useI18n();
  return (
    <header className="h-16 glass-strong border-b border-white/10 flex items-center justify-between px-4 lg:px-8 sticky top-0 z-30">
      <div className="flex items-center">
        <button 
          onClick={() => setIsOpen(true)}
          className="p-2 -ml-2 text-white/80 hover:text-white hover:bg-white/10 lg:hidden rounded-lg"
        >
          <Menu size={24} />
        </button>
        <h2 className="ml-2 lg:ml-0 text-lg font-semibold bg-gradient-to-r from-white to-violet-200 bg-clip-text text-transparent">
          {t('header.title', 'Panel Control')}
        </h2>
      </div>
      
      <div className="flex items-center gap-4">
        <div className="hidden sm:flex items-center text-sm text-white/80 glass-input px-4 py-1.5 rounded-full">
          <div className="w-2 h-2 bg-green-400 rounded-full mr-2 shadow-[0_0_8px_rgba(74,222,128,0.6)] animate-pulse" />
          {t('header.online', 'System Online')}
        </div>
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white font-bold shadow-lg shadow-violet-500/30">
          A
        </div>
      </div>
    </header>
  );
};

const Layout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header setIsOpen={setIsSidebarOpen} />
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
