/**
 * Ollama client wrapper.
 *
 * Prefers the Rust IPC command (timeouts, error mapping, `OLLAMA_HOST`
 * support) and transparently falls back to direct HTTP when the web layer
 * runs outside Tauri (e.g. `vite dev` in a plain browser).
 */

import { invoke } from '@tauri-apps/api/core';
import { stripThinkTags } from '../utils/jsonUtils';

export interface ChatMessage {
  role: 'user' | 'system' | 'assistant';
  content: string;
}

export interface ChatOptions {
  model?: string;
  messages: ChatMessage[];
  options?: {
    temperature?: number;
    top_p?: number;
  };
  stream?: boolean;
}

export interface FinalChatResponse {
  message: {
    content: string;
  };
  modelUsed: string;
}

const DEFAULT_BASE_URL = 'http://localhost:11434';

/** Preferred general-purpose models when auto-selecting. */
const PREFERRED_MODEL_HINTS = ['qwen', 'gemma', 'llama', 'mistral'];

function isTauriAvailable(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

function baseUrl(): string {
  try {
    const host = import.meta.env?.VITE_OLLAMA_HOST as string | undefined;
    if (host) return host.replace(/\/$/, '');
  } catch {
    // import.meta unavailable — ignore.
  }
  return DEFAULT_BASE_URL;
}

function pickPreferred(models: string[]): string {
  return (
    models.find(m => !m.includes('cloud') && PREFERRED_MODEL_HINTS.some(hint => m.includes(hint))) ||
    models[0] ||
    ''
  );
}

async function fetchModelsHttp(): Promise<string[]> {
  const response = await fetch(`${baseUrl()}/api/tags`, {
    method: 'GET',
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  return ((data.models ?? []) as Array<{ name: string }>).map(m => m.name);
}

export class OllamaWrapper {
  private isAvailable = false;
  private installedModels: string[] = [];
  private selectedModel = '';

  public async initializeOllama(): Promise<boolean> {
    if (isTauriAvailable()) {
      try {
        const models = await invoke<string[]>('check_ollama_status');
        this.installedModels = models;
        this.isAvailable = models.length > 0;
        this.selectedModel = pickPreferred(models);
        return this.isAvailable;
      } catch (err) {
        console.warn('[OllamaWrapper] Rust check_ollama_status failed:', err);
      }
    }

    try {
      const models = await fetchModelsHttp();
      this.installedModels = models;
      this.isAvailable = models.length > 0;
      this.selectedModel = pickPreferred(models);
      return this.isAvailable;
    } catch (error) {
      console.warn('[OllamaWrapper] Connection check failed:', error);
      this.isAvailable = false;
      return false;
    }
  }

  public getModels(): string[] {
    return [...this.installedModels];
  }

  public getSelectedModel(): string {
    return this.selectedModel;
  }

  public setSelectedModel(model: string): void {
    if (!this.installedModels.includes(model)) {
      console.warn(`[OllamaWrapper] Model "${model}" is not installed`);
      return;
    }
    this.selectedModel = model;
  }

  public isServiceAvailable(): boolean {
    return this.isAvailable;
  }

  public async chat(options: ChatOptions): Promise<FinalChatResponse> {
    if (!this.isAvailable && !(await this.initializeOllama())) {
      throw new Error(`Ollama service is not reachable at ${baseUrl()}`);
    }

    const modelToUse = options.model || this.selectedModel || this.installedModels[0];
    if (!modelToUse) throw new Error('No Ollama model available');

    if (isTauriAvailable()) {
      try {
        // Send the FULL conversation history — earlier revisions dropped all
        // but the last user message, breaking context-dependent prompts.
        const cleanContent = await invoke<string>('chat_ollama', {
          model: modelToUse,
          messages: options.messages.map(({ role, content }) => ({ role, content })),
        });
        return { message: { content: cleanContent }, modelUsed: modelToUse };
      } catch (err) {
        console.warn('[OllamaWrapper] Rust chat failed, falling back to HTTP:', err);
      }
    }

    const response = await fetch(`${baseUrl()}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelToUse,
        messages: options.messages,
        options: options.options || { temperature: 0.1 },
        stream: false,
      }),
      signal: AbortSignal.timeout(120_000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const text = await response.text();
    let rawContent = '';

    // The endpoint returns a single JSON object for stream:false; older
    // versions streamed NDJSON lines — handle both defensively.
    for (const line of text.trim().split('\n')) {
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line);
        if (parsed.message?.content) rawContent += parsed.message.content;
      } catch {
        // skip malformed line
      }
    }

    return { message: { content: stripThinkTags(rawContent) }, modelUsed: modelToUse };
  }

  public async reconnect(): Promise<boolean> {
    return this.initializeOllama();
  }
}
