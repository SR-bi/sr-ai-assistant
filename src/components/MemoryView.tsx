import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { api } from '../services/api.js';
import { Memory } from '../types.js';
import {
  Brain,
  Plus,
  Trash2,
  Search,
  Sparkles,
  Calendar,
  Tag,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';

export const MemoryView: React.FC = () => {
  const { user } = useAuth();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState<Memory['category']>('general');
  const [error, setError] = useState<string | null>(null);

  const fetchMemories = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getMemories(search);
      setMemories(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load memories');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMemories();
  }, [search]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContent.trim()) return;

    try {
      const created = await api.addMemory(newContent, newCategory);
      setMemories([created, ...memories]);
      setNewContent('');
      setShowAddModal(false);
    } catch (err: any) {
      setError(err.message || 'Failed to save memory');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteMemory(id);
      setMemories(memories.filter((m) => m.id !== id));
    } catch (err: any) {
      setError(err.message || 'Failed to delete memory');
    }
  };

  const handleClearAll = async () => {
    if (!confirm('Are you sure you want to clear all your saved memories? This cannot be undone.')) return;
    try {
      await api.clearMemories();
      setMemories([]);
    } catch (err: any) {
      setError(err.message || 'Failed to clear memories');
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 w-full animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300">
              <Brain className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Persistent Memory Vault</h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Isolated to account: <span className="text-cyan-400 font-mono">{user?.email}</span>
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {memories.length > 0 && (
            <button
              onClick={handleClearAll}
              className="px-3 py-1.5 rounded-xl border border-white/10 text-xs text-rose-400 hover:bg-rose-950/30 transition-all"
            >
              Clear All
            </button>
          )}

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-semibold transition-all shadow-[0_0_15px_rgba(56,189,248,0.2)]"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Memory</span>
          </button>
        </div>
      </div>

      {/* Isolation notice */}
      <div className="mt-4 flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900/40 border border-cyan-500/20 text-xs text-slate-300">
        <ShieldCheck className="h-4 w-4 text-cyan-400 shrink-0" />
        <span>
          Strict cryptographic database tenant isolation enforced. User B can never read or query these memories.
        </span>
      </div>

      {/* Search Bar */}
      <div className="mt-6 relative">
        <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search memories or filter by topic..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-white/10 bg-slate-900/50 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
        />
      </div>

      {/* Error display */}
      {error && (
        <div className="mt-4 p-3 rounded-xl border border-rose-500/30 bg-rose-950/20 text-xs text-rose-300 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* List */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {loading ? (
          <div className="col-span-full py-12 text-center text-xs text-slate-400 font-mono">
            Loading encrypted memories...
          </div>
        ) : memories.length === 0 ? (
          <div className="col-span-full py-12 text-center sr-glass-card rounded-2xl p-8">
            <Brain className="h-10 w-10 text-slate-600 mx-auto mb-3" />
            <div className="text-sm font-medium text-slate-300">No Memories Recorded</div>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Say "SR, remember that..." or click the Add Memory button above to store facts, deadlines, and preferences.
            </p>
          </div>
        ) : (
          memories.map((mem) => (
            <div
              key={mem.id}
              className="sr-glass-card p-4 rounded-xl border border-white/[0.07] hover:border-cyan-500/30 transition-all flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mb-2">
                  <span className="px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-800/40 text-cyan-300 uppercase tracking-wider">
                    {mem.category}
                  </span>
                  <span>{new Date(mem.createdAt).toLocaleDateString()}</span>
                </div>
                <p className="text-sm text-slate-200 leading-relaxed">{mem.content}</p>
              </div>

              <div className="mt-4 pt-3 border-t border-white/[0.05] flex items-center justify-between">
                <span className="text-[10px] text-slate-400 font-mono">Source: {mem.source}</span>
                <button
                  onClick={() => handleDelete(mem.id)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 transition-all"
                  title="Delete memory"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Memory Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div className="w-full max-w-md sr-glass-card border border-white/10 rounded-2xl p-6 shadow-2xl animate-in zoom-in-95">
            <h2 className="text-base font-bold text-white mb-1">Add Persistent Memory</h2>
            <p className="text-xs text-slate-400 mb-4">
              Stored directly in your isolated database record.
            </p>

            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-slate-300 mb-1">Category</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-white/10 bg-slate-900 text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="general">General</option>
                  <option value="project">Project / Deadline</option>
                  <option value="preference">Personal Preference</option>
                  <option value="personal">Personal / Contact</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-300 mb-1">Memory Content</label>
                <textarea
                  rows={3}
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="e.g. Project deadline is October 10 at 5:00 PM EST"
                  className="w-full px-3 py-2 rounded-xl border border-white/10 bg-slate-900 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
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
                  Save to Vault
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
