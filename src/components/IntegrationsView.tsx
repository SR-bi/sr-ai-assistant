import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { api } from '../services/api.js';
import { Integration, ActionResult } from '../types.js';
import {
  Layers,
  MessageSquare,
  Video,
  Globe,
  Lock,
  Unlock,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Play,
} from 'lucide-react';

export const IntegrationsView: React.FC = () => {
  const { user } = useAuth();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionResult, setActionResult] = useState<ActionResult | null>(null);

  const fetchIntegrations = async () => {
    try {
      const data = await api.getIntegrations();
      setIntegrations(data);
    } catch (err) {
      console.error('Failed to load integrations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIntegrations();
  }, []);

  const toggleWhatsAppLock = async (integration: Integration) => {
    try {
      const updated = await api.updateIntegration(integration.id, {
        isLocked: !integration.isLocked,
      });
      setIntegrations(integrations.map((i) => (i.id === integration.id ? updated : i)));
    } catch (err) {
      console.error('Failed to toggle lock:', err);
    }
  };

  const testWhatsAppSend = async () => {
    try {
      const res = await api.interact('Send WhatsApp message to team lead');
      setActionResult(res.actionResult || {
        success: false,
        status: res.needsConfirmation ? 'NEEDS_CONFIRMATION' : 'FAILURE',
        message: res.reply,
      });
    } catch (err: any) {
      setActionResult({
        success: false,
        status: 'FAILURE',
        message: err.message,
      });
    }
  };

  const testVideoEditorAction = async (subAction: string) => {
    try {
      const res = await api.interact(`On video editor, ${subAction}`);
      setActionResult(res.actionResult || {
        success: false,
        status: 'FAILURE',
        message: res.reply,
      });
    } catch (err: any) {
      setActionResult({
        success: false,
        status: 'FAILURE',
        message: err.message,
      });
    }
  };

  const getServiceIcon = (service: Integration['service']) => {
    switch (service) {
      case 'whatsapp':
        return <MessageSquare className="h-6 w-6 text-emerald-400" />;
      case 'video_editor':
        return <Video className="h-6 w-6 text-indigo-400" />;
      default:
        return <Globe className="h-6 w-6 text-cyan-400" />;
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 w-full animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Application Integrations</h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Authorized Service Connectors & Capability Registries
              </p>
            </div>
          </div>
        </div>

        <div className="text-xs font-mono text-cyan-400 bg-cyan-950/60 border border-cyan-800/40 px-3 py-1.5 rounded-xl">
          Account: {user?.name}
        </div>
      </div>

      {/* Security Principles Banner */}
      <div className="mt-4 p-4 rounded-xl bg-slate-900/40 border border-white/[0.08] text-xs text-slate-300 leading-relaxed">
        <div className="font-semibold text-white flex items-center gap-1.5 mb-1">
          <ShieldAlert className="h-4 w-4 text-cyan-400" />
          <span>Strict Native Security & Non-Fabrication Policy</span>
        </div>
        <p className="text-slate-400">
          SR never bypasses native operating system locks, device PINs, or WhatsApp Chat Lock.
          If an application or capability is unsupported, SR truthfully reports the exact limitation.
        </p>
      </div>

      {/* Integrations Grid */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading ? (
          <div className="col-span-full py-12 text-center text-xs text-slate-400 font-mono">
            Verifying connected integrations...
          </div>
        ) : (
          integrations.map((item) => (
            <div
              key={item.id}
              className="sr-glass-card rounded-2xl p-5 border border-white/[0.08] flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-slate-900 border border-white/10">
                      {getServiceIcon(item.service)}
                    </div>
                    <div>
                      <h2 className="text-base font-semibold text-white">{item.name}</h2>
                      <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider">
                        {item.service}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider ${
                      item.status === 'connected'
                        ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    {item.status}
                  </span>
                </div>

                {/* WhatsApp Specific Lock Toggle (Test 13) */}
                {item.service === 'whatsapp' && (
                  <div className="mt-4 p-3 rounded-xl bg-slate-950/60 border border-white/10">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        {item.isLocked ? (
                          <Lock className="h-4 w-4 text-amber-400" />
                        ) : (
                          <Unlock className="h-4 w-4 text-emerald-400" />
                        )}
                        <span className="text-slate-200 font-medium">Native WhatsApp Chat Lock</span>
                      </div>

                      <button
                        onClick={() => toggleWhatsAppLock(item)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-medium border transition-all ${
                          item.isLocked
                            ? 'border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
                            : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                        }`}
                      >
                        {item.isLocked ? 'State: LOCKED (Test 13)' : 'State: UNLOCKED'}
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {item.isLocked
                        ? 'Chat lock active. SR will refuse commands and prompt you to unlock native app first.'
                        : 'Unlocked. External message requests will show a confirmation prompt before sending.'}
                    </p>
                  </div>
                )}

                {/* Capabilities */}
                <div className="mt-4">
                  <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-2">
                    Supported Capabilities
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {item.capabilities.map((cap) => (
                      <span
                        key={cap}
                        className="px-2 py-0.5 rounded-lg bg-slate-900 border border-white/10 text-[11px] font-mono text-slate-300"
                      >
                        ✓ {cap}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Test Buttons */}
              <div className="mt-5 pt-3 border-t border-white/[0.05]">
                <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-2">
                  Test Capability Boundaries
                </div>
                <div className="flex flex-wrap gap-2">
                  {item.service === 'whatsapp' && (
                    <button
                      onClick={testWhatsAppSend}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-white/10 text-xs text-white transition-all"
                    >
                      <Play className="h-3 w-3 text-emerald-400" />
                      <span>Test Message Send</span>
                    </button>
                  )}

                  {item.service === 'video_editor' && (
                    <>
                      <button
                        onClick={() => testVideoEditorAction('mute clip')}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-white/10 text-xs text-white transition-all"
                      >
                        <Play className="h-3 w-3 text-cyan-400" />
                        <span>Mute Clip (Supported)</span>
                      </button>
                      <button
                        onClick={() => testVideoEditorAction('apply filter')}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-white/10 text-xs text-amber-300 transition-all"
                      >
                        <Play className="h-3 w-3 text-amber-400" />
                        <span>Apply Filter (Test 16 Unsupported)</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Result Display */}
      {actionResult && (
        <div
          className={`mt-6 p-4 rounded-xl border text-xs font-mono animate-in fade-in ${
            actionResult.status === 'SUCCESS'
              ? 'border-emerald-500/40 bg-emerald-950/20 text-emerald-300'
              : actionResult.status === 'NEEDS_NATIVE_UNLOCK'
              ? 'border-amber-500/40 bg-amber-950/20 text-amber-300'
              : actionResult.status === 'NEEDS_CONFIRMATION'
              ? 'border-cyan-500/40 bg-cyan-950/20 text-cyan-300'
              : 'border-rose-500/40 bg-rose-950/20 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-1.5 font-bold mb-1">
            {actionResult.status === 'SUCCESS' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-amber-400" />
            )}
            <span>STATUS: {actionResult.status}</span>
          </div>
          <p>{actionResult.message}</p>
        </div>
      )}
    </div>
  );
};
