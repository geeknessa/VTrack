import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  Home,
  List,
  PieChart,
  CreditCard,
  Plus,
  Utensils,
  PanelLeftClose,
  PanelLeftOpen,
  Settings as SettingsIcon,
} from 'lucide-react';

export const Layout: React.FC = () => {
  const navigate = useNavigate();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem('vtrack_sidebar_collapsed') === 'true';
  });

  const toggleSidebar = () => {
    setIsSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('vtrack_sidebar_collapsed', String(next));
      return next;
    });
  };

  const navItems = [
    { to: '/', icon: Home, label: 'Home' },
    { to: '/menus', icon: Utensils, label: 'Food & Menus' },
    { to: '/activity', icon: List, label: 'Activity' },
    { to: '/insights', icon: PieChart, label: 'Insights' },
    { to: '/subscriptions', icon: CreditCard, label: 'Bills' },
    { to: '/settings', icon: SettingsIcon, label: 'Settings' },
  ];

  return (
    <div
      className={`w-full min-h-screen bg-bg pb-20 md:pb-0 transition-all duration-300 ease-in-out flex flex-col relative ${
        isSidebarCollapsed ? 'md:pl-20' : 'md:pl-64'
      }`}
    >
      {/* Main Content Area */}
      <main className="flex-1 w-full h-full relative overflow-x-hidden overflow-y-auto">
        <Outlet />
      </main>

      {/* Desktop Sidebar */}
      <aside
        className={`hidden md:flex fixed top-0 left-0 bottom-0 bg-surface border-r border-border flex-col transition-all duration-300 ease-in-out z-40 ${
          isSidebarCollapsed ? 'w-20 px-3 py-6' : 'w-64 p-6'
        }`}
      >
        {/* Header with Logo and Collapse Toggle */}
        {isSidebarCollapsed ? (
          <div className="flex flex-col items-center mb-8">
            <button
              type="button"
              onClick={toggleSidebar}
              className="relative group p-1.5 rounded-2xl hover:bg-accent-soft border border-transparent hover:border-accent/20 transition-all btn-tap cursor-pointer"
              title="Click to expand sidebar"
              aria-label="Expand sidebar"
            >
              {/* Logo */}
              <img
                src="/favicon.svg"
                alt="VTrack Logo"
                className="w-9 h-9 object-contain transition-all duration-200 group-hover:opacity-20 group-hover:scale-90"
              />

              {/* PanelLeftOpen icon overlay revealed on hover */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <PanelLeftOpen className="w-5 h-5 text-accent" />
              </div>
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between mb-8">
            <div
              className="flex items-center gap-2.5 cursor-pointer select-none group"
              onClick={() => navigate('/')}
            >
              <img
                src="/favicon.svg"
                alt="VTrack Logo"
                className="w-9 h-9 object-contain drop-shadow-sm group-hover:scale-105 transition-transform shrink-0"
              />
              <div>
                <span className="text-xl font-heading font-black text-text-main leading-none block">
                  VTrack
                </span>
                <span className="text-[10px] font-bold text-accent uppercase tracking-wider block mt-0.5">
                  Student Tracker
                </span>
              </div>
            </div>

            {/* Collapse Icon Button at Top Right of Sidebar */}
            <button
              type="button"
              onClick={toggleSidebar}
              className="p-2 rounded-xl text-text-muted hover:text-text-main hover:bg-bg transition-colors btn-tap"
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
            >
              <PanelLeftClose className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Navigation Items */}
        <nav className="flex-1 space-y-1.5">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              title={isSidebarCollapsed ? item.label : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl transition-colors font-bold text-sm ${
                  isSidebarCollapsed
                    ? 'justify-center p-3'
                    : 'px-3.5 py-3'
                } ${
                  isActive
                    ? 'bg-accent-soft text-accent border border-accent/20'
                    : 'text-text-muted hover:bg-bg hover:text-text-main border border-transparent'
                }`
              }
            >
              <item.icon className="w-5 h-5 shrink-0" strokeWidth={2.5} />
              {!isSidebarCollapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* New Transaction & Footer Links */}
        {!isSidebarCollapsed ? (
          <div className="mt-auto space-y-2">
            <button
              type="button"
              onClick={() => navigate('/add')}
              className="w-full py-3.5 bg-accent text-white font-bold rounded-xl flex items-center justify-center gap-2 btn-tap hover:bg-accent-hover transition-colors text-sm border border-accent shadow-sm"
            >
              <Plus className="w-4 h-4" strokeWidth={3} />
              New Transaction
            </button>

            <div className="pt-1 flex items-center justify-center gap-2.5 text-[10.5px] text-text-muted/70">
              <NavLink to="/privacy" className="hover:text-text-main hover:underline transition-colors">
                Privacy
              </NavLink>
              <span>•</span>
              <NavLink to="/terms" className="hover:text-text-main hover:underline transition-colors">
                Terms
              </NavLink>
            </div>
          </div>
        ) : (
          <div className="mt-auto flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/add')}
              title="New Transaction"
              className="w-12 h-12 bg-accent text-white font-bold rounded-xl flex items-center justify-center btn-tap hover:bg-accent-hover transition-colors border border-accent shadow-sm"
            >
              <Plus className="w-5 h-5" strokeWidth={3} />
            </button>
          </div>
        )}
      </aside>

      {/* Mobile Bottom Tab Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface/95 backdrop-blur-md border-t border-border px-2 py-1.5 pb-[max(0.6rem,env(safe-area-inset-bottom))] flex items-center justify-between z-40 max-w-lg mx-auto shadow-lg">
        {/* Left 2 items: Home & Food */}
        <div className="flex items-center justify-around flex-1 min-w-0">
          <NavLink
            to="/"
            end
            className={({ isActive }) => 
              `flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition-colors ${
                isActive ? 'text-accent font-bold' : 'text-text-muted hover:text-text-main font-semibold'
              }`
            }
          >
            <Home className="w-5 h-5" strokeWidth={2.5} />
            <span className="text-[10px] mt-0.5 text-center leading-tight">Home</span>
          </NavLink>

          <NavLink
            to="/menus"
            className={({ isActive }) => 
              `flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition-colors ${
                isActive ? 'text-accent font-bold' : 'text-text-muted hover:text-text-main font-semibold'
              }`
            }
          >
            <Utensils className="w-5 h-5" strokeWidth={2.5} />
            <span className="text-[10px] mt-0.5 text-center leading-tight">Food</span>
          </NavLink>
        </div>

        {/* Center Floating Action Button */}
        <div className="relative -top-4 px-2 flex-shrink-0">
          <button
            onClick={() => navigate('/add')}
            className="w-12 h-12 bg-accent text-white rounded-full flex items-center justify-center border-4 border-bg btn-tap hover:bg-accent-hover transition-transform hover:scale-105 active:scale-95 shadow-md"
            title="Log new transaction"
            aria-label="Add transaction"
          >
            <Plus className="w-6 h-6" strokeWidth={3} />
          </button>
        </div>

        {/* Right 2 items: Activity & Insights */}
        <div className="flex items-center justify-around flex-1 min-w-0">
          <NavLink
            to="/activity"
            className={({ isActive }) => 
              `flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition-colors ${
                isActive ? 'text-accent font-bold' : 'text-text-muted hover:text-text-main font-semibold'
              }`
            }
          >
            <List className="w-5 h-5" strokeWidth={2.5} />
            <span className="text-[10px] mt-0.5 text-center leading-tight">Activity</span>
          </NavLink>

          <NavLink
            to="/insights"
            className={({ isActive }) => 
              `flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition-colors ${
                isActive ? 'text-accent font-bold' : 'text-text-muted hover:text-text-main font-semibold'
              }`
            }
          >
            <PieChart className="w-5 h-5" strokeWidth={2.5} />
            <span className="text-[10px] mt-0.5 text-center leading-tight">Insights</span>
          </NavLink>
        </div>
      </nav>
    </div>
  );
};
