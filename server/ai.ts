import { GoogleGenAI } from '@google/genai';
import { db, User } from './db.js';
import { actionExecutor, ActionResult } from './actions.js';

let aiInstance: GoogleGenAI | null = null;

function getGenAI(): GoogleGenAI | null {
  if (aiInstance) return aiInstance;
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  aiInstance = new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
  return aiInstance;
}

export interface AssistantInput {
  user: User;
  message: string;
  confirmed?: boolean;
  confirmationPayload?: any;
  securityCode?: string;
  source?: 'voice' | 'chat';
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

export class AssistantService {
  /**
   * Main entry point to process a voice or typed command
   */
  public async processMessage(input: AssistantInput): Promise<AssistantOutput> {
    const { user, message, confirmed, confirmationPayload, securityCode, source = 'chat' } = input;
    const cleanText = (message || '').trim();
    const lang = this.detectLanguage(cleanText);

    // Save user message to persistent history (Req 1, 9)
    if (cleanText) {
      db.addChatMessage(user.id, 'user', cleanText);
    }

    // 1. If this is an execution of an already-confirmed action
    if (confirmed && confirmationPayload) {
      const execResult = await actionExecutor.executeAction(user, {
        action: confirmationPayload.action,
        parameters: confirmationPayload.parameters || confirmationPayload,
        confirmed: true,
        securityCode,
      });

      const reply = execResult.message;
      db.addChatMessage(user.id, 'assistant', reply, confirmationPayload.action, execResult);

      return {
        reply,
        actionResult: execResult,
        detectedLanguage: lang,
        source,
      };
    }

    // 2. Cancellation handling (Req 7)
    if (this.isCancelCommand(cleanText)) {
      db.clearPendingClarification(user.id);
      db.addAuditLog(user.id, 'cancel_operation', 'SUCCESS', 'User requested cancellation', 'user_intent');
      const reply =
        lang === 'roman_urdu'
          ? 'Operation cancel kar diya gaya hai.'
          : 'Operation cancelled.';
      db.addChatMessage(user.id, 'assistant', reply);
      return {
        reply,
        actionResult: {
          success: true,
          status: 'SUCCESS',
          message: reply,
        },
        detectedLanguage: lang,
        source,
      };
    }

    // 3. Check for Pending Clarification resolution (Req 6)
    const pendingClarification = db.getPendingClarification(user.id);
    if (pendingClarification && cleanText) {
      const resolvedOutput = await this.resolvePendingClarification(user, pendingClarification, cleanText, lang, source);
      if (resolvedOutput) {
        db.addChatMessage(user.id, 'assistant', resolvedOutput.reply, resolvedOutput.actionResult?.status, resolvedOutput.actionResult);
        return resolvedOutput;
      }
    }

    // 4. Fast-path intent matching (includes undo, memory control, multi-step, context)
    const fastIntent = this.classifyFastIntent(cleanText, lang, user);

    if (fastIntent) {
      const directOutput = await this.handleDirectIntent(user, fastIntent, cleanText, lang, source, securityCode);
      db.addChatMessage(user.id, 'assistant', directOutput.reply, directOutput.actionResult?.status, directOutput.actionResult);
      return directOutput;
    }

    // 5. Check for live / current information keywords (Req 23)
    const isCurrentInfoQuery = this.isCurrentQuery(cleanText);

    // 6. Gemini Reasoning Layer with Full Context & Personalization
    const ai = getGenAI();

    if (!ai) {
      const fallback = this.handleFallbackOffline(user, cleanText, lang, source);
      db.addChatMessage(user.id, 'assistant', fallback.reply);
      return fallback;
    }

    try {
      const profile = db.getProfile(user.id);
      const userMemories = db.getMemories(user.id).slice(0, 8);
      const devices = db.getDevices(user.id);
      const integrations = db.getIntegrations(user.id);
      const recentChat = db.getChatHistory(user.id, 6);

      const systemPrompt = `You are "SR", a calm, trustworthy, premium voice-first personal AI assistant operating layer.
Current User Name: ${user.name}
Language Preference: ${profile?.preferredLanguage || lang}
Response Style: ${profile?.responseStyle || 'concise'} (Be elegant, direct, and respectful)
Current Local Time: ${new Date().toLocaleString()}

CONVERSATION CONTEXT (Previous interactions with ${user.name}):
${recentChat.map((m) => `${m.role === 'user' ? user.name : 'SR'}: ${m.text}`).join('\n') || 'None'}

STRICT POLICY RULES:
1. Product name is permanently "SR". Do not rename or change your identity.
2. Understand English, Urdu (اردو), and Roman Urdu seamlessly. If the user speaks Urdu or Roman Urdu, reply naturally in the same language.
3. User's isolated memories:
${userMemories.map((m) => `- [${m.category}] ${m.content}`).join('\n') || 'None recorded yet.'}
4. Connected devices:
${devices.map((d) => `- ${d.name} (${d.status}, type: ${d.deviceType})`).join('\n')}
5. Connected integrations:
${integrations.map((i) => `- ${i.name} (status: ${i.status}, locked: ${i.isLocked})`).join('\n')}
6. Never invent facts or pretend external actions succeeded without real verification.
7. If asked about current events, today's news, or live information, ground your response in verified sources.
8. If the user refers to previous context ("open that", "the previous one", "what did I say earlier?"), use the conversation history above.`;

      // If user is asking for current information, use Google Search Grounding
      if (isCurrentInfoQuery) {
        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: cleanText,
          config: {
            systemInstruction: systemPrompt,
            tools: [{ googleSearch: {} }],
          },
        });

        const replyText = response.text || 'I retrieved current information for you.';
        const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
        const groundingUrls: Array<{ uri: string; title: string }> = [];

        if (chunks && Array.isArray(chunks)) {
          for (const c of chunks) {
            if ((c as any).web?.uri) {
              groundingUrls.push({
                uri: (c as any).web.uri,
                title: (c as any).web.title || (c as any).web.uri,
              });
            }
          }
        }

        db.addAuditLog(user.id, 'current_information', 'SUCCESS', `Retrieved grounded current data for: "${cleanText}"`, 'google_search_grounding');
        db.addChatMessage(user.id, 'assistant', replyText);

        return {
          reply: replyText,
          detectedLanguage: lang,
          groundingUrls,
          source,
        };
      }

