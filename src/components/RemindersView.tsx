import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { api } from '../services/api.js';
import { Reminder } from '../types.js';
import {
  Bell,
  Plus,
  Trash2,
  CheckCircle,
  Clock,
  Calendar,
  AlertCircle,
  Radio,
} from 'lucide-react';

export const RemindersView: React.FC = () => {
  const { user } = useAuth();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [text, setText] = useState('');
  const [dateTime, setDateTime] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fetchReminders = async () => {
    try {
      const data = await api.getReminders();
      setReminders(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load reminders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReminders();
    const interval = setInterval(fetchReminders, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !dateTime) return;

    try {
      const created = await api.createReminder(
        text,
        new Date(dateTime).toISOString(),
        Intl.DateTimeFormat().resolvedOptions().timeZone
      );
      setReminders([created, ...reminders]);
      setText('');
      setDateTime('');
      setShowAddModal(false);
    } catch (err: any) {
      setError(err.message || 'Failed to create reminder');
    }
  };

  const handleStatusChange = async (id: string, status: Reminder['status']) => {
    try {
      await api.updateReminderStatus(id, status);
      setReminders(reminders.map((r) => (r.id === id ? { ...r, status } : r)));
    } catch (err: any) {
      setError(err.message || 'Failed to update reminder status');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteReminder(id);
      setReminders(reminders.filter((r) => r.id !== id));
    } catch (err: any) {
      setError(err.message || 'Failed to delete reminder');
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 w-full animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Active Reminders & Scheduler</h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Cloud-backed persistence with background trigger worker
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-semibold transition-all shadow-[0_0_15px_rgba(56,189,248,0.2)]"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Schedule Reminder</span>
        </button>
      </div>

      {/* Scheduler status badge */}
      <div className="mt-4 flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-900/40 border border-white/[0.07] text-xs">
        <div className="flex items-center gap-2 text-slate-300">
          <Radio className="h-3.5 w-3.5 text-cyan-400 animate-pulse" />
          <span>Background Worker Active (Evaluates every 4s)</span>
        </div>
        <span className="text-[11px] font-mono text-slate-400">
          User: {user?.name}
        </span>
      </div>

      {error && (
        <div className="mt-4 p-3 rounded-xl border border-rose-500/30 bg-rose-950/20 text-xs text-rose-300 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Reminders List */}
      <div className="mt-6 space-y-3">
        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400 font-mono">
            Loading reminders...
          </div>
        ) : reminders.length === 0 ? (
          <div className="py-12 text-center sr-glass-card rounded-2xl p-8">
            <Clock className="h-10 w-10 text-slate-600 mx-auto mb-3" />
            <div className="text-sm font-medium text-slate-300">No Reminders Scheduled</div>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Say "SR, remind me tomorrow at 8 PM" or schedule one manually.
            </p>
          </div>
        ) : (
          reminders.map((rem) => {
            const isDue = new Date(rem.scheduledTime) <= new Date();
            return (
              <div
                key={rem.id}
                className="sr-glass-card p-4 rounded-xl border border-white/[0.07] hover:border-cyan-500/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-3">
                  <button
                    onClick={() =>
                      handleStatusChange(
                        rem.id,
                        rem.status === 'completed' ? 'pending' : 'completed'
                      )
                    }
                    className={`mt-0.5 p-1 rounded-lg border transition-all ${
                      rem.status === 'completed'
                        ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-400'
                        : 'border-white/10 hover:border-cyan-500/40 text-slate-500'
                    }`}
                  >
                    <CheckCircle className="h-4 w-4" />
                  </button>

                  <div>
                    <div
                      className={`text-sm font-medium ${
                        rem.status === 'completed'
                          ? 'line-through text-slate-500'
                          : 'text-white'
                      }`}
                    >
                      {rem.text}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[11px] font-mono text-slate-400">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-cyan-400" />
                        <span>{new Date(rem.scheduledTime).toLocaleString()}</span>
                      </div>
                      <span>Channel: {rem.notificationChannel}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-center">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider ${
                      rem.status === 'completed'
                        ? 'bg-slate-800 text-slate-400 border border-slate-700'
                        : rem.status === 'triggered'
                        ? 'bg-rose-950/60 text-rose-300 border border-rose-800 animate-pulse'
                        : 'bg-cyan-950/60 text-cyan-300 border border-cyan-800'
                    }`}
                  >
                    {rem.status}
                  </span>

                  <button
                    onClick={() => handleDelete(rem.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 transition-all"
                    title="Delete Reminder"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Reminder Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div className="w-full max-w-md sr-glass-card border border-white/10 rounded-2xl p-6 shadow-2xl animate-in zoom-in-95">
            <h2 className="text-base font-bold text-white mb-1">Create Persistent Reminder</h2>
            <p className="text-xs text-slate-400 mb-4">
              Stored in database and triggered by background worker.
            </p>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-slate-300 mb-1">Reminder Text</label>
                <input
                  type="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="e.g. Submit quarterly compliance report"
                  className="w-full px-3 py-2 rounded-xl border border-white/10 bg-slate-900 text-sm text-white focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-300 mb-1">Date & Time</label>
                <input
                  type="datetime-local"
                  value={dateTime}
                  onChange={(e) => setDateTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-white/10 bg-slate-900 text-sm text-white focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-1.5 rounded-xl border border-white/10 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-cyan-500 text-slate-950 text-xs font-semibold hover:bg-cyan-400 transition-all"
                >
                  Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
