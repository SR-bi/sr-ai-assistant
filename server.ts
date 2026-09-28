import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { db, User } from './server/db.js';
import { actionExecutor } from './server/actions.js';
import { assistantService } from './server/ai.js';
import { AutomatedTestSuite } from './server/tests-runner.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Extend Express Request to include authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: User;
      token?: string;
    }
  }
}

// Authentication Middleware
const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : (req.headers['x-sr-token'] as string);

  if (!token) {
    res.status(401).json({ error: 'Authentication required. No session token provided.' });
    return;
  }

  const user = db.validateSession(token);
  if (!user) {
    res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
    return;
  }

  req.user = user;
  req.token = token;
  next();
};

// Optional auth middleware (for endpoints that can behave differently if logged in)
const optionalAuth = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : (req.headers['x-sr-token'] as string);
  if (token) {
    const user = db.validateSession(token);
    if (user) {
      req.user = user;
      req.token = token;
    }
  }
  next();
};

// ================= API ROUTES =================

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'operational',
    service: 'SR Core Engine',
    timestamp: new Date().toISOString(),
    geminiConfigured: !!process.env.GEMINI_API_KEY,
  });
});

// --- Auth Routes ---
app.post('/api/auth/register', (req, res) => {
  try {
    const { email, password, name, securityCode } = req.body;
    if (!email || !password || !name) {
      res.status(400).json({ error: 'Email, password, and full name are required.' });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters long.' });
      return;
    }

    const { user, token } = db.createUser(email, password, name, securityCode || '18');
    const profile = db.getProfile(user.id);

    // Sanitize user
    const { passwordHash, salt, securityCodeHash, ...safeUser } = user;
    res.status(201).json({ user: safeUser, token, profile });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Registration failed.' });
  }
});

app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const { user, token } = db.authenticate(email, password);
    const profile = db.getProfile(user.id);
    const { passwordHash, salt, securityCodeHash, ...safeUser } = user;
    res.json({ user: safeUser, token, profile });
  } catch (err: any) {
    res.status(401).json({ error: err.message || 'Invalid credentials.' });
  }
});

app.post('/api/auth/logout', authenticateToken, (req, res) => {
  if (req.token) {
    db.revokeSession(req.token);
  }
  res.json({ success: true, message: 'Session logged out.' });
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  const user = req.user!;
  const profile = db.getProfile(user.id);
  const { passwordHash, salt, securityCodeHash, ...safeUser } = user;
  res.json({ user: safeUser, profile });
});

app.post('/api/auth/security-code', authenticateToken, (req, res) => {
  const { currentCode, newCode } = req.body;
  if (!currentCode || !newCode) {
    res.status(400).json({ error: 'Both currentCode and newCode are required.' });
    return;
  }
  const success = db.updateSecurityCode(req.user!.id, currentCode, newCode);
  if (!success) {
    res.status(403).json({ error: 'Current security code is incorrect.' });
    return;
  }
  res.json({ success: true, message: 'Security verification code updated successfully.' });
});

// --- Assistant / Interaction Routes ---
app.post('/api/assistant/interact', authenticateToken, async (req, res) => {
  try {
    const { message, confirmed, confirmationPayload, securityCode, source = 'chat' } = req.body;
    if (!message && !confirmed) {
      res.status(400).json({ error: 'Message content is required.' });
      return;
    }

    const output = await assistantService.processMessage({
      user: req.user!,
      message,
      confirmed,
      confirmationPayload,
      securityCode,
      source,
    });

    res.json(output);
  } catch (err: any) {
    console.error('Error processing assistant interaction:', err);
    res.status(500).json({
      error: 'An internal error occurred while processing your request.',
      details: err.message,
    });
  }
});

// --- Memories Routes ---
app.get('/api/memories', authenticateToken, (req, res) => {
  const q = req.query.q as string | undefined;
  const memories = db.getMemories(req.user!.id, q);
  res.json(memories);
});

app.post('/api/memories', authenticateToken, (req, res) => {
  const { content, category = 'general' } = req.body;
  if (!content || !content.trim()) {
    res.status(400).json({ error: 'Memory content cannot be empty.' });
    return;
  }
  const mem = db.addMemory(req.user!.id, content, category, 'chat');
  db.addAuditLog(req.user!.id, 'add_memory', 'SUCCESS', `Added memory: "${content}"`, 'manual_entry');
  res.status(201).json(mem);
});

app.delete('/api/memories/:id', authenticateToken, (req, res) => {
  const success = db.deleteMemory(req.user!.id, req.params.id);
  if (!success) {
    res.status(404).json({ error: 'Memory not found or unauthorized.' });
    return;
  }
  db.addAuditLog(req.user!.id, 'delete_memory', 'SUCCESS', `Deleted memory ID ${req.params.id}`, 'manual_entry');
  res.json({ success: true });
});

