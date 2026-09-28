import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { Navbar } from './components/Navbar.js';
import { VoiceCore } from './components/VoiceCore.js';
import { MemoryView } from './components/MemoryView.js';
import { RemindersView } from './components/RemindersView.js';
import { DevicesView } from './components/DevicesView.js';
import { IntegrationsView } from './components/IntegrationsView.js';
import { SecurityView } from './components/SecurityView.js';
import { PrivacyView } from './components/PrivacyView.js';
import { AuditView } from './components/AuditView.js';
import { TestSuiteView } from './components/TestSuiteView.js';
import { AuthModal } from './components/AuthModal.js';

function MainApp() {
  const [currentTab, setCurrentTab] = useState('assistant');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#07080b]">
        <div className="flex flex-col items-center gap-3">
          <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 border border-cyan-500/40 shadow-[0_0_20px_rgba(56,189,248,0.25)]">
            <span className="text-xl font-bold tracking-wider text-cyan-400 font-mono">SR</span>
            <div className="absolute inset-0 rounded-2xl border border-cyan-400 animate-ping opacity-25" />
          </div>
          <span className="text-xs font-mono text-slate-400 tracking-widest uppercase">
            Initializing Personal AI Operating Layer...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080a0f] text-[#f1f5f9] flex flex-col selection:bg-teal-500/20 selection:text-teal-200">
      {/* Refined multi-accent ambient atmosphere (Emerald, Teal, Soft Cyan, Subtle Violet) */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[15%] w-[55vw] h-[45vw] rounded-full bg-teal-950/20 blur-[140px]" />
        <div className="absolute top-[30%] right-[-10%] w-[45vw] h-[40vw] rounded-full bg-violet-950/20 blur-[150px]" />
        <div className="absolute bottom-[-15%] left-[25%] w-[50vw] h-[35vw] rounded-full bg-emerald-950/15 blur-[160px]" />
      </div>

      <Navbar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        onOpenAuthModal={() => setAuthModalOpen(true)}
      />

      <main className="flex-1 flex flex-col relative z-10">
        {currentTab === 'assistant' && <VoiceCore onNavigate={setCurrentTab} />}
        {currentTab === 'memory' && <MemoryView />}
        {currentTab === 'reminders' && <RemindersView />}
        {currentTab === 'devices' && <DevicesView />}
        {currentTab === 'integrations' && <IntegrationsView />}
        {currentTab === 'security' && <SecurityView />}
        {currentTab === 'privacy' && <PrivacyView />}
        {currentTab === 'audit' && <AuditView />}
        {currentTab === 'tests' && <TestSuiteView />}
      </main>

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
