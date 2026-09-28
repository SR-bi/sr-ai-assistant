import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  salt: string;
  securityCodeHash: string; // Hash of security code, default is hash of "18"
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

export interface ChatMessage {
  id: string;
  userId: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  intent?: string;
  actionResult?: any;
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

export interface ReversibleAction {
  userId: string;
  actionType: 'create_reminder' | 'save_memory' | 'rename_file';
  recordId: string;
  data: any;
  description: string;
  timestamp: number;
}

export interface PendingClarification {
  userId: string;
  intent: string;
  missingField: string;
  partialPayload: any;
  question: string;
  timestamp: number;
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
  isLocked: boolean; // e.g. WhatsApp Chat Lock
  config: Record<string, any>;
}

export interface Permission {
  id: string;
  userId: string;
  category: 'low' | 'medium' | 'high';
  scope: string; // 'open_app' | 'open_url' | 'modify_files' | 'access_protected_files' | 'external_messages' | 'device_control'
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
  content: string;
  securityLevel: 'high';
  createdAt: string;
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

interface DatabaseSchema {
  users: User[];
  profiles: Profile[];
  memories: Memory[];
  reminders: Reminder[];
  devices: Device[];
  integrations: Integration[];
  permissions: Permission[];
  protectedResources: ProtectedResource[];
  auditLogs: AuditLog[];
  messages: ChatMessage[];
  notifications: Notification[];
  lastActions: { [userId: string]: ReversibleAction };
  pendingClarifications: { [userId: string]: PendingClarification };
  sessions: { [token: string]: { userId: string; expiresAt: number } };
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'sr_database.json');

class DatabaseService {
  private data: DatabaseSchema;
  private saveTimeout: NodeJS.Timeout | null = null;

  constructor() {
    this.data = {
      users: [],
      profiles: [],
      memories: [],
      reminders: [],
      devices: [],
      integrations: [],
      permissions: [],
      protectedResources: [],
      auditLogs: [],
      messages: [],
      notifications: [],
      lastActions: {},
      pendingClarifications: {},
      sessions: {},
    };
    this.init();
  }