app.post('/api/memories/clear', authenticateToken, (req, res) => {
  db.clearMemories(req.user!.id);
  db.addAuditLog(req.user!.id, 'clear_memories', 'SUCCESS', 'Cleared all user memories', 'manual_entry');
  res.json({ success: true });
});

// --- Reminders Routes ---
app.get('/api/reminders', authenticateToken, (req, res) => {
  const reminders = db.getReminders(req.user!.id);
  res.json(reminders);
});

app.post('/api/reminders', authenticateToken, (req, res) => {
  const { text, scheduledTime, timezone } = req.body;
  if (!text || !scheduledTime) {
    res.status(400).json({ error: 'Reminder text and scheduledTime are required.' });
    return;
  }
  const rem = db.createReminder(req.user!.id, text, scheduledTime, timezone || 'UTC');
  db.addAuditLog(req.user!.id, 'create_reminder', 'SUCCESS', `Scheduled reminder "${text}" for ${scheduledTime}`, 'manual_entry');
  res.status(201).json(rem);
});

app.patch('/api/reminders/:id/status', authenticateToken, (req, res) => {
  const { status } = req.body;
  const success = db.updateReminderStatus(req.user!.id, req.params.id, status);
  if (!success) {
    res.status(404).json({ error: 'Reminder not found or unauthorized.' });
    return;
  }
  res.json({ success: true });
});

app.delete('/api/reminders/:id', authenticateToken, (req, res) => {
  const success = db.deleteReminder(req.user!.id, req.params.id);
  if (!success) {
    res.status(404).json({ error: 'Reminder not found or unauthorized.' });
    return;
  }
  res.json({ success: true });
});

// --- Devices Routes ---
app.get('/api/devices', authenticateToken, (req, res) => {
  const devices = db.getDevices(req.user!.id);
  res.json(devices);
});

app.post('/api/devices', authenticateToken, (req, res) => {
  const { name, deviceType } = req.body;
  if (!name || !deviceType) {
    res.status(400).json({ error: 'Device name and type are required.' });
    return;
  }
  const device = db.addDevice(req.user!.id, name, deviceType);
  db.addAuditLog(req.user!.id, 'pair_device', 'SUCCESS', `Paired new device: ${name} (${deviceType})`, 'device_management');
  res.status(201).json(device);
});

app.patch('/api/devices/:id/status', authenticateToken, (req, res) => {
  const { status } = req.body;
  if (status !== 'online' && status !== 'offline') {
    res.status(400).json({ error: 'Status must be online or offline.' });
    return;
  }
  const updated = db.updateDeviceStatus(req.user!.id, req.params.id, status);
  if (!updated) {
    res.status(404).json({ error: 'Device not found or unauthorized.' });
    return;
  }
  db.addAuditLog(req.user!.id, 'device_status_change', 'SUCCESS', `Device '${updated.name}' set to ${status}`, 'device_management', updated.id);
  res.json(updated);
});

app.post('/api/devices/:id/action', authenticateToken, async (req, res) => {
  const { action, parameters, confirmed } = req.body;
  const result = await actionExecutor.executeAction(req.user!, {
    action,
    parameters: parameters || {},
    confirmed,
    deviceId: req.params.id,
  });
  res.json(result);
});

// --- Integrations Routes ---
app.get('/api/integrations', authenticateToken, (req, res) => {
  const integrations = db.getIntegrations(req.user!.id);
  res.json(integrations);
});

app.patch('/api/integrations/:id', authenticateToken, (req, res) => {
  const { isLocked, status, config } = req.body;
  const updated = db.updateIntegration(req.user!.id, req.params.id, { isLocked, status, config });
  if (!updated) {
    res.status(404).json({ error: 'Integration not found or unauthorized.' });
    return;
  }
  db.addAuditLog(req.user!.id, 'integration_updated', 'SUCCESS', `Updated integration: ${updated.name} (locked: ${updated.isLocked}, status: ${updated.status})`, 'integration_management');
  res.json(updated);
});

// --- Permissions Routes ---
app.get('/api/permissions', authenticateToken, (req, res) => {
  const perms = db.getPermissions(req.user!.id);
  res.json(perms);
});

app.patch('/api/permissions/:id', authenticateToken, (req, res) => {
  const { granted, requiresConfirmation, requiresSecurityCode } = req.body;
  const updated = db.updatePermission(req.user!.id, req.params.id, {
    granted,
    requiresConfirmation,
    requiresSecurityCode,
  });
  if (!updated) {
    res.status(404).json({ error: 'Permission not found or unauthorized.' });
    return;
  }
  db.addAuditLog(req.user!.id, 'permission_modified', 'SUCCESS', `Modified permission '${updated.scope}' (granted: ${updated.granted})`, 'permission_system');
  res.json(updated);
});

// --- Protected Resources Routes ---
app.get('/api/protected-resources', authenticateToken, (req, res) => {
  const list = db.getProtectedResources(req.user!.id);
  res.json(list);
});

