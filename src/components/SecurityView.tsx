import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { api } from '../services/api.js';
import { Permission, ProtectedResource } from '../types.js';
import {
  Shield,
  Lock,
  Unlock,
  KeyRound,
  FileCode,
  CheckCircle2,
  AlertTriangle,
  Eye,
  EyeOff,
  Plus,
} from 'lucide-react';

export const SecurityView: React.FC = () => {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [resources, setResources] = useState<ProtectedResource[]>([]);
  const [loading, setLoading] = useState(true);

  // Security Code prompt for vault
  const [selectedResource, setSelectedResource] = useState<string | null>(null);
  const [securityCodeInput, setSecurityCodeInput] = useState('18');
  const [unlockedContents, setUnlockedContents] = useState<{ [id: string]: string }>({});
  const [unlockError, setUnlockError] = useState<string | null>(null);

  // Security Code modification
  const [currentCode, setCurrentCode] = useState('');
  const [newCode, setNewCode] = useState('');
  const [codeChangeSuccess, setCodeChangeSuccess] = useState<string | null>(null);
  const [codeChangeError, setCodeChangeError] = useState<string | null>(null);

  const fetchSecurityData = async () => {
    try {
      const [pData, rData] = await Promise.all([
        api.getPermissions(),
        api.getProtectedResources(),
      ]);
      setPermissions(pData);
      setResources(rData);
    } catch (err) {
      console.error('Failed to load security data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSecurityData();
  }, []);

  const togglePermission = async (perm: Permission) => {
    try {
      const updated = await api.updatePermission(perm.id, { granted: !perm.granted });
      setPermissions(permissions.map((p) => (p.id === perm.id ? updated : p)));
    } catch (err) {
      console.error('Failed to update permission:', err);
    }
  };

  const handleUnlockResource = async (resourceId: string) => {
    setUnlockError(null);
    try {
      const res = await api.unlockProtectedResource(resourceId, securityCodeInput);
      setUnlockedContents((prev) => ({
        ...prev,
        [resourceId]: res.data?.content || 'Resource content unlocked successfully.',
      }));
      setSelectedResource(null);
    } catch (err: any) {
      setUnlockError(err.message || 'Security verification failed.');
    }
  };

  const handleUpdateSecurityCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setCodeChangeSuccess(null);
    setCodeChangeError(null);
    try {
      const res = await api.updateSecurityCode(currentCode, newCode);
      setCodeChangeSuccess(res.message);
      setCurrentCode('');
      setNewCode('');
    } catch (err: any) {
      setCodeChangeError(err.message || 'Failed to update security code');
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 w-full animate-in fade-in duration-300 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Security & Protected Vault</h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Multi-tier Permissions, Protected Files & Verification Code Management
              </p>
            </div>
          </div>
        </div>

        <div className="text-xs font-mono text-cyan-400 bg-cyan-950/60 border border-cyan-800/40 px-3 py-1.5 rounded-xl">
          Account: {user?.name}
        </div>
      </div>

      {/* Security Code 18 Architecture Section */}
      <div className="sr-glass-card rounded-2xl p-6 border border-white/[0.08]">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400">
              <KeyRound className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Security Verification Protocol</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Default verification code is <span className="font-mono text-cyan-300 font-bold">18</span>.
                Verification material is securely salted and hashed server-side (never exposed in bundles or plain logs).
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleUpdateSecurityCode} className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            type="password"
            value={currentCode}
            onChange={(e) => setCurrentCode(e.target.value)}
            placeholder="Current Code (e.g. 18)"
            className="px-3.5 py-2 rounded-xl border border-white/10 bg-slate-900/60 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            required
          />
          <input
            type="password"
            value={newCode}
            onChange={(e) => setNewCode(e.target.value)}
            placeholder="New Security Code"
            className="px-3.5 py-2 rounded-xl border border-white/10 bg-slate-900/60 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            required
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/10 text-xs font-semibold text-white transition-all"
          >
            Update Security Code
          </button>
        </form>

        {codeChangeSuccess && (
          <div className="mt-3 text-xs text-emerald-400 flex items-center gap-1.5 font-mono">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>{codeChangeSuccess}</span>
          </div>
        )}
        {codeChangeError && (
          <div className="mt-3 text-xs text-rose-400 flex items-center gap-1.5 font-mono">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>{codeChangeError}</span>
          </div>
        )}
      </div>

      {/* Protected Resources Vault */}
      <div className="sr-glass-card rounded-2xl p-6 border border-white/[0.08]">
        <div className="flex items-center justify-between pb-4 border-b border-white/[0.05]">
          <div className="flex items-center gap-2.5">
            <Lock className="h-5 w-5 text-rose-400" />
            <div>
              <h2 className="text-base font-semibold text-white">Protected & Secret Vault</h2>
              <p className="text-xs text-slate-400">
                Requires explicit verification code. Never scanned in background or logged.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {resources.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400">No protected resources found.</div>
          ) : (
            resources.map((res) => {
              const isUnlocked = !!unlockedContents[res.id];
              return (
                <div
                  key={res.id}
                  className="p-4 rounded-xl border border-white/[0.07] bg-slate-950/40 hover:border-cyan-500/30 transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-slate-900 border border-white/10 text-slate-300">
                        <FileCode className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-white">{res.title}</div>
                        <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                          Type: {res.resourceType} • Security Tier: {res.securityLevel}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isUnlocked ? (
                        <button
                          onClick={() => {
                            const copy = { ...unlockedContents };
                            delete copy[res.id];
                            setUnlockedContents(copy);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-xs text-slate-300 hover:text-white"
                        >
                          <EyeOff className="h-3.5 w-3.5" />
                          <span>Lock Vault Item</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => setSelectedResource(res.id)}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/40 text-rose-300 text-xs font-semibold transition-all"
                        >
                          <Unlock className="h-3.5 w-3.5" />
                          <span>Decrypt with Code (18)</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Unlock Input Popup if this item is selected */}
                  {selectedResource === res.id && (
                    <div className="mt-3 p-3 rounded-xl border border-rose-500/30 bg-rose-950/20 animate-in fade-in">
                      <div className="text-xs text-rose-300 font-mono mb-2">
                        Enter Security Verification Code:
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="password"
                          value={securityCodeInput}
                          onChange={(e) => setSecurityCodeInput(e.target.value)}
                          placeholder="Security Code (Default: 18)"
                          className="px-3 py-1.5 rounded-lg border border-white/15 bg-black/60 text-xs text-white font-mono focus:outline-none focus:border-rose-400"
                        />
                        <button
                          onClick={() => handleUnlockResource(res.id)}
                          className="px-3.5 py-1.5 rounded-lg bg-rose-500 text-white text-xs font-semibold hover:bg-rose-600 transition-all"
                        >
                          Verify & Decrypt
                        </button>
                        <button
                          onClick={() => setSelectedResource(null)}
                          className="px-2.5 py-1.5 text-xs text-slate-400 hover:text-white"
                        >
                          Cancel
                        </button>
                      </div>
                      {unlockError && (
                        <div className="mt-2 text-xs text-rose-400 font-mono">
                          Error: {unlockError}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Unlocked Payload */}
                  {isUnlocked && (
                    <div className="mt-3 p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-950/20 text-xs font-mono text-emerald-200 animate-in fade-in">
                      <div className="font-semibold text-emerald-400 mb-1">DECRYPTED VAULT PAYLOAD:</div>
                      <div className="whitespace-pre-wrap">{unlockedContents[res.id]}</div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Permissions Matrix */}
      <div className="sr-glass-card rounded-2xl p-6 border border-white/[0.08]">
        <div className="pb-4 border-b border-white/[0.05]">
          <h2 className="text-base font-semibold text-white">Action Permission Governance</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Strict risk-tiered permission enforcement executed at backend/database layer.
          </p>
        </div>

        <div className="mt-4 space-y-3">
          {permissions.map((perm) => (
            <div
              key={perm.id}
              className="p-3.5 rounded-xl border border-white/[0.07] bg-slate-950/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white">{perm.name}</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider ${
                      perm.category === 'low'
                        ? 'bg-slate-800 text-slate-300'
                        : perm.category === 'medium'
                        ? 'bg-amber-950/60 text-amber-300 border border-amber-800/40'
                        : 'bg-rose-950/60 text-rose-300 border border-rose-800/40'
                    }`}
                  >
                    {perm.category} Risk
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{perm.description}</p>
                <div className="flex items-center gap-3 mt-1 text-[10px] font-mono text-slate-400">
                  <span>Scope: {perm.scope}</span>
                  {perm.requiresConfirmation && <span>• Requires Confirmation</span>}
                  {perm.requiresSecurityCode && <span>• Requires Security Code</span>}
                </div>
              </div>

              <button
                onClick={() => togglePermission(perm)}
                className={`self-start sm:self-center px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                  perm.granted
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                    : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:bg-slate-700'
                }`}
              >
                {perm.granted ? 'Granted' : 'Revoked'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
