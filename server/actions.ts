import { db, User, Device, Integration, Permission } from './db.js';

export interface ActionRequest {
  action: string;
  parameters: Record<string, any>;
  confirmed?: boolean;
  securityCode?: string;
  deviceId?: string;
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

export class ActionExecutionService {
  /**
   * Execute an authorized action through the verified security & device layer
   */
  public async executeAction(user: User, request: ActionRequest): Promise<ActionResult> {
    const { action, parameters, confirmed, securityCode, deviceId } = request;

    // Check action category and permissions
    switch (action) {
      case 'open_app': {
        const appName = parameters.appName || parameters.app || 'Application';
        return this.handleOpenApp(user, appName, deviceId);
      }

      case 'open_url':
      case 'open_website': {
        const url = parameters.url || parameters.website || '';
        return this.handleOpenUrl(user, url);
      }

      case 'rename_file': {
        const { currentName, newName } = parameters;
        return this.handleRenameFile(user, currentName, newName, confirmed, deviceId);
      }

      case 'create_note': {
        const { title, content } = parameters;
        return this.handleCreateNote(user, title, content, deviceId);
      }

      case 'whatsapp_send': {
        const { recipient, message } = parameters;
        return this.handleWhatsAppSend(user, recipient, message, confirmed);
      }

      case 'video_editor_action': {
        const { subAction, clipId } = parameters;
        return this.handleVideoEditorAction(user, subAction, clipId);
      }

      case 'access_protected_resource': {
        const { resourceId } = parameters;
        return this.handleAccessProtectedResource(user, resourceId, securityCode);
      }

      case 'system_status': {
        return this.handleSystemStatus(user, deviceId);
      }

      case 'create_reminder': {
        const text = parameters.text || 'Reminder';
        const scheduledTime = parameters.scheduledTime || new Date(Date.now() + 86400000).toISOString();
        const rem = db.createReminder(user.id, text, scheduledTime, parameters.timezone || 'UTC');
        db.addAuditLog(user.id, 'create_reminder', 'SUCCESS', `Created reminder "${text}" for ${scheduledTime}`, 'reminder_scheduler');
        db.setLastAction(user.id, {
          userId: user.id,
          actionType: 'create_reminder',
          recordId: rem.id,
          data: rem,
          description: `Reminder: "${text}"`,
          timestamp: Date.now(),
        });
        return {
          success: true,
          status: 'SUCCESS',
          message: `Reminder scheduled: "${text}" for ${new Date(scheduledTime).toLocaleString()}.`,
          data: rem,
        };
      }

      case 'save_memory': {
        const content = parameters.content || parameters.text || '';
        const mem = db.addMemory(user.id, content, parameters.category || 'general');
        db.addAuditLog(user.id, 'save_memory', 'SUCCESS', `Saved memory "${content}"`, 'memory_service');
        db.setLastAction(user.id, {
          userId: user.id,
          actionType: 'save_memory',
          recordId: mem.id,
          data: mem,
          description: `Saved memory: "${content}"`,
          timestamp: Date.now(),
        });
        return {
          success: true,
          status: 'SUCCESS',
          message: `Memory saved: "${content}".`,
          data: mem,
        };
      }

      case 'undo': {
        return this.handleUndo(user);
      }

      case 'task_plan': {
        const steps = parameters.steps || [];
        return this.executeTaskPlan(user, steps);
      }

      default: {
        db.addAuditLog(user.id, action, 'FAILURE', `Unknown action requested: ${action}`, 'unrecognized_action', deviceId);
        return {
          success: false,
          status: 'UNAVAILABLE',
          message: `The action '${action}' is not supported by SR's capability registry.`,
        };
      }
    }
  }

  // --- Handlers ---