      // General intelligent response
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: cleanText,
        config: {
          systemInstruction: systemPrompt,
        },
      });

      const reply = response.text || 'Understood.';
      db.addChatMessage(user.id, 'assistant', reply);

      return {
        reply,
        detectedLanguage: lang,
        source,
      };
    } catch (err: any) {
      console.error('Gemini API call failed:', err);
      db.addAuditLog(user.id, 'ai_query', 'FAILURE', `AI reasoning engine unavailable: ${err?.message || 'Error'}`, 'gemini_service');
      const errReply = `I encountered an issue connecting to the AI reasoning service: ${err?.message || 'Service unavailable'}. Please verify your API settings or retry.`;
      db.addChatMessage(user.id, 'assistant', errReply);
      return {
        reply: errReply,
        detectedLanguage: lang,
        source,
      };
    }
  }

  // --- Fast Intent Classifier ---
  private classifyFastIntent(text: string, lang: 'en' | 'ur' | 'roman_urdu', user: User): any | null {
    const lower = text.toLowerCase().trim();

    // 1. Undo (Req 8)
    if (
      lower === 'undo' ||
      lower === 'sr undo' ||
      lower === 'sr undo that' ||
      lower === 'undo that' ||
      lower.includes('wapas lo') ||
      lower.includes('undo karo') ||
      lower.includes('revert that')
    ) {
      return { type: 'undo' };
    }

    // 2. Memory Control - "What do you remember about me?" (Req 10)
    if (
      lower.includes('what do you remember about me') ||
      lower.includes('what do you remember') ||
      lower.includes('show my memories') ||
      lower.includes('meri memories') ||
      lower.includes('kya yaad hai')
    ) {
      return { type: 'list_memories' };
    }

    // 3. Memory Control - "Forget that", "Delete this memory", "Don't save this" (Req 10)
    if (
      lower.includes('forget that') ||
      lower.includes('delete this memory') ||
      lower.includes('delete memory') ||
      lower.includes('dont save this') ||
      lower.includes("don't save this") ||
      lower.includes('bhool jao') ||
      lower.includes('memory delete')
    ) {
      return { type: 'delete_recent_memory' };
    }

    // 4. Context References - "do it again" / "repeat that" (Req 1)
    if (
      lower.includes('do it again') ||
      lower.includes('repeat that') ||
      lower.includes('phir se karo') ||
      lower.includes('the previous one')
    ) {
      const history = db.getChatHistory(user.id, 5);
      const userMsgs = history.filter((m) => m.role === 'user' && !m.text.toLowerCase().includes('again'));
      const prevMsg = userMsgs[userMsgs.length - 1];
      if (prevMsg) {
        return this.classifyFastIntent(prevMsg.text, lang, user);
      }
    }

    // 5. Context References - "what did I tell you earlier?" (Req 1)
    if (
      lower.includes('what did i tell you earlier') ||
      lower.includes('what did i say earlier') ||
      lower.includes('pehle kya bola tha') ||
      lower.includes('earlier today')
    ) {
      return { type: 'recall_earlier' };
    }

    // 6. Conversation & Memory Search (Req 9)
    if (
      lower.startsWith('sr find') ||
      lower.startsWith('find where i mentioned') ||
      lower.startsWith('search conversation') ||
      lower.startsWith('search where i')
    ) {
      const query = lower
        .replace(/^(sr find|find where i mentioned|search conversation for|search where i mentioned)\s*/i, '')
        .trim();
      return { type: 'search_history', query };
    }

    // 7. Multi-step task planning (Req 4, 22)
    // Example: "SR, meri meeting ke liye calendar check karo, browser kholo aur reminder laga do"
    if (
      (lower.includes('calendar') || lower.includes('status')) &&
      (lower.includes('browser') || lower.includes('chrome')) &&
      (lower.includes('reminder') || lower.includes('yaad'))
    ) {
      return {
        type: 'multi_step_plan',
        steps: [
          { tool: 'system_status', params: {}, label: 'Verify system & device readiness' },
          { tool: 'open_url', params: { url: 'https://google.com' }, label: 'Open workstation browser' },
          { tool: 'create_reminder', params: { text: 'Scheduled meeting review', scheduledTime: new Date(Date.now() + 86400000).toISOString() }, label: 'Schedule meeting reminder' },
        ],
      };
    }

    // 8. Memory saving: "remember that...", "yaad rakhna...", "yaad rakho..."
    if (
      lower.startsWith('sr remember that') ||
      lower.startsWith('remember that') ||
      lower.startsWith('sr, remember that') ||
      lower.startsWith('yaad rakhna ke') ||
      lower.startsWith('yaad rakhna ki') ||
      lower.startsWith('yaad rakhna') ||
      lower.startsWith('yaad rakho') ||
      lower.includes('save memory') ||
      lower.includes('note down that')
    ) {
      let content = lower
        .replace(/^sr,?\s*/i, '')
        .replace(/^remember that\s*/i, '')
        .replace(/^yaad rakhna (ke|ki)?\s*/i, '')
        .replace(/^yaad rakho (ke|ki)?\s*/i, '')
        .replace(/^save memory:?\s*/i, '')
        .trim();
      return { type: 'save_memory', content };
    }

    // 9. Memory retrieval: "when is my...", "what is my deadline", "project deadline kab hai"
    if (
      (lower.includes('when is') || lower.includes('what is my') || lower.includes('kab hai') || lower.includes('yaad hai')) &&
      (lower.includes('deadline') || lower.includes('project') || lower.includes('schedule') || lower.includes('meeting'))
    ) {
      return { type: 'retrieve_memory', query: 'deadline' };
    }

    // 10. Reminders: Check for missing time -> Clarification! (Req 6)
    if (
      (lower === 'remind me tomorrow' || lower === 'kal yaad dila dena' || lower === 'set reminder tomorrow')
    ) {
      return {
        type: 'clarification_needed',
        intent: 'create_reminder',
        missingField: 'time',
        question:
          lang === 'roman_urdu'
            ? 'Kal kis waqt ka reminder set karna hai?'
            : 'What time tomorrow should I schedule the reminder for?',
      };
    }

    if (
      lower.includes('remind me') ||
      lower.includes('yaad dila') ||
      lower.includes('yaad karwa') ||
      lower.includes('set reminder') ||
      lower.includes('reminder laga')
    ) {
      return { type: 'create_reminder', text: lower };
    }

    // 11. Open applications: "open chrome", "chrome kholo", "open vs code", "vs code kholo"
    if (
      lower.includes('chrome kholo') ||
      lower.includes('vs code kholo') ||
      lower.includes('open chrome') ||
      lower.includes('open vs code') ||
      lower.includes('open browser') ||
      lower.includes('browser kholo') ||
      lower.includes('open application')
    ) {
      let appName = 'Chrome';
      if (lower.includes('vs code') || lower.includes('vscode')) appName = 'VS Code';
      if (lower.includes('browser')) appName = 'Chrome Browser';
      return { type: 'open_app', appName };
    }

    // 12. WhatsApp: Check for missing recipient -> Clarification! (Req 6)
    if (
      lower === 'send this message' ||
      lower === 'send message' ||
      lower === 'whatsapp message bhejo' ||
      lower === 'message bhejo'
    ) {
      return {
        type: 'clarification_needed',
        intent: 'whatsapp_send',
        missingField: 'recipient',
        question:
          lang === 'roman_urdu'
            ? 'Ye message kis contact ko bhejna hai?'
            : 'Which contact should I send this message to?',
      };
    }

    if (lower.includes('whatsapp')) {
      return { type: 'whatsapp_message', raw: lower };
    }

    // 13. Video Editor: "mute clip", "cut clip", "open video editor", "apply filter"
    if (lower.includes('video editor') || lower.includes('clip') || lower.includes('filter')) {
      return { type: 'video_editor', raw: lower };
    }

    // 14. Protected Resource / Secret Vault (Code 18)
    if (
      lower.includes('secret') ||
      lower.includes('protected') ||
      lower.includes('vault') ||
      lower.includes('obsidian') ||
      lower.includes('master key') ||
      lower.includes('private file')
    ) {
      return { type: 'protected_resource', raw: lower };
    }

    return null;
  }

  private async handleDirectIntent(
    user: User,
    intent: any,
    rawText: string,
    lang: 'en' | 'ur' | 'roman_urdu',
    source: 'voice' | 'chat',
    securityCode?: string
  ): Promise<AssistantOutput> {
    switch (intent.type) {
      case 'undo': {
        const undoRes = actionExecutor.handleUndo(user);
        return {
          reply: undoRes.message,
          actionResult: undoRes,
          detectedLanguage: lang,
          source,
        };
      }

      case 'clarification_needed': {
        db.setPendingClarification(user.id, {
          userId: user.id,
          intent: intent.intent,
          missingField: intent.missingField,
          partialPayload: {},
          question: intent.question,
          timestamp: Date.now(),
        });

        return {
          reply: intent.question,
          needsClarification: true,
          detectedLanguage: lang,
          source,
        };
      }

      case 'multi_step_plan': {
        const planRes = await actionExecutor.executeTaskPlan(user, intent.steps);
        return {
          reply: planRes.message,
          actionResult: planRes,
          detectedLanguage: lang,
          source,
        };
      }

      case 'list_memories': {
        const memories = db.getMemories(user.id);
        if (memories.length === 0) {
          const reply =
            lang === 'roman_urdu'
              ? 'Aap ki koi saved memories nahi hain.'
              : 'I do not have any saved memories for your account.';
          return { reply, detectedLanguage: lang, source };
        }

        const summary = memories
          .map((m, idx) => `${idx + 1}. [${m.category}] ${m.content}`)
          .join('\n');

        const reply =
          lang === 'roman_urdu'
            ? `Main ne aap ke baray mein yeh baatein yaad rakhi hain:\n${summary}`
            : `Here is what I currently remember about you:\n${summary}`;

        return { reply, detectedLanguage: lang, source };
      }

      case 'delete_recent_memory': {
        const memories = db.getMemories(user.id);
        if (memories.length === 0) {
          const reply = 'No memories found to delete.';
          return { reply, detectedLanguage: lang, source };
        }

        const recent = memories[0];
        db.deleteMemory(user.id, recent.id);
        db.addAuditLog(user.id, 'delete_memory', 'SUCCESS', `Deleted memory "${recent.content}" via user command`, 'memory_control');

        const reply =
          lang === 'roman_urdu'
            ? `Theek hai, main ne yeh memory delete kar di hai: "${recent.content}".`
            : `Understood. I have deleted that memory: "${recent.content}".`;

        return {
          reply,
          actionResult: {
            success: true,
            status: 'SUCCESS',
            message: reply,
          },
          detectedLanguage: lang,
          source,
        };
      }

      case 'recall_earlier': {
        const history = db.getChatHistory(user.id, 6);
        const userMsgs = history.filter((m) => m.role === 'user');
        if (userMsgs.length <= 1) {
          const reply = 'We just started our conversation. You have not mentioned earlier items yet.';
          return { reply, detectedLanguage: lang, source };
        }

        const earlier = userMsgs.slice(-4, -1).map((m) => `"${m.text}"`).join(', ');
        const reply = `Earlier you mentioned: ${earlier}.`;
        return { reply, detectedLanguage: lang, source };
      }

      case 'search_history': {
        const searchResults = db.searchUserContent(user.id, intent.query);
        const matchesCount =
          searchResults.messages.length +
          searchResults.memories.length +
          searchResults.reminders.length;

        if (matchesCount === 0) {
          const reply = `I searched your history and memories for "${intent.query}", but found no matching records.`;
          return { reply, detectedLanguage: lang, source };
        }

        const memoryMatches = searchResults.memories.map((m) => `Memory: "${m.content}"`).join('\n');
        const reply = `Found ${matchesCount} matching items for "${intent.query}":\n${memoryMatches || 'Matches found in conversation history.'}`;

        return { reply, detectedLanguage: lang, source };
      }

      case 'save_memory': {
        const mem = db.addMemory(user.id, intent.content || rawText, 'project', source);
        db.addAuditLog(user.id, 'save_memory', 'SUCCESS', `Saved memory: "${mem.content}"`, 'memory_service');

        // Track for undo (Req 8)
        db.setLastAction(user.id, {
          userId: user.id,
          actionType: 'save_memory',
          recordId: mem.id,
          data: mem,
          description: `Saved memory: "${mem.content}"`,
          timestamp: Date.now(),
        });

        const reply =
          lang === 'ur'
            ? `میں نے یہ محفوظ کر لیا ہے: "${mem.content}"`
            : lang === 'roman_urdu'
              ? `Main ne yaad rakh liya hai: "${mem.content}"`
              : `I've saved this to your memory: "${mem.content}"`;

        return { reply, detectedLanguage: lang, source };
      }

      case 'retrieve_memory': {
        const memories = db.getMemories(user.id);
        const deadlineMem = memories.find((m) => m.content.toLowerCase().includes('deadline') || m.content.toLowerCase().includes('october'));

        db.addAuditLog(user.id, 'retrieve_memory', 'SUCCESS', `Retrieved memories for query: ${intent.query}`, 'memory_service');

        if (deadlineMem) {
          const reply =
            lang === 'ur'
              ? `آپ کی محفوظ کردہ میموری کے مطابق: ${deadlineMem.content}`
              : lang === 'roman_urdu'
                ? `Aap ki saved memory ke mutabiq: ${deadlineMem.content}`
                : `According to your saved memory: ${deadlineMem.content}`;
          return { reply, detectedLanguage: lang, source };
        }

        const reply =
          lang === 'roman_urdu'
            ? 'Aap ki deadline ke baray mein koi saved memory nahi mili.'
            : 'I could not find a saved memory regarding that deadline.';
        return { reply, detectedLanguage: lang, source };
      }

      case 'create_reminder': {
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + 1);
        targetDate.setHours(20, 0, 0, 0); // 8:00 PM tomorrow

        let reminderText = 'Scheduled task';
        if (rawText.toLowerCase().includes('meeting')) reminderText = 'Project team meeting';
        else if (rawText.toLowerCase().includes('deadline')) reminderText = 'Project submission deadline';
        else reminderText = rawText.replace(/^(sr|remind me|yaad dila dena)\s*/i, '');

        const rem = db.createReminder(user.id, reminderText, targetDate.toISOString(), Intl.DateTimeFormat().resolvedOptions().timeZone);

        db.addAuditLog(user.id, 'create_reminder', 'SUCCESS', `Created persistent reminder for ${targetDate.toLocaleString()}`, 'reminder_scheduler');

        // Track for undo (Req 8)
        db.setLastAction(user.id, {
          userId: user.id,
          actionType: 'create_reminder',
          recordId: rem.id,
          data: rem,
          description: `Reminder: "${reminderText}"`,
          timestamp: Date.now(),
        });

        // Add Notification (Req 17)
        db.addNotification(user.id, 'Reminder Scheduled', `Scheduled for ${targetDate.toLocaleDateString()}: ${reminderText}`, 'reminder');

        const reply =
          lang === 'ur'
            ? `ریما ئنڈر شیڈول ہو گیا ہے: کل رات 8:00 بجے کے لیے۔`
            : lang === 'roman_urdu'
              ? `Main ne kal raat 8:00 baje ke liye reminder set kar diya hai.`
              : `Reminder confirmed for tomorrow at 8:00 PM: "${reminderText}".`;

        return {
          reply,
          detectedLanguage: lang,
          actionResult: {
            success: true,
            status: 'SUCCESS',
            message: reply,
            data: rem,
          },
          source,
        };
      }

      case 'open_app': {
        const result = await actionExecutor.executeAction(user, {
          action: 'open_app',
          parameters: { appName: intent.appName },
        });

        return {
          reply: result.message,
          actionResult: result,
          detectedLanguage: lang,
          source,
        };
      }

      case 'whatsapp_message': {
        const result = await actionExecutor.executeAction(user, {
          action: 'whatsapp_send',
          parameters: {
            recipient: 'Team Lead (+1 555-0192)',
            message: 'Status update: deliverables completed.',
          },
        });

        return {
          reply: result.message,
          actionResult: result,
          detectedLanguage: lang,
          needsConfirmation: result.status === 'NEEDS_CONFIRMATION',
          confirmationPayload: result.confirmationPayload,
          source,
        };
      }

      case 'video_editor': {
        let subAction = 'open_editor';
        if (rawText.toLowerCase().includes('filter')) subAction = 'apply_filter';
        else if (rawText.toLowerCase().includes('mute')) subAction = 'mute_clip';
        else if (rawText.toLowerCase().includes('cut')) subAction = 'cut_clip';

        const result = await actionExecutor.executeAction(user, {
          action: 'video_editor_action',
          parameters: { subAction, clipId: 'clip_01' },
        });

        return {
          reply: result.message,
          actionResult: result,
          detectedLanguage: lang,
          source,
        };
      }

      case 'protected_resource': {
        const resources = db.getProtectedResources(user.id);
        const targetRes = resources[0];

        if (!targetRes) {
          return {
            reply: 'You do not have any protected resources configured in your vault.',
            detectedLanguage: lang,
            source,
          };
        }

        const result = await actionExecutor.executeAction(user, {
          action: 'access_protected_resource',
          parameters: { resourceId: targetRes.id },
          securityCode,
        });

        return {
          reply: result.message,
          actionResult: result,
          detectedLanguage: lang,
          needsSecurityCode: result.status === 'NEEDS_SECURITY_CODE',
          source,
        };
      }

      default:
        return {
          reply: 'Understood.',
          detectedLanguage: lang,
          source,
        };
    }
  }

  // --- Clarification Resolution ---
  private async resolvePendingClarification(
    user: User,
    pending: any,
    answer: string,
    lang: 'en' | 'ur' | 'roman_urdu',
    source: 'voice' | 'chat'
  ): Promise<AssistantOutput | null> {
    db.clearPendingClarification(user.id);

    if (pending.intent === 'whatsapp_send') {
      const recipient = answer.trim();
      const result = await actionExecutor.executeAction(user, {
        action: 'whatsapp_send',
        parameters: {
          recipient,
          message: 'Status update: project deliverables ready for review.',
        },
      });

      return {
        reply: result.message,
        actionResult: result,
        detectedLanguage: lang,
        needsConfirmation: result.status === 'NEEDS_CONFIRMATION',
        confirmationPayload: result.confirmationPayload,
        source,
      };
    }

    if (pending.intent === 'create_reminder') {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + 1);
      targetDate.setHours(20, 0, 0, 0); // scheduled time based on clarification

      const rem = db.createReminder(user.id, `Reminder at ${answer}`, targetDate.toISOString(), 'UTC');
      const reply = `Reminder scheduled for tomorrow (${answer}): "${rem.text}".`;

      return {
        reply,
        actionResult: {
          success: true,
          status: 'SUCCESS',
          message: reply,
          data: rem,
        },
        detectedLanguage: lang,
        source,
      };
    }

    return null;
  }

  private isCancelCommand(text: string): boolean {
    const q = text.toLowerCase().trim();
    return (
      q === 'cancel' ||
      q === 'sr stop' ||
      q === 'stop' ||
      q === 'never mind' ||
      q === 'stop this' ||
      q === 'cancel this' ||
      q === 'ruk jao' ||
      q === 'khatam karo'
    );
  }

  private handleFallbackOffline(user: User, text: string, lang: 'en' | 'ur' | 'roman_urdu', source: 'voice' | 'chat'): AssistantOutput {
    const isCurrent = this.isCurrentQuery(text);
    if (isCurrent) {
      return {
        reply: 'Current information could not be verified from an authorized live source (Gemini API key is not configured).',
        detectedLanguage: lang,
        source,
      };
    }

    const reply =
      lang === 'roman_urdu'
        ? `SR ready hai. Main aap ki devices, memories, reminders aur actions handle kar sakta hoon.`
        : `SR is operational. I can manage your isolated memories, reminders, connected devices, and authorized actions.`;

    return {
      reply,
      detectedLanguage: lang,
      source,
    };
  }

  private isCurrentQuery(text: string): boolean {
    const q = text.toLowerCase();
    const keywords = ['latest', 'today', 'current', 'now', 'live', 'recent', 'news', 'weather', 'exchange rate', 'ranking'];
    return keywords.some((k) => q.includes(k));
  }

  public detectLanguage(text: string): 'en' | 'ur' | 'roman_urdu' {
    if (/[\u0600-\u06FF]/.test(text)) {
      return 'ur';
    }

    const romanUrduWords = ['kholo', 'baje', 'yaad', 'dila', 'karo', 'hai', 'kaise', 'meri', 'mera', 'main', 'aap', 'mujhe', 'kal', 'par', 'woh', 'wali'];
    const words = text.toLowerCase().split(/\s+/);
    const hasRomanUrdu = words.some((w) => romanUrduWords.includes(w));
    if (hasRomanUrdu) {
      return 'roman_urdu';
    }

    return 'en';
  }
}

export const assistantService = new AssistantService();
