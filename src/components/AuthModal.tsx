import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { X, Lock, Mail, User, KeyRound, Shield, Repeat } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { login, register, quickSwitchUser } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [securityCode, setSecurityCode] = useState('18');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isRegister) {
        await register(email, password, name, securityCode);
      } else {
        await login(email, password);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickSwitch = async (preset: 'userA' | 'userB') => {
    setError(null);
    setLoading(true);
    try {
      await quickSwitchUser(preset);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Quick switch failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-lg">
      <div className="w-full max-w-md sr-glass-card rounded-2xl p-6 border border-white/10 shadow-2xl animate-in zoom-in-95">
        <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold tracking-wider text-cyan-400 font-mono">SR</span>
            <span className="text-white font-semibold text-sm">
              {isRegister ? 'Create Independent Account' : 'Account Sign In'}
            </span>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Quick Switch Test Accounts */}
        <div className="my-4 p-3 rounded-xl bg-slate-900/60 border border-white/10">
          <div className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Repeat className="h-3 w-3" />
            <span>Instant User Isolation Test Accounts</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleQuickSwitch('userA')}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-white/10 text-left transition-all"
            >
              <div className="text-xs font-semibold text-white">Alex Mercer</div>
              <div className="text-[10px] text-cyan-400 font-mono">User A (Primary Owner)</div>
            </button>

            <button
              type="button"
              onClick={() => handleQuickSwitch('userB')}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-white/10 text-left transition-all"
            >
              <div className="text-xs font-semibold text-white">Sarah Connor</div>
              <div className="text-[10px] text-indigo-400 font-mono">User B (Isolated Vault)</div>
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl border border-rose-500/30 bg-rose-950/20 text-xs text-rose-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {isRegister && (
            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-white/10 bg-slate-900 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-mono text-slate-300 mb-1">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-white/10 bg-slate-900 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-300 mb-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-white/10 bg-slate-900 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                required
              />
            </div>
          </div>

          {isRegister && (
            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1">
                Security Verification Code (Default: 18)
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <input
                  type="password"
                  value={securityCode}
                  onChange={(e) => setSecurityCode(e.target.value)}
                  placeholder="18"
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-white/10 bg-slate-900 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-all shadow-[0_0_15px_rgba(56,189,248,0.25)] disabled:opacity-50"
          >
            {loading ? 'Processing...' : isRegister ? 'Create Isolated Account' : 'Sign In'}
          </button>
        </form>

        <div className="mt-4 pt-3 border-t border-white/[0.08] text-center">
          <button
            onClick={() => setIsRegister(!isRegister)}
            className="text-xs text-cyan-400 hover:underline"
          >
            {isRegister
              ? 'Already have an account? Sign In'
              : 'Need a new account? Register here'}
          </button>
        </div>
      </div>
    </div>
  );
};