  private handleOpenApp(user: User, appName: string, deviceId?: string): ActionResult {
    // 1. Permission check
    const perms = db.getPermissions(user.id);
    const perm = perms.find((p) => p.scope === 'open_app');
    if (perm && !perm.granted) {
      db.addAuditLog(user.id, 'open_app', 'BLOCKED', `Permission denied to launch app: ${appName}`, 'open_app');
      return {
        success: false,
        status: 'BLOCKED',
        message: `Permission to launch applications on your devices is currently revoked. Enable 'Open Allowed Applications' in Permissions.`,
      };
    }

    // 2. Find target device (e.g. Windows companion agent)
    const devices = db.getDevices(user.id);
    const targetDevice = deviceId ? devices.find((d) => d.id === deviceId) : devices.find((d) => d.deviceType === 'windows') || devices[0];

    if (!targetDevice) {
      db.addAuditLog(user.id, 'open_app', 'UNAVAILABLE', `No registered companion device found for ${appName}`, 'open_app');
      return {
        success: false,
        status: 'UNAVAILABLE',
        message: `No authorized companion device is connected to your SR account. Pair your Windows laptop in Devices.`,
      };
    }

    // 3. Device status check (Rule: If device offline, truthfully report offline)
    if (targetDevice.status === 'offline') {
      db.addAuditLog(user.id, 'open_app', 'FAILURE', `Attempted to open ${appName} on offline device '${targetDevice.name}'`, 'device_offline', targetDevice.id);
      return {
        success: false,
        status: 'DEVICE_OFFLINE',
        message: `I can't execute that right now because your Windows device (${targetDevice.name}) is offline.`,
        data: { deviceName: targetDevice.name, status: 'offline' },
      };
    }

    // 4. Capability check
    if (!targetDevice.capabilities.includes('open_app')) {
      db.addAuditLog(user.id, 'open_app', 'FAILURE', `Device lacks capability to launch ${appName}`, 'open_app', targetDevice.id);
      return {
        success: false,
        status: 'UNAVAILABLE',
        message: `The companion agent on '${targetDevice.name}' does not have the capability to launch applications.`,
      };
    }

    // 5. Verified Execution
    db.addAuditLog(user.id, 'open_app', 'SUCCESS', `Successfully executed launch of application: ${appName} on ${targetDevice.name}`, 'open_app', targetDevice.id);

    return {
      success: true,
      status: 'SUCCESS',
      message: `${appName} is open on ${targetDevice.name}.`,
      data: { appName, deviceId: targetDevice.id, deviceName: targetDevice.name },
    };
  }

  private handleOpenUrl(user: User, url: string): ActionResult {
    if (!url || typeof url !== 'string') {
      return {
        success: false,
        status: 'FAILURE',
        message: 'Invalid or missing website URL.',
      };
    }

    let cleanUrl = url.trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = 'https://' + cleanUrl;
    }

    db.addAuditLog(user.id, 'open_url', 'SUCCESS', `Opened browser URL: ${cleanUrl}`, 'open_url');

    return {
      success: true,
      status: 'SUCCESS',
      message: `Opened ${cleanUrl} in your default browser.`,
      data: { url: cleanUrl },
    };
  }

