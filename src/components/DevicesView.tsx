import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { api } from '../services/api.js';
import { Device, ActionResult } from '../types.js';
import {
  Laptop,
  Smartphone,
  Server,
  Power,
  Play,
  Terminal,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Copy,
  Key,
} from 'lucide-react';

export const DevicesView: React.FC = () => {
  const { user } = useAuth();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{ [deviceId: string]: ActionResult }>({});
  const [copiedToken, setCopiedToken] = useState(false);

  const fetchDevices = async () => {
    try {
      const data = await api.getDevices();
      setDevices(data);
    } catch (err) {
      console.error('Failed to fetch devices:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  const toggleStatus = async (device: Device) => {
    const newStatus = device.status === 'online' ? 'offline' : 'online';
    try {
      const updated = await api.updateDeviceStatus(device.id, newStatus);
      setDevices(devices.map((d) => (d.id === device.id ? updated : d)));
    } catch (err) {
      console.error('Failed to update device status:', err);
    }
  };

  const executeTestAction = async (device: Device, actionName: string, params: any) => {
    setExecuting(`${device.id}_${actionName}`);
    try {
      const res = await api.triggerDeviceAction(device.id, actionName, params);
      setLastResult((prev) => ({ ...prev, [device.id]: res }));
    } catch (err: any) {
      setLastResult((prev) => ({
        ...prev,
        [device.id]: {
          success: false,
          status: 'FAILURE',
          message: err.message || 'Execution error',
        },
      }));
    } finally {
      setExecuting(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 w-full animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300">
              <Laptop className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Authorized Device Manager</h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Windows Companion Agent & Hardware Control Hub
              </p>
            </div>
          </div>
        </div>

        <div className="text-xs font-mono text-cyan-400 bg-cyan-950/60 border border-cyan-800/40 px-3 py-1.5 rounded-xl">
          Account: {user?.name}
        </div>
      </div>

      {/* Architecture Notice (Section 14) */}
      <div className="mt-4 p-4 rounded-xl bg-slate-900/40 border border-white/[0.08] text-xs text-slate-300 leading-relaxed">
        <div className="font-semibold text-white flex items-center gap-1.5 mb-1">
          <Terminal className="h-4 w-4 text-cyan-400" />
          <span>Windows Automation Companion Architecture</span>
        </div>
        <p className="text-slate-400">
          The browser never pretends it controls the operating system directly. SR delegates authorized tasks
          to an authenticated Windows SR companion agent. If the companion is offline, SR truthfully reports it.
        </p>
      </div>

      {/* Device Cards */}
      <div className="mt-6 space-y-4">
        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400 font-mono">
            Scanning registered companion devices...
          </div>
        ) : (
          devices.map((device) => {
            const result = lastResult[device.id];
            return (
              <div
                key={device.id}
                className="sr-glass-card rounded-2xl p-5 border border-white/[0.08] transition-all"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/[0.05]">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-xl bg-slate-800/80 border border-white/10 text-cyan-300">
                      {device.deviceType === 'windows' ? (
                        <Laptop className="h-6 w-6" />
                      ) : (
                        <Smartphone className="h-6 w-6" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-semibold text-white">{device.name}</h2>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider ${
                            device.status === 'online'
                              ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800'
                              : 'bg-rose-950/60 text-rose-400 border border-rose-800'
                          }`}
                        >
                          {device.status}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 font-mono mt-0.5">
                        ID: {device.id} • Last Heartbeat: {new Date(device.lastSeen).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>

                  {/* Online/Offline Toggle Button */}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleStatus(device)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                        device.status === 'online'
                          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                          : 'border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20'
                      }`}
                    >
                      <Power className="h-3.5 w-3.5" />
                      <span>Toggle Status: {device.status === 'online' ? 'Set Offline' : 'Set Online'}</span>
                    </button>
                  </div>
                </div>

                {/* Capabilities */}
                <div className="mt-4">
                  <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-2">
                    Verified Agent Capabilities
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {device.capabilities.map((cap) => (
                      <span
                        key={cap}
                        className="px-2 py-0.5 rounded-lg bg-slate-900 border border-white/10 text-[11px] font-mono text-slate-300"
                      >
                        {cap}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Test Action Dispatcher */}
                <div className="mt-4 pt-3 border-t border-white/[0.05]">
                  <div className="text-[11px] font-mono text-cyan-400 uppercase tracking-wider mb-2">
                    Execute Verified Hardware Action
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      disabled={executing !== null}
                      onClick={() =>
                        executeTestAction(device, 'open_app', { appName: 'VS Code' })
                      }
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-white/10 text-xs text-white transition-all disabled:opacity-50"
                    >
                      <Play className="h-3 w-3 text-cyan-400" />
                      <span>Launch VS Code</span>
                    </button>

                    <button
                      disabled={executing !== null}
                      onClick={() =>
                        executeTestAction(device, 'open_app', { appName: 'Google Chrome' })
                      }
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-white/10 text-xs text-white transition-all disabled:opacity-50"
                    >
                      <Play className="h-3 w-3 text-cyan-400" />
                      <span>Launch Chrome</span>
                    </button>

                    <button
                      disabled={executing !== null}
                      onClick={() =>
                        executeTestAction(device, 'system_status', {})
                      }
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-white/10 text-xs text-white transition-all disabled:opacity-50"
                    >
                      <Terminal className="h-3 w-3 text-cyan-400" />
                      <span>Query System Diagnostics</span>
                    </button>
                  </div>

                  {/* Real Execution Result Display */}
                  {result && (
                    <div
                      className={`mt-3 p-3 rounded-xl border text-xs font-mono animate-in fade-in ${
                        result.status === 'SUCCESS'
                          ? 'border-emerald-500/40 bg-emerald-950/20 text-emerald-300'
                          : result.status === 'DEVICE_OFFLINE'
                          ? 'border-orange-500/40 bg-orange-950/20 text-orange-300'
                          : 'border-rose-500/40 bg-rose-950/20 text-rose-300'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold mb-1">
                        {result.status === 'SUCCESS' ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-orange-400" />
                        )}
                        <span>EXECUTION STATUS: {result.status}</span>
                      </div>
                      <p>{result.message}</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
