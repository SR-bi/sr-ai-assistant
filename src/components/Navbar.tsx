import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { NotificationsPopover } from './NotificationsPopover.js';
import {
  Mic,
  Brain,
  Bell,
  Laptop,
  Layers,
  Shield,
  FileText,
  CheckCircle2,
  User as UserIcon,
  LogOut,
  Repeat,
  Menu,
  X,
  Radio,
} from 'lucide-react';

interface NavbarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  onOpenAuthModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, onSelectTab, onOpenAuthModal }) => {
  const { user, profile, logout, quickSwitchUser } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [unreadNotifsCount, setUnreadNotifsCount] = useState(0);

  const navItems = [
    { id: 'assistant', label: 'Assistant', icon: Mic },
    { id: 'memory', label: 'Memory', icon: Brain },
    { id: 'reminders', label: 'Reminders', icon: Bell },
    { id: 'devices', label: 'Devices', icon: Laptop },
    { id: 'integrations', label: 'Integrations', icon: Layers },
    { id: 'security', label: 'Security & Vault', icon: Shield },
    { id: 'privacy', label: 'Privacy Control', icon: Shield },
    { id: 'audit', label: 'Audit Logs', icon: FileText },
    { id: 'tests', label: 'Test Suite', icon: CheckCircle2, badge: '25 Tests' },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/[0.07] bg-[#080a0f]/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 h-16">
        {/* Brand Logo & Title */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => onSelectTab('assistant')}
            className="flex items-center gap-2.5 group text-left focus:outline-none"
          >
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-slate-800 to-slate-950 border border-teal-500/30 shadow-[0_0_15px_rgba(20,184,166,0.15)] group-hover:border-teal-400/60 transition-all">
              <span className="text-base font-bold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-white via-teal-100 to-teal-300 font-mono">
                SR
              </span>
              <div className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-[#080a0f]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold tracking-wide text-white group-hover:text-teal-200 transition-colors">
                  SR
                </span>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-teal-950/70 border border-teal-800/40 text-teal-300">
                  Assistant
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono hidden sm:block">
                Personal AI Operating Layer
              </p>
            </div>
          </button>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden xl:flex items-center gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  active
                    ? 'bg-white/[0.08] text-teal-300 border border-teal-500/30 shadow-[0_0_12px_rgba(20,184,166,0.1)]'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]'
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${active ? 'text-teal-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
                {item.badge && (
                  <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-violet-950 border border-violet-800 text-violet-300">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Right Controls: Notifications & User Account */}
        <div className="flex items-center gap-3">
          {/* Notifications Bell */}
          <div className="relative">
            <button
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              className="relative p-2 rounded-xl border border-white/10 bg-slate-900/60 hover:bg-slate-800/80 text-slate-300 hover:text-white transition-all"
              title="System Notifications"
            >
              <Bell className="h-4 w-4" />
              {unreadNotifsCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-teal-500 text-[10px] font-bold text-slate-950 ring-2 ring-[#080a0f]">
                  {unreadNotifsCount}
                </span>
              )}
            </button>

            <NotificationsPopover
              isOpen={notificationsOpen}
              onClose={() => setNotificationsOpen(false)}
              onCountChange={setUnreadNotifsCount}
            />
          </div>

          {/* User Account & Quick Switcher */}
          {user ? (
            <div className="relative">
              <button
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl border border-white/10 bg-slate-900/60 hover:bg-slate-800/80 transition-all text-left"
              >
                <div className="h-6 w-6 rounded-full bg-teal-500/20 border border-teal-400/40 flex items-center justify-center text-teal-300 text-xs font-semibold">
                  {user.name.charAt(0)}
                </div>
                <div className="hidden sm:block text-left">
                  <div className="text-xs font-medium text-slate-200 truncate max-w-[120px]">
                    {user.name}
                  </div>
                  <div className="text-[10px] text-teal-400/80 font-mono">
                    {user.email.includes('alex') ? 'User A' : user.email.includes('sarah') ? 'User B' : 'User'}
                  </div>
                </div>
              </button>

              {/* User Dropdown */}
              {userDropdownOpen && (
                <div className="absolute right-0 mt-2 w-72 rounded-xl border border-white/10 bg-[#0d1017] p-2 shadow-2xl backdrop-blur-2xl z-50 animate-in fade-in zoom-in-95">
                  <div className="p-2 border-b border-white/[0.07] mb-1">
                    <div className="text-xs font-semibold text-white">{user.name}</div>
                    <div className="text-[11px] text-slate-400 truncate font-mono">{user.email}</div>
                    <div className="mt-1 flex items-center gap-1.5 text-[10px] text-teal-400 font-mono">
                      <Shield className="h-3 w-3" />
                      <span>Security Code: Configured (18)</span>
                    </div>
                  </div>

                  {/* Personalization & Wake Phrase info */}
                  <div className="p-2 border-b border-white/[0.07] bg-slate-950/40 rounded-lg my-1">
                    <div className="flex items-center justify-between text-xs text-slate-300 font-medium">
                      <span className="flex items-center gap-1.5">
                        <Radio className="h-3.5 w-3.5 text-teal-400" />
                        <span>Wake Phrase ("Hey SR")</span>
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-white/10">
                        Standby Ready
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Continuous listening disabled by default. Push-to-talk mic remains active.
                    </p>
                  </div>

                  <div className="py-1">
                    <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400 px-2 py-1">
                      Quick Switch Accounts
                    </div>
                    <button
                      onClick={async () => {
                        await quickSwitchUser('userA');
                        setUserDropdownOpen(false);
                      }}
                      className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-white/[0.06] hover:text-white"
                    >
                      <div className="flex items-center gap-2">
                        <Repeat className="h-3.5 w-3.5 text-teal-400" />
                        <span>Alex Mercer</span>
                      </div>
                      <span className="text-[10px] font-mono text-teal-400 bg-teal-950/60 px-1.5 py-0.5 rounded border border-teal-800/40">
                        User A
                      </span>
                    </button>

                    <button
                      onClick={async () => {
                        await quickSwitchUser('userB');
                        setUserDropdownOpen(false);
                      }}
                      className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-white/[0.06] hover:text-white"
                    >
                      <div className="flex items-center gap-2">
                        <Repeat className="h-3.5 w-3.5 text-violet-400" />
                        <span>Sarah Connor</span>
                      </div>
                      <span className="text-[10px] font-mono text-violet-400 bg-violet-950/60 px-1.5 py-0.5 rounded border border-violet-800/40">
                        User B
                      </span>
                    </button>
                  </div>

                  <div className="border-t border-white/[0.07] pt-1 mt-1">
                    <button
                      onClick={() => {
                        setUserDropdownOpen(false);
                        onSelectTab('privacy');
                      }}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-white/[0.06]"
                    >
                      <Shield className="h-3.5 w-3.5 text-slate-400" />
                      <span>Privacy Transparency Dashboard</span>
                    </button>

                    <button
                      onClick={() => {
                        setUserDropdownOpen(false);
                        onOpenAuthModal();
                      }}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-white/[0.06]"
                    >
                      <UserIcon className="h-3.5 w-3.5 text-slate-400" />
                      <span>Switch / Create Account</span>
                    </button>

                    <button
                      onClick={async () => {
                        await logout();
                        setUserDropdownOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-rose-400 hover:bg-rose-950/30"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={onOpenAuthModal}
              className="px-3.5 py-1.5 rounded-xl border border-teal-500/30 bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 text-xs font-medium transition-all"
            >
              Sign In
            </button>
          )}

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="xl:hidden p-2 rounded-lg border border-white/10 text-slate-400 hover:text-white"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="xl:hidden border-t border-white/[0.07] bg-[#080a0f]/95 p-4 backdrop-blur-xl">
          <div className="grid grid-cols-2 gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onSelectTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`flex items-center gap-2.5 p-2.5 rounded-xl text-xs font-medium transition-all ${
                    active
                      ? 'bg-teal-500/15 text-teal-300 border border-teal-500/40'
                      : 'bg-slate-900/50 text-slate-300 border border-white/5'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${active ? 'text-teal-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
};