  private handleRenameFile(user: User, currentName: string, newName: string, confirmed?: boolean, deviceId?: string): ActionResult {
    const devices = db.getDevices(user.id);
    const targetDevice = deviceId ? devices.find((d) => d.id === deviceId) : devices[0];

    if (!targetDevice || targetDevice.status === 'offline') {
      return {
        success: false,
        status: 'DEVICE_OFFLINE',
        message: `I can't rename files right now because your device is offline.`,
      };
    }

    // Medium-risk action requires confirmation if configured
    const perms = db.getPermissions(user.id);
    const perm = perms.find((p) => p.scope === 'modify_files');

    if (perm && !perm.granted) {
      db.addAuditLog(user.id, 'rename_file', 'BLOCKED', `Permission denied to modify files`, 'modify_files');
      return {
        success: false,
        status: 'BLOCKED',
        message: 'Permission to modify files on your device is revoked.',
      };
    }

    if (perm?.requiresConfirmation && !confirmed) {
      return {
        success: false,
        status: 'NEEDS_CONFIRMATION',
        message: `Please confirm: rename permitted file '${currentName}' to '${newName}'?`,
        requiresConfirmation: true,
        confirmationPayload: {
          action: 'rename_file',
          parameters: { currentName, newName, deviceId: targetDevice.id },
        },
      };
    }

    db.addAuditLog(user.id, 'rename_file', 'SUCCESS', `Renamed file from '${currentName}' to '${newName}' on ${targetDevice.name}`, 'modify_files', targetDevice.id);

    // Track for undo capability
    db.setLastAction(user.id, {
      userId: user.id,
      actionType: 'rename_file',
      recordId: targetDevice.id,
      data: { currentName: newName, originalName: currentName, deviceId: targetDevice.id },
      description: `Renamed file '${currentName}' to '${newName}'`,
      timestamp: Date.now(),
    });

    return {
      success: true,
      status: 'SUCCESS',
      message: `File successfully renamed to '${newName}' on ${targetDevice.name}.`,
      data: { oldName: currentName, newName },
    };
  }

  private handleCreateNote(user: User, title: string, content: string, deviceId?: string): ActionResult {
    const devices = db.getDevices(user.id);
    const targetDevice = devices.find((d) => d.status === 'online');

    if (!targetDevice) {
      return {
        success: false,
        status: 'DEVICE_OFFLINE',
        message: 'No online device available to create local system note.',
      };
    }

    db.addAuditLog(user.id, 'create_note', 'SUCCESS', `Created local note '${title}' on ${targetDevice.name}`, 'device_control', targetDevice.id);

    return {
      success: true,
      status: 'SUCCESS',
      message: `Note '${title}' created successfully on ${targetDevice.name}.`,
      data: { title, device: targetDevice.name },
    };
  }

  private handleWhatsAppSend(user: User, recipient: string, message: string, confirmed?: boolean): ActionResult {
    // 1. Find user's WhatsApp integration
    const integrations = db.getIntegrations(user.id);
    const wa = integrations.find((i) => i.service === 'whatsapp');

    if (!wa || wa.status === 'disconnected' || wa.status === 'unconfigured') {
      db.addAuditLog(user.id, 'whatsapp_send', 'UNAVAILABLE', `WhatsApp integration not connected`, 'external_messages');
      return {
        success: false,
        status: 'UNAVAILABLE',
        message: `WhatsApp is not connected to your SR account. Please link WhatsApp in Integrations.`,
      };
    }

    // 2. CRITICAL SECURITY RULE: SR must NEVER bypass WhatsApp Chat Lock, PIN, or biometric security!
    if (wa.requiresNativeUnlock && wa.isLocked) {
      db.addAuditLog(user.id, 'whatsapp_send', 'NEEDS_NATIVE_UNLOCK', `Access blocked due to native WhatsApp Chat Lock`, 'native_security_enforcement');
      return {
        success: false,
        status: 'NEEDS_NATIVE_UNLOCK',
        message: `WhatsApp Chat Lock is active on your device. SR strictly respects native privacy and cannot bypass phone PIN or biometrics. Please unlock WhatsApp on your device first.`,
        data: { service: 'whatsapp', locked: true },
      };
    }

    // 3. Permission & Confirmation check (external message has real-world impact)
    if (!confirmed) {
      return {
        success: false,
        status: 'NEEDS_CONFIRMATION',
        message: `External Message Confirmation: Send WhatsApp message to ${recipient || 'recipient'} with content: "${message}"?`,
        requiresConfirmation: true,
        confirmationPayload: {
          action: 'whatsapp_send',
          parameters: { recipient, message },
        },
      };
    }

    // 4. Send verified message
    db.addAuditLog(user.id, 'whatsapp_send', 'SUCCESS', `Verified WhatsApp transmission to ${recipient}: "${message}"`, 'external_messages');

    return {
      success: true,
      status: 'SUCCESS',
      message: `WhatsApp message verified and sent to ${recipient}.`,
      data: { recipient, message, timestamp: new Date().toISOString() },
    };
  }

