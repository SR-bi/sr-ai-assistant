import React, { useState } from 'react';
import { api } from '../services/api.js';
import { TestResult } from '../types.js';
import {
  CheckCircle2,
  XCircle,
  Play,
  RefreshCw,
  ShieldCheck,
  Cpu,
  Layers,
  Sparkles,
} from 'lucide-react';

export const TestSuiteView: React.FC = () => {
  const [running, setRunning] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [summary, setSummary] = useState<{
    total: number;
    passed: number;
    failed: number;
    durationMs: number;
  } | null>(null);

  const runAllTests = async () => {
    setRunning(true);
    try {
      const data = await api.runAllTests();
      setTestResults(data.results);
      setSummary(data.summary);
    } catch (err: any) {
      console.error('Error running test suite:', err);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 w-full animate-in fade-in duration-300 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">
                Mandatory 25-Point Extended Acceptance Test Suite
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Automated end-to-end verification of multi-user isolation, context memory, undo, clarifications, and task planning
              </p>
            </div>
          </div>
        </div>

        <button
          disabled={running}
          onClick={runAllTests}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition-all shadow-[0_0_20px_rgba(56,189,248,0.25)] disabled:opacity-50"
        >
          {running ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>Executing Tests (25)...</span>
            </>
          ) : (
            <>
              <Play className="h-4 w-4 fill-current" />
              <span>Run All 25 Acceptance Tests</span>
            </>
          )}
        </button>
      </div>

      {/* Summary Scorecard */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 animate-in fade-in">
          <div className="p-4 rounded-xl border border-white/10 bg-slate-900/50">
            <div className="text-[11px] font-mono text-slate-400 uppercase">Total Tests</div>
            <div className="text-2xl font-bold text-white mt-1">{summary.total}</div>
          </div>

          <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-950/20">
            <div className="text-[11px] font-mono text-emerald-400 uppercase">Passed</div>
            <div className="text-2xl font-bold text-emerald-300 mt-1">{summary.passed}</div>
          </div>

          <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-950/20">
            <div className="text-[11px] font-mono text-rose-400 uppercase">Failed</div>
            <div className="text-2xl font-bold text-rose-300 mt-1">{summary.failed}</div>
          </div>

          <div className="p-4 rounded-xl border border-cyan-500/30 bg-cyan-950/20">
            <div className="text-[11px] font-mono text-cyan-400 uppercase">Duration</div>
            <div className="text-2xl font-bold text-cyan-300 mt-1">{summary.durationMs} ms</div>
          </div>
        </div>
      )}

      {/* Test Matrix */}
      <div className="space-y-3">
        {testResults.length === 0 && !running && (
          <div className="text-center py-16 sr-glass-card rounded-2xl p-8 border border-white/10">
            <ShieldCheck className="h-12 w-12 text-cyan-400 mx-auto mb-3" />
            <div className="text-base font-semibold text-white">Live Verification Harness Ready</div>
            <p className="text-xs text-slate-400 max-w-md mx-auto mt-1 mb-5">
              Click the button above to execute all 18 specified production checks against the real backend,
              verifying memory isolation between User A & B, offline laptop checks, WhatsApp Chat Lock, and Code 18.
            </p>
            <button
              onClick={runAllTests}
              className="px-4 py-2 rounded-xl bg-cyan-500 text-slate-950 text-xs font-bold hover:bg-cyan-400 transition-all shadow-[0_0_15px_rgba(56,189,248,0.2)]"
            >
              Start Automated Test Run
            </button>
          </div>
        )}

        {testResults.map((test) => (
          <div
            key={test.id}
            className={`p-4 rounded-xl border transition-all text-xs ${
              test.passed
                ? 'border-emerald-500/30 bg-emerald-950/10 hover:border-emerald-500/50'
                : 'border-rose-500/30 bg-rose-950/15 hover:border-rose-500/50'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-white/[0.05]">
              <div className="flex items-center gap-2.5">
                {test.passed ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 text-rose-400 shrink-0" />
                )}
                <span className="font-mono text-cyan-400 font-bold">{test.id}</span>
                <span className="text-white font-semibold text-sm">{test.name}</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-slate-900 border border-white/10 font-mono text-[10px] text-slate-400 uppercase">
                  {test.category}
                </span>
                <span
                  className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold uppercase ${
                    test.passed
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  }`}
                >
                  {test.passed ? 'PASSED' : 'FAILED'}
                </span>
              </div>
            </div>

            <div className="mt-2.5 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-lg bg-black/40 border border-white/5 font-mono">
                <span className="text-slate-400 block text-[10px] mb-0.5">EXPECTED:</span>
                <span className="text-slate-200">{test.expected}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-black/40 border border-white/5 font-mono">
                <span className="text-slate-400 block text-[10px] mb-0.5">ACTUAL VERIFIED:</span>
                <span className={test.passed ? 'text-emerald-300' : 'text-rose-300'}>
                  {test.actual}
                </span>
              </div>
            </div>

            <div className="mt-2 text-[11px] text-slate-400 font-mono">
              Details: {test.details}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
