export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface Profile {
  userId: string;
  preferredLanguage: 'en' | 'ur' | 'roman_urdu';
  voicePreference: string;
  timezone: string;
  autoSpeak: boolean;
  requireVoiceConfirmation: boolean;
  responseStyle?: 'concise' | 'detailed' | 'formal' | 'casual';
  wakePhraseEnabled?: boolean;
  frequentActions?: string[];
}

export interface Memory {
  id: string;
  userId: string;
  category: 'general' | 'project' | 'preference' | 'personal' | 'deadline';
  content: string;
  source: 'voice' | 'chat' | 'system';
  createdAt: string;
  updatedAt: string;
}

export interface Reminder {
  id: string;
  userId: string;
  text: string;
  scheduledTime: string;
  timezone: string;
  status: 'pending' | 'triggered' | 'completed' | 'cancelled';
  notificationChannel: 'in_app' | 'browser_push' | 'device';
  createdAt: string;
}

export interface Device {
  id: string;
  userId: string;
  name: string;
  deviceType: 'windows' | 'mobile' | 'agent';
  status: 'online' | 'offline';
  lastSeen: string;
  capabilities: string[];
  pairedToken: string;
}

export interface Integration {
  id: string;
  userId: string;
  service: 'whatsapp' | 'browser' | 'video_editor' | 'calendar' | 'email' | 'cloud_storage';
  name: string;
  status: 'connected' | 'disconnected' | 'locked' | 'unconfigured';
  capabilities: string[];
  requiresNativeUnlock: boolean;
  isLocked: boolean;
  config: Record<string, any>;
}

export interface Permission {
  id: string;
  userId: string;
  category: 'low' | 'medium' | 'high';
  scope: string;
  name: string;
  description: string;
  granted: boolean;
  requiresConfirmation: boolean;
  requiresSecurityCode: boolean;
}

export interface ProtectedResource {
  id: string;
  userId: string;
  title: string;
  resourceType: 'document' | 'credential' | 'financial' | 'note';
  securityLevel: 'high';
  createdAt: string;
  content?: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  deviceId?: string | null;
  actionType: string;
  timestamp: string;
  status: 'SUCCESS' | 'FAILURE' | 'BLOCKED' | 'NEEDS_CONFIRMATION' | 'NEEDS_NATIVE_UNLOCK' | 'UNAVAILABLE';
  details: string;
  permissionContext: string;
}

export interface ActionResult {
  success: boolean;
  status: 'SUCCESS' | 'FAILURE' | 'BLOCKED' | 'NEEDS_CONFIRMATION' | 'NEEDS_NATIVE_UNLOCK' | 'NEEDS_SECURITY_CODE' | 'UNAVAILABLE' | 'DEVICE_OFFLINE' | 'CANCELLED' | 'COMPLETED';
  message: string;
  data?: any;
  requiresConfirmation?: boolean;
  confirmationPayload?: any;
  requiresSecurityCode?: boolean;
}

export interface AssistantOutput {
  reply: string;
  actionResult?: ActionResult;
  detectedLanguage: 'en' | 'ur' | 'roman_urdu';
  groundingUrls?: Array<{ uri: string; title: string }>;
  needsConfirmation?: boolean;
  confirmationPayload?: any;
  needsSecurityCode?: boolean;
  needsClarification?: boolean;
  source: 'voice' | 'chat';
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'reminder' | 'security' | 'action' | 'permission';
  read: boolean;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  userId: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  intent?: string;
  actionResult?: any;
}

export interface PrivacyOverview {
  sessions: Array<{ tokenPreview: string; expiresAt: number; isCurrent: boolean }>;
  metrics: {
    memoriesCount: number;
    devicesCount: number;
    integrationsCount: number;
    permissionsCount: number;
    auditLogsCount: number;
    protectedResourcesCount: number;
  };
}

export type ActionStatusType =
  | 'READY'
  | 'LISTENING'
  | 'PROCESSING'
  | 'WAITING FOR CLARIFICATION'
  | 'WAITING FOR PERMISSION'
  | 'WAITING FOR CONFIRMATION'
  | 'EXECUTING'
  | 'VERIFYING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'UNAVAILABLE';

export interface TestResult {
  id: string;
  name: string;
  category: 'authentication' | 'isolation' | 'memory' | 'reminders' | 'security' | 'actions' | 'integrations' | 'ai_truth';
  passed: boolean;
  expected: string;
  actual: string;
  details: string;
}
