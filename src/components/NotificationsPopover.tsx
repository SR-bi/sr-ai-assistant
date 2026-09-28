import React, { useState, useEffect } from 'react';
import { api } from '../services/api.js';
import { Notification } from '../types.js';
import {
  Bell,
  CheckCircle,
  ShieldAlert,
  Clock,
  Key,
  X,
  Check,
} from 'lucide-react';

interface NotificationsPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  onCountChange?: (count: number) => void;
}

export const NotificationsPopover: React.FC<NotificationsPopoverProps> = ({
  isOpen,
  onClose,
  onCountChange,
}) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = async () => {
    try {
      const data = await api.getNotifications();
      setNotifications(data);
      const unread = data.filter((n: Notification) => !n.read).length;
      if (onCountChange) onCountChange(unread);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleMarkRead = async (id: string) => {
    try {
      await api.markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      const unread = notifications.filter((n) => n.id !== id && !n.read).length;
      if (onCountChange) onCountChange(unread);
    } catch (err) {
      console.error('Failed to mark notification read:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="absolute right-0 top-12 mt-2 w-80 sm:w-96 rounded-2xl border border-white/10 bg-[#0d1017] p-4 shadow-2xl backdrop-blur-2xl z-50 animate-in fade-in zoom-in-95">
      <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-cyan-400" />
          <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
            System Notifications
          </h3>
        </div>
        <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-lg">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 max-h-80 overflow-y-auto space-y-2 pr-1">
        {notifications.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400 font-mono">
            No active notifications.
          </div>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              className={`p-3 rounded-xl border transition-all text-xs flex items-start justify-between gap-2.5 ${
                n.read
                  ? 'border-white/5 bg-slate-950/40 text-slate-400'
                  : 'border-cyan-500/30 bg-cyan-950/20 text-slate-200'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5">
                  {n.type === 'reminder' ? (
                    <Clock className="h-4 w-4 text-cyan-400" />
                  ) : n.type === 'security' ? (
                    <ShieldAlert className="h-4 w-4 text-rose-400" />
                  ) : (
                    <CheckCircle className="h-4 w-4 text-emerald-400" />
                  )}
                </div>
                <div>
                  <div className="font-semibold text-white text-xs">{n.title}</div>
                  <p className="text-slate-300 text-[11px] mt-0.5 leading-snug">{n.message}</p>
                  <span className="text-[10px] text-slate-500 font-mono mt-1 block">
                    {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>

              {!n.read && (
                <button
                  onClick={() => handleMarkRead(n.id)}
                  className="p-1 rounded-lg hover:bg-white/10 text-cyan-400 hover:text-cyan-300 shrink-0"
                  title="Mark as read"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
