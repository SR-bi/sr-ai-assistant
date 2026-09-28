import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { api } from '../services/api.js';
import {
  Shield,
  Key,
  Laptop,
  Layers,
  Brain,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Lock,
  LogOut,
  RefreshCw,
} from 'lucide-react';

export const PrivacyView: React.FC = () => {
  const { user } = useAuth();
  const [overview, setOverview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchPrivacyData = async () => {
    setLoading(true);
    try {
      const data = await api.getPrivacyOverview();
      setOverview(data);
    } catch (err) {
      console.error('Failed to load privacy overview:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrivacyData();
  }, []);

  const handleRevokeOtherSessions = async () => {
    setRevoking(true);
    setSuccessMsg(null);
    try {
      await api.revokeOtherSessions();
      setSuccessMsg('All other active sessions have been successfully revoked.');
      fetchPrivacyData();
    } catch (err: any) {
      console.error('Failed to revoke sessions:', err);
    } finally {
      setRevoking(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 w-full animate-in fade-in duration-300 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Privacy & Transparency Control</h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Complete data governance, session management, and access sovereignty for <span className="text-cyan-400 font-mono">{user?.name}</span>
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={fetchPrivacyData}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 hover:bg-white/5 text-xs text-slate-300 transition-all self-start sm:self-center"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Refresh Audit</span>
        </button>
      </div>

      {successMsg && (
        <div className="p-3.5 rounded-xl border border-emerald-500/40 bg-emerald-950/20 text-xs text-emerald-300 flex items-center gap-2 font-mono">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Metrics Grid */}
      {overview && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-3.5 rounded-xl border border-white/10 bg-slate-900/50">
            <div className="text-[10px] font-mono text-slate-400 uppercase">Saved Memories</div>
            <div className="text-xl font-bold text-white mt-1">{overview.metrics.memoriesCount}</div>
          </div>
          <div className="p-3.5 rounded-xl border border-white/10 bg-slate-900/50">
            <div className="text-[10px] font-mono text-slate-400 uppercase">Connected Devices</div>
            <div className="text-xl font-bold text-cyan-400 mt-1">{overview.metrics.devicesCount}</div>
          </div>
          <div className="p-3.5 rounded-xl border border-white/10 bg-slate-900/50">
            <div className="text-[10px] font-mono text-slate-400 uppercase">Integrations</div>
            <div className="text-xl font-bold text-indigo-400 mt-1">{overview.metrics.integrationsCount}</div>
          </div>
          <div className="p-3.5 rounded-xl border border-white/10 bg-slate-900/50">
            <div className="text-[10px] font-mono text-slate-400 uppercase">Permissions</div>
            <div className="text-xl font-bold text-emerald-400 mt-1">{overview.metrics.permissionsCount}</div>
          </div>
          <div className="p-3.5 rounded-xl border border-white/10 bg-slate-900/50">
            <div className="text-[10px] font-mono text-slate-400 uppercase">Protected Vault Items</div>
            <div className="text-xl font-bold text-rose-400 mt-1">{overview.metrics.protectedResourcesCount}</div>
          </div>
          <div className="p-3.5 rounded-xl border border-white/10 bg-slate-900/50">
            <div className="text-[10px] font-mono text-slate-400 uppercase">Action Logs</div>
            <div className="text-xl font-bold text-slate-300 mt-1">{overview.metrics.auditLogsCount}</div>
          </div>
        </div>
      )}

      {/* Active Sessions Management */}
      <div className="sr-glass-card rounded-2xl p-6 border border-white/[0.08]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.05]">
          <div>
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4 text-cyan-400" />
              <h2 className="text-base font-semibold text-white">Active Cryptographic Sessions</h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Every sign-in generates a unique salted session token stored in memory/DB.
            </p>
          </div>

          <button
            onClick={handleRevokeOtherSessions}
            disabled={revoking}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-semibold transition-all disabled:opacity-50"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Revoke All Other Sessions</span>
          </button>
        </div>

        <div className="mt-4 space-y-2.5">
          {loading ? (
            <div className="text-xs text-slate-400 font-mono py-4 text-center">Loading sessions...</div>
          ) : overview?.sessions?.length === 0 ? (
            <div className="text-xs text-slate-400 py-4 text-center">No active sessions.</div>
          ) : (
            overview?.sessions?.map((s: any, idx: number) => (
              <div
                key={idx}
                className="p-3 rounded-xl border border-white/[0.07] bg-slate-950/40 flex items-center justify-between text-xs font-mono"
              >
                <div className="flex items-center gap-2.5">
                  <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-slate-200">{s.tokenPreview}</span>
                  {s.isCurrent && (
                    <span className="px-1.5 py-0.5 rounded bg-cyan-950/70 border border-cyan-800 text-[10px] text-cyan-300">
                      CURRENT SESSION
                    </span>
                  )}
                </div>
                <span className="text-slate-500 text-[11px]">
                  Expires: {new Date(s.expiresAt).toLocaleDateString()}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Strict Privacy Guarantees */}
      <div className="sr-glass-card rounded-2xl p-6 border border-white/[0.08] space-y-3">
        <h2 className="text-base font-semibold text-white">Cryptographic Privacy Guarantees</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-300">
          <div className="p-3.5 rounded-xl bg-slate-950/40 border border-white/5 space-y-1">
            <div className="font-semibold text-white">Zero Cross-Tenant Leakage</div>
            <p className="text-slate-400 leading-relaxed">
              Every database query and tool execution is scoped strictly to your authenticated session ID.
              User B cannot read your memory vault, devices, or audit trail under any circumstance.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/40 border border-white/5 space-y-1">
            <div className="font-semibold text-white">No Secret Logging</div>
            <p className="text-slate-400 leading-relaxed">
              Passwords, security codes (Code 18), API credentials, and private confidential document contents
              are never recorded into plain audit logs or exposed in client bundles.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
