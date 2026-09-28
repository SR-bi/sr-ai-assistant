import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { api } from '../services/api.js';
import { AssistantOutput, ActionResult, ActionStatusType } from '../types.js';
import {
  Mic,
  MicOff,
  Send,
  Volume2,
  VolumeX,
  ShieldAlert,
  AlertTriangle,
  CheckCircle,
  ExternalLink,
  Lock,
  Sparkles,
  RefreshCw,
  Globe,
  KeyRound,
  X,
  Square,
  HelpCircle,
  Wifi,
  WifiOff,
  Search,
  Trash2,
  Laptop,
  Brain,
  Shield,
  ArrowRight,
} from 'lucide-react';

interface VoiceCoreProps {
  onNavigate?: (tab: string) => void;
}

export const VoiceCore: React.FC<VoiceCoreProps> = ({ onNavigate }) => {
  const { user, profile } = useAuth();
  const [voiceState, setVoiceState] = useState<ActionStatusType>('READY');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [typedMessage, setTypedMessage] = useState('');
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [autoSpeak, setAutoSpeak] = useState(profile?.autoSpeak ?? true);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  const [history, setHistory] = useState<
    Array<{
      id: string;
      sender: 'user' | 'sr';
      text: string;
      detectedLanguage?: string;
      actionResult?: ActionResult;
      groundingUrls?: Array<{ uri: string; title: string }>;
      timestamp: string;
    }>
  >([]);

  // Pending confirmation state
  const [pendingConfirmation, setPendingConfirmation] = useState<{
    message: string;
    payload: any;
  } | null>(null);

  // Clarification state
  const [pendingClarificationPrompt, setPendingClarificationPrompt] = useState<string | null>(null);

  // Security code prompt modal for protected resources (Code 18)
  const [securityCodePrompt, setSecurityCodePrompt] = useState<{
    active: boolean;
    resourceId?: string;
  }>({ active: false });
  const [securityCodeInput, setSecurityCodeInput] = useState('18');

  // Search overlay state
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ messages: any[]; memories: any[]; reminders: any[] } | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Speech Recognition & Voice Flow refs
  const recognitionRef = useRef<any>(null);
  const isRecognizingRef = useRef(false);
  const activeTranscriptRef = useRef('');
  const hasSpokenRef = useRef(false);
  const hasSubmittedRef = useRef(false);
  const isSubmittingRef = useRef(false);
  const silenceTimerRef = useRef<any>(null);
  const speechendTimerRef = useRef<any>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Configurable thresholds for voice interaction
  const SILENCE_DETECTION_MS = 1800; // 1.8s silence window for natural pauses
  const FINAL_SENTENCE_SILENCE_MS = 1300; // 1.3s once a final sentence chunk is received
  const SPEECH_END_GRACE_MS = 450; // 450ms debounce on speechend / soundend to finalize phonemes

  // Online / Offline listener
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Cleanup speech resources on unmount
  useEffect(() => {
    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (speechendTimerRef.current) clearTimeout(speechendTimerRef.current);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Load chat history from backend on user mount
  useEffect(() => {
    const loadChat = async () => {
      try {
        const past = await api.getChatHistory(20);
        if (past && past.length > 0) {
          setHistory(
            past.map((m: any) => ({
              id: m.id,
              sender: m.role === 'user' ? 'user' : 'sr',
              text: m.text,
              actionResult: m.actionResult,
              timestamp: new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            }))
          );
        }
      } catch (err) {
        console.error('Failed to load past chat:', err);
      }
    };
    loadChat();
  }, [user?.id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  // Clear all pending voice timers safely
  const clearAllVoiceTimers = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (speechendTimerRef.current) {
      clearTimeout(speechendTimerRef.current);
      speechendTimerRef.current = null;
    }
  };

  // Automatically finalize transcript, stop microphone, and submit to SR assistant
  const autoFinishAndSubmit = (triggerSource: string) => {
    if (hasSubmittedRef.current || isSubmittingRef.current) return;

    clearAllVoiceTimers();

    // Stop and release speech recognition immediately
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      isRecognizingRef.current = false;
    }

    const commandText = activeTranscriptRef.current.trim();
    if (!commandText) {
      setVoiceState('READY');
      return;
    }

    hasSubmittedRef.current = true;
    isSubmittingRef.current = true;

    // Immediately stop microphone and transition to PROCESSING
    setVoiceState('PROCESSING');

    // Automatically submit through standard command handler
    handleSendMessage(commandText);
  };

  // Start Voice Capture Session
  const startListening = () => {
    setSpeechError(null);

    // If currently speaking, interrupt voice immediately
    if (isSpeaking) {
      interruptVoice();
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSpeechError('Speech recognition is not supported in this browser. Keyboard input is available below.');
      return;
    }

    clearAllVoiceTimers();

    // Abort any lingering recognition instance
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
      recognitionRef.current = null;
    }

    // Reset session tracking flags
    hasSubmittedRef.current = false;
    isSubmittingRef.current = false;
    hasSpokenRef.current = false;
    activeTranscriptRef.current = '';
    setTranscript('');

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognition.lang =
        profile?.preferredLanguage === 'ur'
          ? 'ur-PK'
          : profile?.preferredLanguage === 'roman_urdu'
          ? 'ur-PK'
          : 'en-US';

      recognition.onstart = () => {
        isRecognizingRef.current = true;
        setVoiceState('LISTENING');
        setSpeechError(null);
      };

      if ('onspeechstart' in recognition) {
        recognition.onspeechstart = () => {
          hasSpokenRef.current = true;
        };
      }
      if ('onsoundstart' in recognition) {
        recognition.onsoundstart = () => {
          hasSpokenRef.current = true;
        };
      }

      recognition.onresult = (event: any) => {
        hasSpokenRef.current = true;
        let finalTrans = '';
        let interimTrans = '';

        for (let i = 0; i < event.results.length; i++) {
          const item = event.results[i];
          if (item.isFinal) {
            finalTrans += item[0].transcript + ' ';
          } else {
            interimTrans += item[0].transcript;
          }
        }

        const combined = (finalTrans + interimTrans).replace(/\s+/g, ' ').trim();
        if (combined) {
          activeTranscriptRef.current = combined;
          setTranscript(combined);

          // Clear prior silence timer
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
          }

          // Automatically stop microphone after speech detection + silence threshold
          const timeoutMs = finalTrans.trim().length > 0 ? FINAL_SENTENCE_SILENCE_MS : SILENCE_DETECTION_MS;
          silenceTimerRef.current = setTimeout(() => {
            autoFinishAndSubmit('silence_timeout');
          }, timeoutMs);
        }
      };

      if ('onspeechend' in recognition) {
        recognition.onspeechend = () => {
          if (hasSpokenRef.current && activeTranscriptRef.current.trim().length > 0) {
            if (silenceTimerRef.current) {
              clearTimeout(silenceTimerRef.current);
              silenceTimerRef.current = null;
            }
            if (speechendTimerRef.current) {
              clearTimeout(speechendTimerRef.current);
            }
            speechendTimerRef.current = setTimeout(() => {
              autoFinishAndSubmit('onspeechend');
            }, SPEECH_END_GRACE_MS);
          }
        };
      }

      if ('onsoundend' in recognition) {
        recognition.onsoundend = () => {
          if (hasSpokenRef.current && activeTranscriptRef.current.trim().length > 0) {
            if (silenceTimerRef.current) {
              clearTimeout(silenceTimerRef.current);
              silenceTimerRef.current = null;
            }
            if (speechendTimerRef.current) {
              clearTimeout(speechendTimerRef.current);
            }
            speechendTimerRef.current = setTimeout(() => {
              autoFinishAndSubmit('onsoundend');
            }, SPEECH_END_GRACE_MS + 200);
          }
        };
      }

      recognition.onerror = (event: any) => {
        isRecognizingRef.current = false;
        clearAllVoiceTimers();

        if (event.error === 'aborted') {
          return;
        }

        const pending = activeTranscriptRef.current.trim();
        if (event.error === 'no-speech') {
          if (!hasSubmittedRef.current && pending) {
            autoFinishAndSubmit('no_speech_fallback');
            return;
          }
          setSpeechError('No speech detected. Tap circular microphone when ready.');
          setVoiceState('READY');
          return;
        }

        console.warn('Speech recognition notice:', event.error);
        if (event.error === 'not-allowed') {
          setSpeechError('Microphone permission was denied. Please allow microphone access in browser settings.');
        } else if (event.error === 'network') {
          setSpeechError('Speech recognition network error. Secondary keyboard input available below.');
        } else {
          setSpeechError(`Voice input notice: ${event.error}. Secondary keyboard input available.`);
        }
        setVoiceState('READY');
      };

      recognition.onend = () => {
        isRecognizingRef.current = false;
        clearAllVoiceTimers();

        // If speech was spoken and transcript is pending submission:
        const pending = activeTranscriptRef.current.trim();
        if (!hasSubmittedRef.current && pending) {
          autoFinishAndSubmit('onend_with_pending_transcript');
        } else if (!hasSubmittedRef.current && !isSubmittingRef.current) {
          setVoiceState('READY');
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      console.error('Failed to start recognition:', err);
      setSpeechError('Microphone could not be accessed. Please ensure permissions are granted.');
      setVoiceState('READY');
    }
  };

  // Stop listening manually (if user clicks microphone OFF while listening)
  const stopListeningManually = () => {
    clearAllVoiceTimers();

    const pending = activeTranscriptRef.current.trim();
    if (pending && !hasSubmittedRef.current) {
      autoFinishAndSubmit('manual_stop_with_speech');
    } else {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
        recognitionRef.current = null;
      }
      isRecognizingRef.current = false;
      setTranscript('');
      setVoiceState('READY');
    }
  };

  // Toggle Microphone
  const toggleListening = () => {
    setSpeechError(null);

    // If currently speaking, interrupt voice immediately
    if (isSpeaking) {
      interruptVoice();
      return;
    }

    if (isRecognizingRef.current || voiceState === 'LISTENING') {
      stopListeningManually();
    } else {
      startListening();
    }
  };

  // Stop / Interrupt Voice Output
  const interruptVoice = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    clearAllVoiceTimers();
    if (recognitionRef.current && isRecognizingRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
      recognitionRef.current = null;
      isRecognizingRef.current = false;
    }
    setVoiceState('READY');
  };

  // Speak response out loud using Web Speech Synthesis
  const speakText = (text: string) => {
    if (!autoSpeak || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();

    // Clean markdown stars/bullets/URLs for natural voice synthesis
    const cleanText = text
      .replace(/[*_#`~]/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/https?:\/\/\S+/g, '')
      .trim();

    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    if (profile?.preferredLanguage === 'ur') {
      utterance.lang = 'ur-PK';
    } else {
      utterance.lang = 'en-US';
    }

    utterance.onstart = () => {
      setIsSpeaking(true);
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      setVoiceState('READY');
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
      setVoiceState('READY');
    };

    window.speechSynthesis.speak(utterance);
  };

  // Process message to SR backend
  const handleSendMessage = async (customText?: string) => {
    const textToSend = (customText ?? (activeTranscriptRef.current || transcript || typedMessage)).trim();
    if (!textToSend) return;

    // Clean active timers & recognition
    clearAllVoiceTimers();
    if (recognitionRef.current && isRecognizingRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      isRecognizingRef.current = false;
    }

    // Reset inputs and live transcript
    activeTranscriptRef.current = '';
    setTranscript('');
    setTypedMessage('');
    setPendingClarificationPrompt(null);
    setSpeechError(null);

    if (isSpeaking) {
      interruptVoice();
    }

    // Append user message immediately to the conversation feed
    const userMsgId = 'msg_' + Date.now();
    setHistory((prev) => [
      ...prev,
      {
        id: userMsgId,
        sender: 'user',
        text: textToSend,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);

    setVoiceState('PROCESSING');

    try {
      const res: AssistantOutput = await api.interact(textToSend, {
        source: customText ? 'voice' : (transcript ? 'voice' : 'chat'),
      });

      // Handle Clarification requirement
      if (res.needsClarification) {
        setVoiceState('WAITING FOR CLARIFICATION');
        setPendingClarificationPrompt(res.reply);
      } else if (res.needsConfirmation && res.confirmationPayload) {
        setPendingConfirmation({
          message: res.reply,
          payload: res.confirmationPayload,
        });
        setVoiceState('WAITING FOR CONFIRMATION');
      } else if (res.needsSecurityCode) {
        setSecurityCodePrompt({ active: true, resourceId: res.actionResult?.data?.resourceId });
        setVoiceState('WAITING FOR PERMISSION');
      } else if (res.actionResult?.status === 'CANCELLED') {
        setVoiceState('CANCELLED');
        setTimeout(() => setVoiceState('READY'), 2500);
      } else if (res.actionResult?.status === 'DEVICE_OFFLINE' || res.actionResult?.status === 'UNAVAILABLE') {
        setVoiceState('UNAVAILABLE');
      } else if (res.actionResult && !res.actionResult.success) {
        setVoiceState('FAILED');
      } else {
        if (!autoSpeak) {
          setVoiceState('READY');
        }
      }

      // Add SR's verified response to chat history
      setHistory((prev) => [
        ...prev,
        {
          id: 'sr_' + Date.now(),
          sender: 'sr',
          text: res.reply,
          detectedLanguage: res.detectedLanguage,
          actionResult: res.actionResult,
          groundingUrls: res.groundingUrls,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);

      if (autoSpeak) {
        speakText(res.reply);
      }
    } catch (err: any) {
      console.error('Interaction error:', err);
      setVoiceState('FAILED');
      setHistory((prev) => [
        ...prev,
        {
          id: 'sr_err_' + Date.now(),
          sender: 'sr',
          text: `SR could not complete the operation: ${err.message || 'Network communication failure'}.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      isSubmittingRef.current = false;
    }
  };

  // Confirm pending external action
  const confirmAction = async (approved: boolean) => {
    if (!pendingConfirmation) return;

    if (!approved) {
      setPendingConfirmation(null);
      setVoiceState('CANCELLED');
      setHistory((prev) => [
        ...prev,
        {
          id: 'sr_cancel_' + Date.now(),
          sender: 'sr',
          text: 'Action cancelled by user.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
      setTimeout(() => setVoiceState('READY'), 2000);
      return;
    }

    setVoiceState('EXECUTING');
    try {
      const res: AssistantOutput = await api.interact('', {
        confirmed: true,
        confirmationPayload: pendingConfirmation.payload,
      });

      setPendingConfirmation(null);
      setVoiceState(res.actionResult?.success ? 'COMPLETED' : 'FAILED');

      setHistory((prev) => [
        ...prev,
        {
          id: 'sr_conf_' + Date.now(),
          sender: 'sr',
          text: res.reply,
          actionResult: res.actionResult,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);

      speakText(res.reply);
      setTimeout(() => setVoiceState('READY'), 3000);
    } catch (err: any) {
      setVoiceState('FAILED');
      setPendingConfirmation(null);
    }
  };

  // Submit security code for protected vault access
  const handleSecurityCodeSubmit = async () => {
    if (!securityCodeInput.trim()) return;
    setSecurityCodePrompt({ active: false });
    setVoiceState('EXECUTING');

    try {
      const res: AssistantOutput = await api.interact('Access protected resource with security verification', {
        securityCode: securityCodeInput.trim(),
      });

      setVoiceState(res.actionResult?.success ? 'COMPLETED' : 'FAILED');
      setHistory((prev) => [
        ...prev,
        {
          id: 'sr_sec_' + Date.now(),
          sender: 'sr',
          text: res.reply,
          actionResult: res.actionResult,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);

      speakText(res.reply);
      setTimeout(() => setVoiceState('READY'), 3000);
    } catch (err: any) {
      setVoiceState('FAILED');
    }
  };

  // Search History Handler
  const handleSearchHistory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const res = await api.searchContent(searchQuery.trim());
      setSearchResults(res);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  // Clear Chat History View
  const handleClearChatView = () => {
    if (confirm('Clear the current conversation view?')) {
      setHistory([]);
    }
  };

  // Understated status indicator computation
  const getStatusPresentation = () => {
    if (isSpeaking) {
      return {
        label: 'Speaking',
        sublabel: 'SR is responding aloud',
        pillClass: 'bg-teal-500/10 text-teal-300 border-teal-500/30',
        dotClass: 'bg-teal-400 animate-pulse',
      };
    }
    if (voiceState === 'LISTENING') {
      return {
        label: 'Listening',
        sublabel: 'Speak clearly in English, Urdu, or Roman Urdu',
        pillClass: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
        dotClass: 'bg-emerald-400 animate-ping',
      };
    }
    if (voiceState === 'PROCESSING' || voiceState === 'VERIFYING') {
      return {
        label: 'Processing',
        sublabel: 'Analyzing context and formulating action...',
        pillClass: 'bg-violet-500/10 text-violet-300 border-violet-500/30',
        dotClass: 'bg-violet-400 animate-pulse',
      };
    }
    if (voiceState === 'WAITING FOR CLARIFICATION') {
      return {
        label: 'Clarification Needed',
        sublabel: 'Awaiting your specific input',
        pillClass: 'bg-teal-500/10 text-teal-300 border-teal-500/30',
        dotClass: 'bg-teal-400',
      };
    }
    if (voiceState === 'WAITING FOR CONFIRMATION') {
      return {
        label: 'Confirmation Required',
        sublabel: 'Please approve the planned action',
        pillClass: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
        dotClass: 'bg-amber-400 animate-pulse',
      };
    }
    if (voiceState === 'WAITING FOR PERMISSION') {
      return {
        label: 'Permission Required',
        sublabel: 'Vault access requires security code verification',
        pillClass: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
        dotClass: 'bg-rose-400',
      };
    }
    if (speechError || voiceState === 'FAILED') {
      return {
        label: 'Error',
        sublabel: speechError || 'Action could not be executed',
        pillClass: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
        dotClass: 'bg-rose-400',
      };
    }
    return {
      label: 'Ready',
      sublabel: 'Tap circular microphone to speak or use text below',
      pillClass: 'bg-white/[0.05] text-slate-300 border-white/10',
      dotClass: 'bg-teal-400/80',
    };
  };

  const statusInfo = getStatusPresentation();

  const sampleCommands = [
    { text: 'SR Chrome kholo', label: 'Chrome kholo', desc: 'Opens Chrome on companion device' },
    { text: 'SR mujhe kal 8 baje yaad dila dena', label: 'Kal 8 baje reminder', desc: 'Schedules reminder' },
    { text: 'SR undo that', label: 'Undo previous action', desc: 'Reverses reversible task' },
    { text: 'What do you remember about me?', label: 'What do you remember?', desc: 'Summarizes stored memory' },
    { text: 'What did I tell you earlier?', label: 'Recall earlier context', desc: 'Conversation context recall' },
    { text: 'Check calendar status, open browser and schedule a reminder for tomorrow', label: 'Multi-step plan', desc: 'Coordinated task planning' },
  ];

  return (
    <div className="relative flex flex-col items-center justify-between min-h-[calc(100vh-4rem)] p-3 sm:p-5 lg:p-6 max-w-5xl mx-auto w-full">
      {/* Top Workspace Toolbar: Network, Audio, and Assistant Navigation */}
      <div className="w-full flex flex-wrap items-center justify-between gap-3 px-2 py-2 mb-2 rounded-xl bg-white/[0.02] border border-white/[0.06] text-xs">
        {/* Left: Operating Status & Connectivity */}
        <div className="flex items-center gap-2.5 text-slate-300">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-teal-400 animate-pulse" />
            <span className="font-semibold tracking-wide text-white">SR Layer</span>
          </div>
          <span className="text-white/20">|</span>
          <div className="flex items-center gap-1 text-[11px] font-mono">
            {isOnline ? (
              <>
                <Wifi className="h-3 w-3 text-emerald-400" />
                <span className="text-emerald-400/90">Connected</span>
              </>
            ) : (
              <>
                <WifiOff className="h-3 w-3 text-rose-400" />
                <span className="text-rose-400">Offline</span>
              </>
            )}
          </div>
          <span className="text-white/20 hidden sm:inline">|</span>
          <span className="text-[11px] text-slate-400 hidden sm:inline">
            Lang: {profile?.preferredLanguage === 'ur' ? 'Urdu' : 'English / Roman Urdu'}
          </span>
        </div>

        {/* Right: Audio toggle, Search, and Quick Navigation controls */}
        <div className="flex items-center gap-2">
          {/* Search conversation & memory */}
          <button
            onClick={() => setSearchOpen(!searchOpen)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs transition-all ${
              searchOpen
                ? 'border-teal-500/40 bg-teal-500/10 text-teal-300'
                : 'border-white/10 bg-slate-900/50 text-slate-400 hover:text-slate-200'
            }`}
            title="Search conversation, memory, reminders"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Search</span>
          </button>

          {/* Audio Responses toggle */}
          <button
            onClick={() => setAutoSpeak(!autoSpeak)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs transition-all ${
              autoSpeak
                ? 'border-teal-500/30 bg-teal-500/10 text-teal-300'
                : 'border-white/10 bg-slate-900/50 text-slate-400 hover:text-slate-300'
            }`}
            title="Toggle Spoken Responses"
          >
            {autoSpeak ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{autoSpeak ? 'Voice On' : 'Voice Muted'}</span>
          </button>

          {/* Clear View */}
          {history.length > 0 && (
            <button
              onClick={handleClearChatView}
              className="p-1.5 rounded-lg border border-white/10 text-slate-400 hover:text-rose-300 hover:border-rose-500/30 transition-all"
              title="Clear visible messages"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}

          {/* Quick tab helpers if onNavigate supplied */}
          {onNavigate && (
            <div className="hidden md:flex items-center gap-1.5 pl-2 border-l border-white/10">
              <button
                onClick={() => onNavigate('devices')}
                className="px-2 py-1 rounded text-[11px] text-slate-400 hover:text-teal-300 hover:bg-white/[0.04] transition-colors"
              >
                Devices
              </button>
              <button
                onClick={() => onNavigate('security')}
                className="px-2 py-1 rounded text-[11px] text-slate-400 hover:text-violet-300 hover:bg-white/[0.04] transition-colors"
              >
                Security & Vault
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Unified Search Modal / Drawer */}
      {searchOpen && (
        <div className="w-full max-w-xl my-2 p-3.5 rounded-xl border border-white/10 bg-[#0c1017]/95 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-2">
          <form onSubmit={handleSearchHistory} className="flex items-center gap-2 mb-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversation, memories, or reminders..."
              className="flex-1 px-3 py-1.5 rounded-lg border border-white/10 bg-slate-900 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500/50"
            />
            <button
              type="submit"
              disabled={isSearching || !searchQuery.trim()}
              className="px-3 py-1.5 rounded-lg bg-teal-500/20 text-teal-300 border border-teal-500/40 text-xs font-semibold hover:bg-teal-500/30 disabled:opacity-30"
            >
              {isSearching ? 'Searching...' : 'Search'}
            </button>
            <button
              type="button"
              onClick={() => {
                setSearchOpen(false);
                setSearchResults(null);
              }}
              className="p-1.5 text-slate-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </form>

          {searchResults && (
            <div className="max-h-48 overflow-y-auto space-y-2 text-xs">
              {searchResults.messages.length === 0 &&
                searchResults.memories.length === 0 &&
                searchResults.reminders.length === 0 && (
                  <div className="text-slate-400 text-center py-2">No matching items found.</div>
                )}
              {searchResults.memories.map((m: any) => (
                <div key={m.id} className="p-2 rounded bg-white/[0.03] border border-white/5">
                  <span className="text-[10px] text-teal-400 font-mono uppercase">Memory: </span>
                  <span className="text-slate-200">{m.content}</span>
                </div>
              ))}
              {searchResults.reminders.map((r: any) => (
                <div key={r.id} className="p-2 rounded bg-white/[0.03] border border-white/5">
                  <span className="text-[10px] text-violet-400 font-mono uppercase">Reminder: </span>
                  <span className="text-slate-200">{r.title}</span>
                </div>
              ))}
              {searchResults.messages.map((msg: any) => (
                <div key={msg.id} className="p-2 rounded bg-white/[0.03] border border-white/5">
                  <span className="text-[10px] text-cyan-400 font-mono uppercase">{msg.role}: </span>
                  <span className="text-slate-200">{msg.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main Microphone Section: Beautiful Circular Control with Gradient Ring */}
      <div className="flex flex-col items-center justify-center my-auto py-3 text-center">
        <div className="relative flex items-center justify-center">
          {/* Calm Ambient Aura */}
          <div
            className={`absolute h-60 w-60 sm:h-72 sm:w-72 rounded-full transition-all duration-700 blur-3xl pointer-events-none ${
              isSpeaking
                ? 'bg-gradient-to-r from-teal-500/25 to-violet-500/20 scale-110 sr-speaking-glow'
                : voiceState === 'LISTENING'
                ? 'bg-gradient-to-r from-emerald-500/30 via-teal-500/30 to-cyan-500/30 scale-120'
                : voiceState === 'PROCESSING' || voiceState === 'VERIFYING'
                ? 'bg-gradient-to-r from-violet-500/25 to-teal-500/20 scale-110 animate-pulse'
                : voiceState === 'WAITING FOR CONFIRMATION'
                ? 'bg-amber-500/20 scale-105'
                : voiceState === 'WAITING FOR PERMISSION'
                ? 'bg-rose-500/20 scale-105'
                : 'bg-gradient-to-tr from-teal-900/15 via-emerald-900/10 to-violet-950/20 scale-95 sr-aura'
            }`}
          />

          {/* Outer Rotating Gradient Ring Container */}
          <div
            className={`relative p-[3px] rounded-full transition-all duration-500 ${
              isSpeaking
                ? 'bg-gradient-to-r from-teal-400 via-emerald-400 via-cyan-400 to-violet-500 sr-speaking-glow'
                : voiceState === 'LISTENING'
                ? 'bg-gradient-to-r from-emerald-400 via-teal-300 via-cyan-400 to-violet-400 sr-animate-spin-slow shadow-[0_0_40px_rgba(45,212,191,0.35)]'
                : voiceState === 'PROCESSING' || voiceState === 'VERIFYING'
                ? 'bg-gradient-to-r from-violet-400 via-teal-400 to-emerald-400 sr-animate-spin-fast shadow-[0_0_35px_rgba(139,92,246,0.3)]'
                : voiceState === 'WAITING FOR CONFIRMATION'
                ? 'bg-gradient-to-r from-amber-400 to-orange-400 shadow-[0_0_30px_rgba(245,158,11,0.3)]'
                : voiceState === 'WAITING FOR PERMISSION'
                ? 'bg-gradient-to-r from-rose-400 to-amber-400 shadow-[0_0_30px_rgba(244,63,94,0.3)]'
                : 'bg-gradient-to-br from-teal-500/25 via-emerald-500/20 to-violet-500/25 hover:from-teal-400/40 hover:to-violet-400/40'
            }`}
          >
            {/* Dark spacer ring */}
            <div className="p-1 rounded-full bg-[#080a0f]">
              {/* Primary Circular Microphone Button */}
              <button
                onClick={isSpeaking ? interruptVoice : toggleListening}
                aria-label="SR Voice interaction microphone"
                className={`relative flex h-36 w-36 sm:h-44 sm:w-44 items-center justify-center rounded-full transition-all duration-300 cursor-pointer focus:outline-none ${
                  isSpeaking
                    ? 'bg-gradient-to-b from-[#13222a] to-[#0a1017] border border-teal-400/60 shadow-[0_0_30px_rgba(20,184,166,0.35)]'
                    : voiceState === 'LISTENING'
                    ? 'bg-gradient-to-b from-[#0e2422] to-[#091515] border border-emerald-400/70 scale-102'
                    : voiceState === 'PROCESSING' || voiceState === 'VERIFYING'
                    ? 'bg-gradient-to-b from-[#191629] to-[#0c0a15] border border-violet-400/60'
                    : 'sr-metallic-button border border-white/15 hover:border-teal-400/40 hover:shadow-[0_0_25px_rgba(45,212,191,0.2)]'
                }`}
              >
                {/* Subtle inner concentric glass ring */}
                <div className="absolute inset-2 rounded-full border border-white/[0.08] pointer-events-none" />
                <div className="absolute inset-5 rounded-full border border-teal-500/[0.08] pointer-events-none" />

                {/* Center Content / State Representation */}
                <div className="flex flex-col items-center justify-center select-none">
                  {isSpeaking ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex items-center gap-1.5 h-8">
                        <span className="w-1.5 h-5 bg-teal-300 rounded-full animate-pulse" />
                        <span className="w-1.5 h-8 bg-emerald-400 rounded-full animate-pulse delay-75" />
                        <span className="w-1.5 h-6 bg-cyan-300 rounded-full animate-pulse delay-150" />
                        <span className="w-1.5 h-9 bg-violet-400 rounded-full animate-pulse delay-100" />
                        <span className="w-1.5 h-4 bg-teal-300 rounded-full animate-pulse delay-200" />
                      </div>
                      <span className="text-[11px] font-mono font-semibold text-teal-300 flex items-center gap-1">
                        <Square className="h-3 w-3 fill-current" /> Stop
                      </span>
                    </div>
                  ) : voiceState === 'LISTENING' ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex items-center gap-1.5 h-8">
                        <span className="w-1.5 h-6 bg-emerald-300 rounded-full animate-pulse" />
                        <span className="w-1.5 h-10 bg-teal-400 rounded-full animate-pulse delay-100" />
                        <span className="w-1.5 h-8 bg-cyan-300 rounded-full animate-pulse delay-150" />
                        <span className="w-1.5 h-4 bg-emerald-400 rounded-full animate-pulse delay-75" />
                      </div>
                      <span className="text-[11px] font-mono text-emerald-300">Listening...</span>
                    </div>
                  ) : voiceState === 'PROCESSING' || voiceState === 'VERIFYING' ? (
                    <div className="flex flex-col items-center gap-1.5">
                      <RefreshCw className="h-9 w-9 text-violet-300 animate-spin" />
                      <span className="text-[11px] font-mono text-violet-300">Reasoning</span>
                    </div>
                  ) : voiceState === 'WAITING FOR CONFIRMATION' ? (
                    <div className="flex flex-col items-center gap-1.5">
                      <AlertTriangle className="h-9 w-9 text-amber-300 animate-pulse" />
                      <span className="text-[11px] font-mono text-amber-300">Confirm</span>
                    </div>
                  ) : voiceState === 'WAITING FOR CLARIFICATION' ? (
                    <div className="flex flex-col items-center gap-1.5">
                      <HelpCircle className="h-9 w-9 text-teal-300 animate-pulse" />
                      <span className="text-[11px] font-mono text-teal-300">Clarify</span>
                    </div>
                  ) : voiceState === 'WAITING FOR PERMISSION' ? (
                    <div className="flex flex-col items-center gap-1.5">
                      <KeyRound className="h-9 w-9 text-rose-300 animate-pulse" />
                      <span className="text-[11px] font-mono text-rose-300">Verify</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1.5">
                      <Mic className="h-11 w-11 text-slate-100 group-hover:text-teal-300 transition-colors" />
                      <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">SR</span>
                    </div>
                  )}
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Clear Understated Status Label (Ready, Listening, Processing, Speaking, Error) */}
        <div className="mt-5 flex flex-col items-center">
          <div
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-medium tracking-wide transition-all ${statusInfo.pillClass}`}
          >
            <span className={`h-2 w-2 rounded-full ${statusInfo.dotClass}`} />
            <span>{statusInfo.label}</span>
          </div>

          <p className="text-xs text-slate-400 mt-1.5 max-w-md font-sans">
            {statusInfo.sublabel}
          </p>

          {/* Quick Stop-Speaking Control if SR is actively generating voice */}
          {isSpeaking && (
            <button
              onClick={interruptVoice}
              className="mt-2.5 inline-flex items-center gap-1.5 px-3.5 py-1 rounded-lg bg-teal-500/15 hover:bg-teal-500/25 border border-teal-500/30 text-teal-200 text-xs font-medium transition-all shadow-[0_0_15px_rgba(20,184,166,0.2)]"
            >
              <Square className="h-3 w-3 fill-current" />
              <span>Stop Speaking</span>
            </button>
          )}
        </div>

        {/* Live Voice Transcript / Auto-submitting banner */}
        {transcript && (
          <div className="mt-3.5 w-full max-w-xl p-3.5 rounded-xl border border-teal-500/30 bg-[#0d121a]/90 backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 text-left">
            <div className="flex items-center justify-between text-[11px] font-mono text-teal-400 mb-1">
              <span className="flex items-center gap-1.5 font-semibold">
                <span className="h-1.5 w-1.5 rounded-full bg-teal-400 animate-ping" />
                LIVE TRANSCRIPTION
              </span>
              <span className="text-slate-400 text-[10px]">Auto-submitting when speech ends</span>
            </div>
            <div className="text-sm text-white font-medium break-words">{transcript}</div>
            <div className="flex items-center justify-between gap-2 mt-2.5 pt-2 border-t border-white/5">
              <span className="text-[10px] text-slate-400 font-sans">
                {voiceState === 'LISTENING' ? 'Listening to speech...' : 'Finishing...'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setTranscript('');
                    activeTranscriptRef.current = '';
                  }}
                  className="px-2.5 py-1 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-white/5"
                >
                  Clear
                </button>
                <button
                  onClick={() => autoFinishAndSubmit('manual_execute_click')}
                  className="flex items-center gap-1.5 px-3.5 py-1 rounded-lg bg-teal-500/20 hover:bg-teal-500/30 border border-teal-400/40 text-teal-200 text-xs font-semibold transition-all"
                >
                  <Send className="h-3 w-3" />
                  <span>Send Now</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Clarification prompt banner */}
        {pendingClarificationPrompt && (
          <div className="mt-3 w-full max-w-xl p-4 rounded-xl border border-teal-500/30 bg-teal-950/20 text-left animate-in zoom-in-95">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-teal-500/10 border border-teal-500/30 text-teal-400">
                <HelpCircle className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="text-[10px] uppercase font-mono tracking-wider text-teal-400 font-semibold">
                  Clarification Required
                </div>
                <p className="text-sm text-slate-200 mt-1 font-medium">{pendingClarificationPrompt}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => handleSendMessage('To Alex')}
                    className="px-2.5 py-1 rounded-lg bg-slate-900 border border-white/10 text-xs text-slate-300 hover:text-white hover:border-teal-400"
                  >
                    Alex
                  </button>
                  <button
                    onClick={() => handleSendMessage('To Sarah')}
                    className="px-2.5 py-1 rounded-lg bg-slate-900 border border-white/10 text-xs text-slate-300 hover:text-white hover:border-teal-400"
                  >
                    Sarah
                  </button>
                  <button
                    onClick={() => handleSendMessage('At 8:00 PM')}
                    className="px-2.5 py-1 rounded-lg bg-slate-900 border border-white/10 text-xs text-slate-300 hover:text-white hover:border-teal-400"
                  >
                    At 8:00 PM
                  </button>
                  <button
                    onClick={() => handleSendMessage('Cancel')}
                    className="px-2.5 py-1 rounded-lg bg-slate-900 border border-white/10 text-xs text-rose-400 hover:bg-rose-950/30"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Informative Speech Error Banner */}
        {speechError && (
          <div className="mt-3 max-w-md p-3 rounded-xl border border-amber-500/30 bg-amber-950/20 text-amber-200 text-xs flex items-start gap-2.5 text-left">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
            <div>
              <div className="font-semibold text-amber-300">Notice</div>
              <p className="text-amber-200/80 mt-0.5">{speechError}</p>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      {pendingConfirmation && (
        <div className="w-full max-w-xl my-2 p-4 rounded-xl border border-amber-500/30 bg-[#12161f] shadow-2xl backdrop-blur-xl animate-in zoom-in-95 text-left">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="text-xs uppercase font-mono tracking-wider text-amber-400 font-semibold">
                Action Confirmation Required
              </div>
              <p className="text-sm text-slate-200 mt-1">{pendingConfirmation.message}</p>
              <div className="text-xs text-slate-400 mt-1">
                SR requires explicit authorization before executing external transmissions or system alterations.
              </div>

              <div className="flex items-center justify-end gap-2.5 mt-3.5">
                <button
                  onClick={() => confirmAction(false)}
                  className="px-3 py-1.5 rounded-lg border border-white/10 text-xs text-slate-300 hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  onClick={() => confirmAction(true)}
                  className="px-4 py-1.5 rounded-lg bg-amber-500 text-black text-xs font-semibold hover:bg-amber-400 transition-all shadow-[0_0_15px_rgba(245,158,11,0.3)]"
                >
                  Confirm & Execute
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Security Code Prompt (Code 18) */}
      {securityCodePrompt.active && (
        <div className="w-full max-w-xl my-2 p-4 rounded-xl border border-rose-500/30 bg-[#141219] shadow-2xl backdrop-blur-xl animate-in zoom-in-95 text-left">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400">
              <Lock className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="text-xs uppercase font-mono tracking-wider text-rose-400 font-semibold">
                Protected Vault Verification
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Access to protected confidential resources requires your secret verification code.
              </p>

              <div className="flex items-center gap-2 mt-3">
                <input
                  type="password"
                  value={securityCodeInput}
                  onChange={(e) => setSecurityCodeInput(e.target.value)}
                  placeholder="Enter Security Code (Default: 18)"
                  className="flex-1 px-3 py-1.5 rounded-lg border border-white/15 bg-black/50 text-white text-xs font-mono focus:outline-none focus:border-rose-400"
                />
                <button
                  onClick={handleSecurityCodeSubmit}
                  className="px-3.5 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold transition-all shadow-[0_0_15px_rgba(244,63,94,0.3)]"
                >
                  Verify Code
                </button>
                <button
                  onClick={() => setSecurityCodePrompt({ active: false })}
                  className="p-1.5 text-slate-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Clear Conversation Area with Readable Messages */}
      <div className="w-full max-w-2xl flex-1 overflow-y-auto my-2 space-y-3 max-h-[38vh] pr-1">
        {history.length === 0 ? (
          <div className="text-center py-4">
            <div className="text-xs text-slate-400 uppercase font-mono tracking-wider mb-2.5">
              Suggested Voice Commands
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
              {sampleCommands.map((cmd, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(cmd.text)}
                  className="p-3 rounded-xl border border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.05] hover:border-teal-500/30 transition-all group"
                >
                  <div className="text-xs font-medium text-slate-200 group-hover:text-teal-300 transition-colors">
                    "{cmd.text}"
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{cmd.desc}</div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          history.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl p-3.5 text-sm ${
                  msg.sender === 'user'
                    ? 'bg-gradient-to-r from-teal-950/60 to-slate-900 border border-teal-500/30 text-white rounded-br-sm'
                    : 'sr-glass-card text-slate-100 rounded-bl-sm border border-white/10'
                }`}
              >
                <div className="flex items-center justify-between gap-3 text-[10px] font-mono text-slate-400 mb-1">
                  <span className={msg.sender === 'user' ? 'text-teal-300' : 'text-slate-300 font-semibold'}>
                    {msg.sender === 'user' ? user?.name || 'You' : 'SR'}
                  </span>
                  <span>{msg.timestamp}</span>
                </div>

                <div className="whitespace-pre-wrap leading-relaxed text-slate-100 font-sans">{msg.text}</div>

                {/* Grounding Source citations */}
                {msg.groundingUrls && msg.groundingUrls.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-white/10">
                    <div className="text-[10px] font-mono text-teal-400 flex items-center gap-1 mb-1">
                      <Globe className="h-3 w-3" />
                      <span>Verified Live Grounding Sources</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {msg.groundingUrls.map((u, i) => (
                        <a
                          key={i}
                          href={u.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-teal-950/70 border border-teal-800/40 text-[10px] text-teal-300 hover:text-white transition-colors"
                        >
                          <span className="truncate max-w-[140px]">{u.title}</span>
                          <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Execution status badge */}
                {msg.actionResult && (
                  <div
                    className={`mt-2 flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-mono ${
                      msg.actionResult.status === 'SUCCESS' || msg.actionResult.status === 'COMPLETED'
                        ? 'bg-emerald-950/50 text-emerald-300 border border-emerald-800/50'
                        : msg.actionResult.status === 'NEEDS_NATIVE_UNLOCK'
                        ? 'bg-amber-950/50 text-amber-300 border border-amber-800/50'
                        : msg.actionResult.status === 'DEVICE_OFFLINE'
                        ? 'bg-orange-950/50 text-orange-300 border border-orange-800/50'
                        : msg.actionResult.status === 'CANCELLED'
                        ? 'bg-slate-800 text-slate-300 border border-slate-700'
                        : 'bg-rose-950/50 text-rose-300 border border-rose-800/50'
                    }`}
                  >
                    {msg.actionResult.status === 'SUCCESS' || msg.actionResult.status === 'COMPLETED' ? (
                      <CheckCircle className="h-3 w-3 text-emerald-400" />
                    ) : (
                      <AlertTriangle className="h-3 w-3 text-amber-400" />
                    )}
                    <span>{msg.actionResult.status}</span>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Secondary Text Input Bar */}
      <div className="w-full max-w-2xl mt-auto pt-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="relative flex items-center"
        >
          <input
            type="text"
            value={typedMessage}
            onChange={(e) => setTypedMessage(e.target.value)}
            placeholder="Type command or tap circular microphone above..."
            className="w-full rounded-2xl border border-white/10 bg-[#0e121a]/80 px-4 py-3 pr-24 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/30 backdrop-blur-md transition-all shadow-inner"
          />

          <div className="absolute right-2 flex items-center gap-1.5">
            <button
              type="button"
              onClick={toggleListening}
              className={`p-2 rounded-xl border transition-all ${
                voiceState === 'LISTENING'
                  ? 'border-emerald-400 bg-emerald-500/20 text-emerald-300 animate-pulse'
                  : 'border-white/10 bg-slate-800/60 text-slate-300 hover:text-white hover:border-teal-500/30'
              }`}
              title="Activate Microphone"
            >
              <Mic className="h-4 w-4" />
            </button>

            <button
              type="submit"
              disabled={!typedMessage.trim()}
              className="p-2 rounded-xl bg-teal-500 text-slate-950 hover:bg-teal-400 disabled:opacity-30 disabled:hover:bg-teal-500 transition-all font-semibold"
              title="Send Command"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