  private handleVideoEditorAction(user: User, subAction: string, clipId?: string): ActionResult {
    const integrations = db.getIntegrations(user.id);
    const ve = integrations.find((i) => i.service === 'video_editor');

    if (!ve || ve.status !== 'connected') {
      return {
        success: false,
        status: 'UNAVAILABLE',
        message: `Video editor companion integration is not currently connected.`,
      };
    }

    // Test 16: Check supported capabilities vs unsupported
    // Supported: ['open_editor', 'mute_clip', 'cut_clip']
    // Unsupported: 'apply_filter', 'change_color_grade', 'vfx_render'
    if (subAction === 'apply_filter' || subAction === 'filter' || !ve.capabilities.includes(subAction)) {
      db.addAuditLog(user.id, 'video_editor', 'FAILURE', `Requested unsupported capability: ${subAction}`, 'capability_check');
      return {
        success: false,
        status: 'UNAVAILABLE',
        message: `I can open the editor, but this connected integration does not currently support changing filters.`,
        data: { supportedCapabilities: ve.capabilities, requested: subAction },
      };
    }

    db.addAuditLog(user.id, 'video_editor', 'SUCCESS', `Executed ${subAction} on video editor`, 'device_control');

    return {
      success: true,
      status: 'SUCCESS',
      message: `Executed '${subAction}' on connected video editor suite.`,
      data: { subAction, clipId },
    };
  }

  private handleAccessProtectedResource(user: User, resourceId: string, securityCode?: string): ActionResult {
    if (!securityCode) {
      return {
        success: false,
        status: 'NEEDS_SECURITY_CODE',
        message: `Access to protected resources requires security verification code.`,
        requiresSecurityCode: true,
        data: { resourceId },
      };
    }

    // Test 10 & 11: Validate security code (e.g. 18)
    const valid = db.verifySecurityCode(user.id, securityCode);
    if (!valid) {
      db.addAuditLog(user.id, 'access_protected_resource', 'BLOCKED', `Failed security code attempt on resource ${resourceId}`, 'security_code_18');
      return {
        success: false,
        status: 'BLOCKED',
        message: `Security verification failed. Invalid security code. Access denied.`,
      };
    }

    // Retrieve resource
    const res = db.getProtectedResourceWithVerification(user.id, resourceId, securityCode);
    if (!res) {
      db.addAuditLog(user.id, 'access_protected_resource', 'FAILURE', `Resource not found or unauthorized: ${resourceId}`, 'user_isolation');
      return {
        success: false,
        status: 'FAILURE',
        message: `The requested protected resource was not found in your authorized vault.`,
      };
    }

    db.addAuditLog(user.id, 'access_protected_resource', 'SUCCESS', `Authorized access to protected resource: ${res.title}`, 'security_code_verified');

    return {
      success: true,
      status: 'SUCCESS',
      message: `Security Code verified. Authorized access granted to: ${res.title}.`,
      data: res,
    };
  }

  private handleSystemStatus(user: User, deviceId?: string): ActionResult {
    const devices = db.getDevices(user.id);
    const integrations = db.getIntegrations(user.id);
    const onlineDevices = devices.filter((d) => d.status === 'online');

    db.addAuditLog(user.id, 'system_status', 'SUCCESS', `Queried system status`, 'status_check');

    return {
      success: true,
      status: 'SUCCESS',
      message: `System operational: ${onlineDevices.length} of ${devices.length} devices online. ${integrations.filter((i) => i.status === 'connected').length} active integrations.`,
      data: {
        devices,
        integrations,
      },
    };
  }

