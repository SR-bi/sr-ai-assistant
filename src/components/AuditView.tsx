import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { api } from '../services/api.js';
import { AuditLog } from '../types.js';
import {
  FileText,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Shield,
  Download,
  Terminal,
} from 'lucide-react';

export const AuditView: React.FC = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await api.getAuditLogs();
      setLogs(data);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const exportLogs = () => {
    const jsonStr = JSON.stringify(logs, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sr_audit_log_${user?.name.replace(/\s+/g, '_')}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getStatusBadge = (status: AuditLog['status']) => {
    switch (status) {
      case 'SUCCESS':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800 text-[10px] font-mono text-emerald-300">
            <CheckCircle2 className="h-3 w-3" />
            <span>SUCCESS</span>
          </span>
        );
      case 'BLOCKED':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-rose-950/60 border border-rose-800 text-[10px] font-mono text-rose-300">
            <Shield className="h-3 w-3" />
            <span>BLOCKED</span>
          </span>
        );
      case 'NEEDS_NATIVE_UNLOCK':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-950/60 border border-amber-800 text-[10px] font-mono text-amber-300">
            <AlertTriangle className="h-3 w-3" />
            <span>LOCKED (NATIVE)</span>
          </span>
        );
      case 'NEEDS_CONFIRMATION':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-800 text-[10px] font-mono text-cyan-300">
            <span>CONFIRM REQ</span>
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] font-mono text-slate-400">
            <span>{status}</span>
          </span>
        );
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 w-full animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Security Audit History</h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Tamper-resistant execution log strictly isolated to <span className="text-cyan-400 font-mono">{user?.name}</span>
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchLogs}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 hover:bg-white/5 text-xs text-slate-300 transition-all"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Refresh</span>
          </button>
          <button
            onClick={exportLogs}
            disabled={logs.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/10 text-xs font-semibold text-white transition-all disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export JSON</span>
          </button>
        </div>
      </div>

      {/* Privacy guarantee banner (Section 23 & 24) */}
      <div className="mt-4 p-3.5 rounded-xl bg-slate-900/40 border border-cyan-500/20 text-xs text-slate-300 flex items-center gap-2.5">
        <Shield className="h-4 w-4 text-cyan-400 shrink-0" />
        <span>
          Privacy Enforcement: Passwords, raw security codes, and confidential document contents are never written to audit records.
        </span>
      </div>

      {/* Log Feed */}
      <div className="mt-6 space-y-2.5">
        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400 font-mono">
            Loading tamper-resistant audit records...
          </div>
        ) : logs.length === 0 ? (
          <div className="py-12 text-center sr-glass-card rounded-2xl p-8">
            <Terminal className="h-10 w-10 text-slate-600 mx-auto mb-3" />
            <div className="text-sm font-medium text-slate-300">No Action History Recorded Yet</div>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Every voice command, memory save, reminder, or device action is audited in real time.
            </p>
          </div>
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              className="p-3.5 rounded-xl border border-white/[0.07] bg-slate-950/40 hover:border-cyan-500/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5">{getStatusBadge(log.status)}</div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white font-mono">{log.actionType}</span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      Scope: {log.permissionContext}
                    </span>
                    {log.deviceId && (
                      <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 px-1.5 py-0.2 rounded border border-cyan-800/40">
                        {log.deviceId}
                      </span>
                    )}
                  </div>
                  <p className="text-slate-300 mt-0.5 leading-relaxed">{log.details}</p>
                </div>
              </div>

              <div className="text-[11px] font-mono text-slate-500 shrink-0 self-end sm:self-center">
                {new Date(log.timestamp).toLocaleString()}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