  private init() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        this.data = {
          ...this.data,
          ...parsed,
          messages: parsed.messages || [],
          notifications: parsed.notifications || [],
          lastActions: parsed.lastActions || {},
          pendingClarifications: parsed.pendingClarifications || {},
          sessions: parsed.sessions || {},
        };
      } catch (err) {
        console.error('Failed to parse database file, initializing clean state', err);
        this.seedDefaults();
      }
    } else {
      this.seedDefaults();
    }
  }

  private save() {
    try {
      const tempPath = `${DB_FILE}.tmp.${Date.now()}`;
      fs.writeFileSync(tempPath, JSON.stringify(this.data, null, 2), 'utf-8');
      fs.renameSync(tempPath, DB_FILE);
    } catch (err) {
      console.error('Error persisting database:', err);
    }
  }

  private hashPassword(password: string, salt: string): string {
    return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  }

  public hashSecurityCode(code: string, salt: string): string {
    return crypto.pbkdf2Sync(code.trim(), salt, 5000, 32, 'sha256').toString('hex');
  }

  private seedDefaults() {
    // Create initial Seed Users for instant testing & demonstration
    const saltA = crypto.randomBytes(16).toString('hex');
    const userAId = 'usr_owner_alpha_01';
    const userA: User = {
      id: userAId,
      email: 'alex@sr.ai',
      name: 'Alex Mercer',
      passwordHash: this.hashPassword('password123', saltA),
      salt: saltA,
      securityCodeHash: this.hashSecurityCode('18', saltA), // Default security code 18
      createdAt: new Date().toISOString(),
    };

    const saltB = crypto.randomBytes(16).toString('hex');
    const userBId = 'usr_guest_beta_02';
    const userB: User = {
      id: userBId,
      email: 'sarah@sr.ai',
      name: 'Sarah Connor',
      passwordHash: this.hashPassword('password123', saltB),
      salt: saltB,
      securityCodeHash: this.hashSecurityCode('18', saltB),
      createdAt: new Date().toISOString(),
    };

    this.data.users.push(userA, userB);

    // Seed Profiles
    this.data.profiles.push(
      {
        userId: userAId,
        preferredLanguage: 'en',
        voicePreference: 'Zephyr',
        timezone: 'America/New_York',
        autoSpeak: true,
        requireVoiceConfirmation: false,
      },
      {
        userId: userBId,
        preferredLanguage: 'roman_urdu',
        voicePreference: 'Kore',
        timezone: 'Asia/Karachi',
        autoSpeak: true,
        requireVoiceConfirmation: true,
      }
    );

    // Seed User A's baseline data
    this.data.memories.push(
      {
        id: 'mem_1',
        userId: userAId,
        category: 'project',
        content: 'Project deadline is October 10 at 5:00 PM EST.',
        source: 'voice',
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        updatedAt: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: 'mem_2',
        userId: userAId,
        category: 'preference',
        content: 'Prefers dark mode, coffee with oat milk, and concise audio summaries.',
        source: 'chat',
        createdAt: new Date(Date.now() - 7200000).toISOString(),
        updatedAt: new Date(Date.now() - 7200000).toISOString(),
      }
    );

    // Seed User A's devices
    this.data.devices.push({
      id: 'dev_win_laptop_a',
      userId: userAId,
      name: 'ThinkPad X1 Carbon (Windows 11)',
      deviceType: 'windows',
      status: 'online',
      lastSeen: new Date().toISOString(),
      capabilities: ['open_app', 'open_url', 'create_note', 'system_status', 'rename_file'],
      pairedToken: 'srv_tok_' + crypto.randomBytes(8).toString('hex'),
    });

    // Seed User A's Integrations
    this.data.integrations.push(
      {
        id: 'int_wa_a',
        userId: userAId,
        service: 'whatsapp',
        name: 'WhatsApp Desktop Companion',
        status: 'connected',
        capabilities: ['send_message', 'read_receipts'],
        requiresNativeUnlock: true,
        isLocked: true, // Native chat lock active by default to protect user privacy
        config: { phoneNumber: '+1 (555) 019-2831' },
      },
      {
        id: 'int_ve_a',
        userId: userAId,
        service: 'video_editor',
        name: 'DaVinci Resolve / Premiere Suite',
        status: 'connected',
        capabilities: ['open_editor', 'mute_clip', 'cut_clip'], // Notice: filter changing is unsupported
        requiresNativeUnlock: false,
        isLocked: false,
        config: { version: '2026.2' },
      },
      {
        id: 'int_br_a',
        userId: userAId,
        service: 'browser',
        name: 'Google Chrome / Edge Workstation',
        status: 'connected',
        capabilities: ['open_url', 'search_tabs', 'bookmark'],
        requiresNativeUnlock: false,
        isLocked: false,
        config: { defaultEngine: 'Google' },
      }
    );

    // Seed Permissions
    const standardPerms = [
      { category: 'low' as const, scope: 'open_app', name: 'Open Allowed Applications', description: 'Launch verified system applications', granted: true, requiresConfirmation: false, requiresSecurityCode: false },
      { category: 'low' as const, scope: 'open_url', name: 'Open Web Links', description: 'Open requested URLs in default browser', granted: true, requiresConfirmation: false, requiresSecurityCode: false },
      { category: 'medium' as const, scope: 'modify_files', name: 'Modify Permitted Files', description: 'Rename or edit authorized user notes and files', granted: true, requiresConfirmation: true, requiresSecurityCode: false },
      { category: 'high' as const, scope: 'access_protected_files', name: 'Access Protected & Secret Resources', description: 'Decrypt and read high-security confidential files', granted: true, requiresConfirmation: true, requiresSecurityCode: true },
      { category: 'high' as const, scope: 'external_messages', name: 'Send External Messages', description: 'Transmit messages through WhatsApp or messaging services', granted: true, requiresConfirmation: true, requiresSecurityCode: false },
      { category: 'high' as const, scope: 'device_control', name: 'Laptop / System Commands', description: 'Execute privileged hardware or companion commands', granted: true, requiresConfirmation: false, requiresSecurityCode: false },
    ];

    for (const p of standardPerms) {
      this.data.permissions.push({
        id: `perm_${userAId}_${p.scope}`,
        userId: userAId,
        ...p,
      });
      this.data.permissions.push({
        id: `perm_${userBId}_${p.scope}`,
        userId: userBId,
        ...p,
      });
    }

    // Seed Protected Resources (Secret Files) for User A
    this.data.protectedResources.push({
      id: 'sec_res_a1',
      userId: userAId,
      title: 'Project Obsidian - Executive Master Keys & Server Manifest',
      resourceType: 'credential',
      content: 'CONFIDENTIAL: Production cluster token sha256:7f01c9a8bb4... Emergency failover IP: 10.142.8.19. Primary master key verified under security code protocol 18.',
      securityLevel: 'high',
      createdAt: new Date(Date.now() - 86400000).toISOString(),
    });

    // Seed User B's baseline isolated memory & resource (NEVER accessible to User A)
    this.data.memories.push({
      id: 'mem_user_b_private',
      userId: userBId,
      category: 'personal',
      content: 'Sarah Connor secret safe combination is Alpha-99-Beta.',
      source: 'chat',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    this.data.protectedResources.push({
      id: 'sec_res_b1',
      userId: userBId,
      title: 'Sarah Connor Secret Mission Notes',
      resourceType: 'document',
      content: 'TOP SECRET CONNOR: Cyberdyne audit logs and escape route waypoint 42.',
      securityLevel: 'high',
      createdAt: new Date().toISOString(),
    });

    this.save();
  }

  // --- Auth Methods ---
  public createUser(email: string, password: string, name: string, securityCode = '18'): { user: User; token: string } {
    const normalizedEmail = email.trim().toLowerCase();
    const existing = this.data.users.find((u) => u.email === normalizedEmail);
    if (existing) {
      throw new Error('An account with this email address already exists.');
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const newUser: User = {
      id: 'usr_' + crypto.randomBytes(8).toString('hex'),
      email: normalizedEmail,
      name: name.trim(),
      passwordHash: this.hashPassword(password, salt),
      salt,
      securityCodeHash: this.hashSecurityCode(securityCode || '18', salt),
      createdAt: new Date().toISOString(),
    };

    this.data.users.push(newUser);

    // Create default profile
    this.data.profiles.push({
      userId: newUser.id,
      preferredLanguage: 'en',
      voicePreference: 'Zephyr',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      autoSpeak: true,
      requireVoiceConfirmation: false,
    });

    // Create default permissions
    const standardPerms = [
      { category: 'low' as const, scope: 'open_app', name: 'Open Allowed Applications', description: 'Launch verified system applications', granted: true, requiresConfirmation: false, requiresSecurityCode: false },
      { category: 'low' as const, scope: 'open_url', name: 'Open Web Links', description: 'Open requested URLs in default browser', granted: true, requiresConfirmation: false, requiresSecurityCode: false },
      { category: 'medium' as const, scope: 'modify_files', name: 'Modify Permitted Files', description: 'Rename or edit authorized user notes and files', granted: true, requiresConfirmation: true, requiresSecurityCode: false },
      { category: 'high' as const, scope: 'access_protected_files', name: 'Access Protected & Secret Resources', description: 'Decrypt and read high-security confidential files', granted: true, requiresConfirmation: true, requiresSecurityCode: true },
      { category: 'high' as const, scope: 'external_messages', name: 'Send External Messages', description: 'Transmit messages through WhatsApp or messaging services', granted: true, requiresConfirmation: true, requiresSecurityCode: false },
      { category: 'high' as const, scope: 'device_control', name: 'Laptop / System Commands', description: 'Execute privileged hardware or companion commands', granted: true, requiresConfirmation: false, requiresSecurityCode: false },
    ];

    for (const p of standardPerms) {
      this.data.permissions.push({
        id: `perm_${newUser.id}_${p.scope}`,
        userId: newUser.id,
        ...p,
      });
    }

    // Default sample device
    this.data.devices.push({
      id: 'dev_' + crypto.randomBytes(6).toString('hex'),
      userId: newUser.id,
      name: 'Authorized Windows Laptop',
      deviceType: 'windows',
      status: 'online',
      lastSeen: new Date().toISOString(),
      capabilities: ['open_app', 'open_url', 'create_note', 'system_status', 'rename_file'],
      pairedToken: 'srv_tok_' + crypto.randomBytes(8).toString('hex'),
    });

    // Default integrations
    this.data.integrations.push(
      {
        id: 'int_wa_' + crypto.randomBytes(6).toString('hex'),
        userId: newUser.id,
        service: 'whatsapp',
        name: 'WhatsApp Companion',
        status: 'connected',
        capabilities: ['send_message', 'read_receipts'],
        requiresNativeUnlock: true,
        isLocked: true,
        config: {},
      },
      {
        id: 'int_br_' + crypto.randomBytes(6).toString('hex'),
        userId: newUser.id,
        service: 'browser',
        name: 'Default Web Browser',
        status: 'connected',
        capabilities: ['open_url', 'search_tabs'],
        requiresNativeUnlock: false,
        isLocked: false,
        config: {},
      },
      {
        id: 'int_ve_' + crypto.randomBytes(6).toString('hex'),
        userId: newUser.id,
        service: 'video_editor',
        name: 'Video Suite Companion',
        status: 'connected',
        capabilities: ['open_editor', 'mute_clip', 'cut_clip'],
        requiresNativeUnlock: false,
        isLocked: false,
        config: {},
      }
    );

    const token = this.createSession(newUser.id);
    this.save();
    return { user: newUser, token };
  }

  public authenticate(email: string, password: string): { user: User; token: string } {
    const normalizedEmail = email.trim().toLowerCase();
    const user = this.data.users.find((u) => u.email === normalizedEmail);
    if (!user) {
      throw new Error('Invalid email or password.');
    }

    const testHash = this.hashPassword(password, user.salt);
    if (testHash !== user.passwordHash) {
      throw new Error('Invalid email or password.');
    }

    const token = this.createSession(user.id);
    this.save();
    return { user, token };
  }

  public createSession(userId: string): string {
    const token = 'sr_sess_' + crypto.randomBytes(24).toString('hex');
    const expiresAt = Date.now() + 1000 * 60 * 60 * 24 * 7; // 7 days
    this.data.sessions[token] = { userId, expiresAt };
    return token;
  }

  public validateSession(token: string | undefined): User | null {
    if (!token) return null;
    const session = this.data.sessions[token];
    if (!session) return null;
    if (Date.now() > session.expiresAt) {
      delete this.data.sessions[token];
      return null;
    }
    const user = this.data.users.find((u) => u.id === session.userId);
    return user || null;
  }

  public revokeSession(token: string) {
    if (token && this.data.sessions[token]) {
      delete this.data.sessions[token];
      this.save();
    }
  }

  public verifySecurityCode(userId: string, code: string): boolean {
    const user = this.data.users.find((u) => u.id === userId);
    if (!user) return false;
    const testHash = this.hashSecurityCode(code, user.salt);
    return testHash === user.securityCodeHash;
  }

  public updateSecurityCode(userId: string, currentCode: string, newCode: string): boolean {
    if (!this.verifySecurityCode(userId, currentCode)) {
      return false;
    }
    const user = this.data.users.find((u) => u.id === userId);
    if (!user) return false;
    user.securityCodeHash = this.hashSecurityCode(newCode, user.salt);
    this.save();
    return true;
  }

  // --- Strict User-Isolated Accessors ---
  public getProfile(userId: string): Profile | null {
    return this.data.profiles.find((p) => p.userId === userId) || null;
  }

  public updateProfile(userId: string, updates: Partial<Profile>): Profile {
    let p = this.data.profiles.find((item) => item.userId === userId);
    if (!p) {
      p = {
        userId,
        preferredLanguage: 'en',
        voicePreference: 'Zephyr',
        timezone: 'UTC',
        autoSpeak: true,
        requireVoiceConfirmation: false,
      };
      this.data.profiles.push(p);
    }
    Object.assign(p, updates);
    this.save();
    return p;
  }

  public getMemories(userId: string, search?: string): Memory[] {
    let list = this.data.memories.filter((m) => m.userId === userId);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((m) => m.content.toLowerCase().includes(q) || m.category.toLowerCase().includes(q));
    }
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public addMemory(userId: string, content: string, category: Memory['category'] = 'general', source: Memory['source'] = 'chat'): Memory {
    const mem: Memory = {
      id: 'mem_' + crypto.randomBytes(6).toString('hex'),
      userId,
      category,
      content: content.trim(),
      source,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.data.memories.push(mem);
    this.save();
    return mem;
  }

  public deleteMemory(userId: string, memoryId: string): boolean {
    const index = this.data.memories.findIndex((m) => m.id === memoryId && m.userId === userId);
    if (index === -1) return false;
    this.data.memories.splice(index, 1);
    this.save();
    return true;
  }

  public clearMemories(userId: string): void {
    this.data.memories = this.data.memories.filter((m) => m.userId !== userId);
    this.save();
  }

  // Reminders
  public getReminders(userId: string): Reminder[] {
    return this.data.reminders
      .filter((r) => r.userId === userId)
      .sort((a, b) => new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime());
  }

  public createReminder(userId: string, text: string, scheduledTime: string, timezone = 'UTC'): Reminder {
    const rem: Reminder = {
      id: 'rem_' + crypto.randomBytes(6).toString('hex'),
      userId,
      text: text.trim(),
      scheduledTime,
      timezone,
      status: 'pending',
      notificationChannel: 'in_app',
      createdAt: new Date().toISOString(),
    };
    this.data.reminders.push(rem);
    this.save();
    return rem;
  }

  public updateReminderStatus(userId: string, reminderId: string, status: Reminder['status']): boolean {
    const reminder = this.data.reminders.find((r) => r.id === reminderId && r.userId === userId);
    if (!reminder) return false;
    reminder.status = status;
    this.save();
    return true;
  }

  public deleteReminder(userId: string, reminderId: string): boolean {
    const index = this.data.reminders.findIndex((r) => r.id === reminderId && r.userId === userId);
    if (index === -1) return false;
    this.data.reminders.splice(index, 1);
    this.save();
    return true;
  }

  public getPendingDueReminders(): Reminder[] {
    const now = new Date();
    return this.data.reminders.filter((r) => r.status === 'pending' && new Date(r.scheduledTime) <= now);
  }

  public markReminderTriggered(reminderId: string) {
    const r = this.data.reminders.find((item) => item.id === reminderId);
    if (r) {
      r.status = 'triggered';
      this.save();
    }
  }

  // Devices
  public getDevices(userId: string): Device[] {
    return this.data.devices.filter((d) => d.userId === userId);
  }

  public updateDeviceStatus(userId: string, deviceId: string, status: 'online' | 'offline'): Device | null {
    const dev = this.data.devices.find((d) => d.id === deviceId && d.userId === userId);
    if (!dev) return null;
    dev.status = status;
    dev.lastSeen = new Date().toISOString();
    this.save();
    return dev;
  }

  public addDevice(userId: string, name: string, deviceType: Device['deviceType']): Device {
    const dev: Device = {
      id: 'dev_' + crypto.randomBytes(6).toString('hex'),
      userId,
      name,
      deviceType,
      status: 'online',
      lastSeen: new Date().toISOString(),
      capabilities: ['open_app', 'open_url', 'create_note', 'system_status', 'rename_file'],
      pairedToken: 'srv_tok_' + crypto.randomBytes(8).toString('hex'),
    };
    this.data.devices.push(dev);
    this.save();
    return dev;
  }

  // Integrations
  public getIntegrations(userId: string): Integration[] {
    return this.data.integrations.filter((i) => i.userId === userId);
  }

  public updateIntegration(userId: string, integrationId: string, updates: Partial<Integration>): Integration | null {
    const item = this.data.integrations.find((i) => i.id === integrationId && i.userId === userId);
    if (!item) return null;
    Object.assign(item, updates);
    this.save();
    return item;
  }

  // Permissions
  public getPermissions(userId: string): Permission[] {
    return this.data.permissions.filter((p) => p.userId === userId);
  }

  public updatePermission(userId: string, permissionId: string, updates: Partial<Permission>): Permission | null {
    const p = this.data.permissions.find((item) => item.id === permissionId && item.userId === userId);
    if (!p) return null;
    Object.assign(p, updates);
    this.save();
    return p;
  }

  // Protected Resources
  public getProtectedResources(userId: string): Array<Omit<ProtectedResource, 'content'> & { hasContent: boolean }> {
    return this.data.protectedResources
      .filter((r) => r.userId === userId)
      .map((r) => ({
        id: r.id,
        userId: r.userId,
        title: r.title,
        resourceType: r.resourceType,
        securityLevel: r.securityLevel,
        createdAt: r.createdAt,
        hasContent: true,
      }));
  }

  public getProtectedResourceWithVerification(userId: string, resourceId: string, securityCode: string): ProtectedResource | null {
    if (!this.verifySecurityCode(userId, securityCode)) {
      return null;
    }
    const res = this.data.protectedResources.find((r) => r.id === resourceId && r.userId === userId);
    return res || null;
  }

  public addProtectedResource(userId: string, title: string, resourceType: ProtectedResource['resourceType'], content: string): ProtectedResource {
    const res: ProtectedResource = {
      id: 'sec_res_' + crypto.randomBytes(6).toString('hex'),
      userId,
      title: title.trim(),
      resourceType,
      content: content.trim(),
      securityLevel: 'high',
      createdAt: new Date().toISOString(),
    };
    this.data.protectedResources.push(res);
    this.save();
    return res;
  }

  // Audit Logs
  public getAuditLogs(userId: string, limit = 100): AuditLog[] {
    return this.data.auditLogs
      .filter((l) => l.userId === userId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  public addAuditLog(
    userId: string,
    actionType: string,
    status: AuditLog['status'],
    details: string,
    permissionContext: string,
    deviceId?: string | null
  ): AuditLog {
    const log: AuditLog = {
      id: 'log_' + crypto.randomBytes(6).toString('hex'),
      userId,
      deviceId: deviceId || null,
      actionType,
      timestamp: new Date().toISOString(),
      status,
      details,
      permissionContext,
    };
    this.data.auditLogs.push(log);
    // Keep max 2000 logs total
    if (this.data.auditLogs.length > 2000) {
      this.data.auditLogs = this.data.auditLogs.slice(-1500);
    }
    this.save();
    return log;
  }

  // --- Conversation Context & Message History ---
  public addChatMessage(
    userId: string,
    role: 'user' | 'assistant',
    text: string,
    intent?: string,
    actionResult?: any
  ): ChatMessage {
    const msg: ChatMessage = {
      id: 'msg_' + crypto.randomBytes(6).toString('hex'),
      userId,
      role,
      text: text.trim(),
      timestamp: new Date().toISOString(),
      intent,
      actionResult,
    };
    this.data.messages.push(msg);
    // Keep max 500 messages per user to bound storage
    const userMsgCount = this.data.messages.filter((m) => m.userId === userId).length;
    if (userMsgCount > 500) {
      const firstIdx = this.data.messages.findIndex((m) => m.userId === userId);
      if (firstIdx !== -1) this.data.messages.splice(firstIdx, 1);
    }
    this.save();
    return msg;
  }

  public getChatHistory(userId: string, limit = 25): ChatMessage[] {
    return this.data.messages
      .filter((m) => m.userId === userId)
      .slice(-limit);
  }

  public searchChatHistory(userId: string, query: string): ChatMessage[] {
    const q = query.toLowerCase().trim();
    if (!q) return [];
    return this.data.messages
      .filter((m) => m.userId === userId && m.text.toLowerCase().includes(q))
      .slice(-20);
  }

  // --- Notifications Architecture ---
  public getNotifications(userId: string): Notification[] {
    return this.data.notifications
      .filter((n) => n.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public addNotification(
    userId: string,
    title: string,
    message: string,
    type: Notification['type']
  ): Notification {
    const notif: Notification = {
      id: 'notif_' + crypto.randomBytes(6).toString('hex'),
      userId,
      title,
      message,
      type,
      read: false,
      createdAt: new Date().toISOString(),
    };
    this.data.notifications.push(notif);
    this.save();
    return notif;
  }

  public markNotificationRead(userId: string, id: string): boolean {
    const n = this.data.notifications.find((item) => item.id === id && item.userId === userId);
    if (!n) return false;
    n.read = true;
    this.save();
    return true;
  }

  // --- Reversible Action Tracker (Undo) ---
  public setLastAction(userId: string, action: ReversibleAction) {
    this.data.lastActions[userId] = action;
    this.save();
  }

  public getLastAction(userId: string): ReversibleAction | null {
    return this.data.lastActions[userId] || null;
  }

  public clearLastAction(userId: string) {
    delete this.data.lastActions[userId];
    this.save();
  }

  // --- Pending Clarification Tracker ---
  public setPendingClarification(userId: string, clarification: PendingClarification) {
    this.data.pendingClarifications[userId] = clarification;
    this.save();
  }

  public getPendingClarification(userId: string): PendingClarification | null {
    const c = this.data.pendingClarifications[userId];
    if (!c) return null;
    // Expire clarifications older than 5 minutes
    if (Date.now() - c.timestamp > 5 * 60 * 1000) {
      delete this.data.pendingClarifications[userId];
      this.save();
      return null;
    }
    return c;
  }

  public clearPendingClarification(userId: string) {
    delete this.data.pendingClarifications[userId];
    this.save();
  }

  // --- Unified Conversation & Content Search (Req 9) ---
  public searchUserContent(userId: string, query: string) {
    const q = query.toLowerCase().trim();
    if (!q) return { messages: [], memories: [], reminders: [] };

    const messages = this.data.messages
      .filter((m) => m.userId === userId && m.text.toLowerCase().includes(q))
      .slice(-10);

    const memories = this.data.memories
      .filter((m) => m.userId === userId && (m.content.toLowerCase().includes(q) || m.category.toLowerCase().includes(q)))
      .slice(-10);

    const reminders = this.data.reminders
      .filter((r) => r.userId === userId && r.text.toLowerCase().includes(q))
      .slice(-10);

    return { messages, memories, reminders };
  }

  // --- Privacy Sessions (Req 11) ---
  public getUserActiveSessions(userId: string): Array<{ tokenPreview: string; expiresAt: number; isCurrent: boolean }> {
    const list: Array<{ tokenPreview: string; expiresAt: number; isCurrent: boolean }> = [];
    const now = Date.now();
    for (const [tok, s] of Object.entries(this.data.sessions)) {
      if (s.userId === userId && s.expiresAt > now) {
        list.push({
          tokenPreview: `${tok.slice(0, 10)}...${tok.slice(-4)}`,
          expiresAt: s.expiresAt,
          isCurrent: false, // caller will flag current
        });
      }
    }
    return list;
  }

  public revokeOtherSessions(userId: string, currentToken: string) {
    for (const [tok, s] of Object.entries(this.data.sessions)) {
      if (s.userId === userId && tok !== currentToken) {
        delete this.data.sessions[tok];
      }
    }
    this.save();
  }
}

export const db = new DatabaseService();