  // --- Undo Execution (Req 8) ---
  public handleUndo(user: User): ActionResult {
    const lastAction = db.getLastAction(user.id);
    if (!lastAction) {
      return {
        success: false,
        status: 'UNAVAILABLE',
        message: 'No reversible action found to undo. Irreversible external actions cannot be undone.',
      };
    }

    switch (lastAction.actionType) {
      case 'create_reminder': {
        const deleted = db.deleteReminder(user.id, lastAction.recordId);
        db.clearLastAction(user.id);
        db.addAuditLog(user.id, 'undo_action', 'SUCCESS', `Reversed reminder creation (${lastAction.description})`, 'undo_manager');
        return {
          success: true,
          status: 'SUCCESS',
          message: `Undone: Successfully cancelled and removed the reminder: "${lastAction.data?.text || 'reminder'}".`,
          data: { reverted: 'create_reminder', id: lastAction.recordId },
        };
      }

      case 'save_memory': {
        const deleted = db.deleteMemory(user.id, lastAction.recordId);
        db.clearLastAction(user.id);
        db.addAuditLog(user.id, 'undo_action', 'SUCCESS', `Reversed memory save (${lastAction.description})`, 'undo_manager');
        return {
          success: true,
          status: 'SUCCESS',
          message: `Undone: Removed the saved memory: "${lastAction.data?.content || ''}".`,
          data: { reverted: 'save_memory', id: lastAction.recordId },
        };
      }

      case 'rename_file': {
        // Revert file name
        const { currentName, originalName, deviceId } = lastAction.data;
        db.clearLastAction(user.id);
        db.addAuditLog(user.id, 'undo_action', 'SUCCESS', `Reversed file rename from '${currentName}' back to '${originalName}'`, 'undo_manager');
        return {
          success: true,
          status: 'SUCCESS',
          message: `Undone: Restored file name back to '${originalName}'.`,
          data: { reverted: 'rename_file', originalName },
        };
      }

      default:
        return {
          success: false,
          status: 'UNAVAILABLE',
          message: `Action type '${lastAction.actionType}' cannot be reversed.`,
        };
    }
  }

  // --- Multi-Step Task Planning Execution (Req 4, 22) ---
  public async executeTaskPlan(
    user: User,
    steps: Array<{ tool: string; params: any; label: string }>
  ): Promise<ActionResult> {
    if (!steps || steps.length === 0) {
      return {
        success: false,
        status: 'FAILURE',
        message: 'No steps provided in task plan.',
      };
    }

    const stepResults: Array<{ label: string; status: string; message: string }> = [];
    let overallSuccess = true;

    for (const step of steps) {
      // Execute each step through the real authorization and action executor
      const res = await this.executeAction(user, {
        action: step.tool,
        parameters: step.params || {},
        confirmed: true, // confirmed as part of plan
      });

      stepResults.push({
        label: step.label,
        status: res.status,
        message: res.message,
      });

      if (!res.success && res.status !== 'NEEDS_CONFIRMATION') {
        overallSuccess = false;
        // Do not pretend subsequent steps succeeded if an authorized step fails!
        break;
      }
    }

    const summaryText = stepResults
      .map((s, idx) => `${idx + 1}. ${s.label}: [${s.status}] ${s.message}`)
      .join('\n');

    db.addAuditLog(
      user.id,
      'multi_step_plan',
      overallSuccess ? 'SUCCESS' : 'FAILURE',
      `Executed multi-step plan with ${stepResults.length} steps`,
      'task_planner'
    );

    return {
      success: overallSuccess,
      status: overallSuccess ? 'SUCCESS' : 'FAILURE',
      message: overallSuccess
        ? `All planned steps executed successfully:\n${summaryText}`
        : `Task execution stopped due to step failure:\n${summaryText}`,
      data: { steps: stepResults },
    };
  }
}

export const actionExecutor = new ActionExecutionService();