app.post('/api/protected-resources', authenticateToken, (req, res) => {
  const { title, resourceType, content, securityCode } = req.body;
  if (!title || !content) {
    res.status(400).json({ error: 'Title and content are required.' });
    return;
  }
  // Verify security code before adding high-security items
  if (!db.verifySecurityCode(req.user!.id, securityCode || '18')) {
    res.status(403).json({ error: 'Invalid security code. Cannot store protected resource.' });
    return;
  }
  const item = db.addProtectedResource(req.user!.id, title, resourceType || 'document', content);
  db.addAuditLog(req.user!.id, 'create_protected_resource', 'SUCCESS', `Added protected resource: ${title}`, 'vault_management');
  res.status(201).json({ id: item.id, title: item.title, resourceType: item.resourceType, securityLevel: item.securityLevel, createdAt: item.createdAt });
});

app.post('/api/protected-resources/unlock', authenticateToken, (req, res) => {
  const { resourceId, securityCode } = req.body;
  if (!resourceId || !securityCode) {
    res.status(400).json({ error: 'resourceId and securityCode are required.' });
    return;
  }

  const result = actionExecutor.executeAction(req.user!, {
    action: 'access_protected_resource',
    parameters: { resourceId },
    securityCode,
  });

  result.then((actionRes) => {
    if (!actionRes.success) {
      const statusCode = actionRes.status === 'BLOCKED' ? 403 : 400;
      res.status(statusCode).json(actionRes);
      return;
    }
    res.json(actionRes);
  });
});

// --- Audit Logs Routes ---
app.get('/api/audit-logs', authenticateToken, (req, res) => {
  const logs = db.getAuditLogs(req.user!.id, 150);
  res.json(logs);
});

// --- Profile Routes ---
app.get('/api/profile', authenticateToken, (req, res) => {
  const p = db.getProfile(req.user!.id);
  res.json(p);
});

app.patch('/api/profile', authenticateToken, (req, res) => {
  const updated = db.updateProfile(req.user!.id, req.body);
  res.json(updated);
});

// --- Notifications Routes (Req 17) ---
app.get('/api/notifications', authenticateToken, (req, res) => {
  const list = db.getNotifications(req.user!.id);
  res.json(list);
});

app.patch('/api/notifications/:id/read', authenticateToken, (req, res) => {
  const success = db.markNotificationRead(req.user!.id, req.params.id);
  res.json({ success });
});

// --- Unified Search Route (Req 9) ---
app.get('/api/search', authenticateToken, (req, res) => {
  const q = req.query.q as string || '';
  const results = db.searchUserContent(req.user!.id, q);
  res.json(results);
});

// --- Chat History Route (Req 1) ---
app.get('/api/chat/history', authenticateToken, (req, res) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 30;
  const history = db.getChatHistory(req.user!.id, limit);
  res.json(history);
});

// --- Privacy Transparency Dashboard Routes (Req 11) ---
app.get('/api/privacy/overview', authenticateToken, (req, res) => {
  const userId = req.user!.id;
  const sessions = db.getUserActiveSessions(userId);
  const currentToken = req.token || '';
  const flaggedSessions = sessions.map((s) => ({
    ...s,
    isCurrent: currentToken.startsWith(s.tokenPreview.slice(0, 8)),
  }));

  const memoriesCount = db.getMemories(userId).length;
  const devicesCount = db.getDevices(userId).length;
  const integrationsCount = db.getIntegrations(userId).length;
  const permissionsCount = db.getPermissions(userId).length;
  const auditLogsCount = db.getAuditLogs(userId).length;
  const protectedResourcesCount = db.getProtectedResources(userId).length;

  res.json({
    sessions: flaggedSessions,
    metrics: {
      memoriesCount,
      devicesCount,
      integrationsCount,
      permissionsCount,
      auditLogsCount,
      protectedResourcesCount,
    },
  });
});

app.post('/api/privacy/revoke-sessions', authenticateToken, (req, res) => {
  db.revokeOtherSessions(req.user!.id, req.token || '');
  db.addAuditLog(req.user!.id, 'revoke_sessions', 'SUCCESS', 'Revoked all other active sessions', 'privacy_dashboard');
  res.json({ success: true, message: 'All other active sessions revoked.' });
});

// --- Automated Test Suite Runner (Executes all 18 Acceptance Tests) ---
app.post('/api/tests/run-all', optionalAuth, async (req, res) => {
  try {
    const results = await AutomatedTestSuite.runAllTests();
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to complete test suite run', details: err.message });
  }
});

// --- Background Reminder Scheduler ---
setInterval(() => {
  const due = db.getPendingDueReminders();
  for (const r of due) {
    db.markReminderTriggered(r.id);
    db.addAuditLog(r.userId, 'reminder_alarm', 'SUCCESS', `Triggered scheduled reminder: "${r.text}"`, 'reminder_scheduler');
  }
}, 4000);

// --- Vite Dev Server Middleware or Static Build Serve ---
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SR Assistant Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
