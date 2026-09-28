import {
  User,
  Profile,
  Memory,
  Reminder,
  Device,
  Integration,
  Permission,
  ProtectedResource,
  AuditLog,
  AssistantOutput,
  TestResult,
} from '../types.js';

class ApiService {
  private getToken(): string | null {
    return localStorage.getItem('sr_token');
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(endpoint, {
      ...options,
      headers,
    });

    if (!response.ok) {
      let errorMessage = `HTTP error ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch {
        // use default
      }
      throw new Error(errorMessage);
    }

    return response.json();
  }

  // Auth
  async login(email: string, password: string): Promise<{ user: User; token: string; profile: Profile }> {
    return this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async register(email: string, password: string, name: string, securityCode = '18'): Promise<{ user: User; token: string; profile: Profile }> {
    return this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name, securityCode }),
    });
  }

  async logout(): Promise<void> {
    try {
      await this.request('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    } finally {
      localStorage.removeItem('sr_token');
    }
  }

  async getCurrentUser(): Promise<{ user: User; profile: Profile }> {
    return this.request('/api/auth/me');
  }

  async updateSecurityCode(currentCode: string, newCode: string): Promise<{ success: boolean; message: string }> {
    return this.request('/api/auth/security-code', {
      method: 'POST',
      body: JSON.stringify({ currentCode, newCode }),
    });
  }

  // Assistant Interaction
  async interact(
    message: string,
    options: {
      confirmed?: boolean;
      confirmationPayload?: any;
      securityCode?: string;
      source?: 'voice' | 'chat';
    } = {}
  ): Promise<AssistantOutput> {
    return this.request('/api/assistant/interact', {
      method: 'POST',
      body: JSON.stringify({
        message,
        ...options,
      }),
    });
  }

  // Memories
  async getMemories(search?: string): Promise<Memory[]> {
    const url = search ? `/api/memories?q=${encodeURIComponent(search)}` : '/api/memories';
    return this.request(url);
  }

  async addMemory(content: string, category = 'general'): Promise<Memory> {
    return this.request('/api/memories', {
      method: 'POST',
      body: JSON.stringify({ content, category }),
    });
  }

  async deleteMemory(id: string): Promise<void> {
    await this.request(`/api/memories/${id}`, { method: 'DELETE' });
  }

  async clearMemories(): Promise<void> {
    await this.request('/api/memories/clear', { method: 'POST' });
  }

  // Reminders
  async getReminders(): Promise<Reminder[]> {
    return this.request('/api/reminders');
  }

  async createReminder(text: string, scheduledTime: string, timezone?: string): Promise<Reminder> {
    return this.request('/api/reminders', {
      method: 'POST',
      body: JSON.stringify({ text, scheduledTime, timezone }),
    });
  }

  async updateReminderStatus(id: string, status: Reminder['status']): Promise<void> {
    await this.request(`/api/reminders/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  async deleteReminder(id: string): Promise<void> {
    await this.request(`/api/reminders/${id}`, { method: 'DELETE' });
  }

  // Devices
  async getDevices(): Promise<Device[]> {
    return this.request('/api/devices');
  }

  async updateDeviceStatus(id: string, status: 'online' | 'offline'): Promise<Device> {
    return this.request(`/api/devices/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  async triggerDeviceAction(id: string, action: string, parameters: Record<string, any> = {}): Promise<any> {
    return this.request(`/api/devices/${id}/action`, {
      method: 'POST',
      body: JSON.stringify({ action, parameters }),
    });
  }

  // Integrations
  async getIntegrations(): Promise<Integration[]> {
    return this.request('/api/integrations');
  }

  async updateIntegration(id: string, updates: Partial<Integration>): Promise<Integration> {
    return this.request(`/api/integrations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  // Permissions
  async getPermissions(): Promise<Permission[]> {
    return this.request('/api/permissions');
  }

  async updatePermission(id: string, updates: Partial<Permission>): Promise<Permission> {
    return this.request(`/api/permissions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  // Protected Resources
  async getProtectedResources(): Promise<ProtectedResource[]> {
    return this.request('/api/protected-resources');
  }

  async unlockProtectedResource(resourceId: string, securityCode: string): Promise<any> {
    return this.request('/api/protected-resources/unlock', {
      method: 'POST',
      body: JSON.stringify({ resourceId, securityCode }),
    });
  }

  async addProtectedResource(title: string, resourceType: string, content: string, securityCode: string): Promise<any> {
    return this.request('/api/protected-resources', {
      method: 'POST',
      body: JSON.stringify({ title, resourceType, content, securityCode }),
    });
  }

  // Audit Logs
  async getAuditLogs(): Promise<AuditLog[]> {
    return this.request('/api/audit-logs');
  }

  // Profile
  async updateProfile(updates: Partial<Profile>): Promise<Profile> {
    return this.request('/api/profile', {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  // Automated Tests
  async runAllTests(): Promise<{ summary: { total: number; passed: number; failed: number; durationMs: number }; results: TestResult[] }> {
    return this.request('/api/tests/run-all', { method: 'POST' });
  }

  // Notifications (Req 17)
  async getNotifications(): Promise<any[]> {
    return this.request('/api/notifications');
  }

  async markNotificationRead(id: string): Promise<void> {
    await this.request(`/api/notifications/${id}/read`, { method: 'PATCH' });
  }

  // Unified Search (Req 9)
  async searchContent(query: string): Promise<{ messages: any[]; memories: any[]; reminders: any[] }> {
    return this.request(`/api/search?q=${encodeURIComponent(query)}`);
  }

  // Chat History (Req 1)
  async getChatHistory(limit = 30): Promise<any[]> {
    return this.request(`/api/chat/history?limit=${limit}`);
  }

  // Privacy Dashboard (Req 11)
  async getPrivacyOverview(): Promise<any> {
    return this.request('/api/privacy/overview');
  }

  async revokeOtherSessions(): Promise<void> {
    await this.request('/api/privacy/revoke-sessions', { method: 'POST' });
  }
}

export const api = new ApiService();
