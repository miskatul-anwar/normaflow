import { invoke } from '@tauri-apps/api/core';

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

function isTauriAvailable(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export class OllamaWrapper {
  private isAvailable: boolean = false;
  private baseUrl: string = 'http://localhost:11434';
  private installedModels: string[] = [];
  private selectedModel: string = '';

  constructor() {
    this.initializeOllama();
  }

  public async initializeOllama(): Promise<boolean> {
    if (isTauriAvailable()) {
      try {
        const models = await invoke<string[]>('check_ollama_status');
        this.installedModels = models;
        this.isAvailable = models.length > 0;
        if (models.length > 0) {
          const preferred = models.find((m: string) =>
            !m.includes('cloud') && (m.includes('qwen') || m.includes('gemma') || m.includes('llama') || m.includes('mistral'))
          ) || models[0];
          this.selectedModel = preferred;
        }
        return this.isAvailable;
      } catch (err) {
        console.warn('[OllamaWrapper] Tauri Rust check_ollama_status failed:', err);
      }
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        const data = await response.json();
        const models = (data.models || []).map((m: any) => m.name as string);
        this.installedModels = models;
        this.isAvailable = models.length > 0;

        if (models.length > 0) {
          const preferred = models.find((m: string) =>
            !m.includes('cloud') && (m.includes('qwen') || m.includes('gemma') || m.includes('llama') || m.includes('mistral'))
          ) || models[0];
          this.selectedModel = preferred;
        }
        return this.isAvailable;
      }
      this.isAvailable = false;
      return false;
    } catch (error) {
      console.warn('[OllamaWrapper] Connection check failed:', error);
      this.isAvailable = false;
      return false;
    }
  }

  public getModels(): string[] {
    return this.installedModels;
  }

  public getSelectedModel(): string {
    return this.selectedModel;
  }

  public setSelectedModel(model: string): void {
    if (this.installedModels.includes(model)) {
      this.selectedModel = model;
    }
  }

  public isServiceAvailable(): boolean {
    return this.isAvailable;
  }

  public async chat(options: ChatOptions): Promise<FinalChatResponse> {
    if (!this.isAvailable && !(await this.initializeOllama())) {
      throw new Error('Ollama service is not running on http://localhost:11434');
    }

    const modelToUse = options.model || this.selectedModel || this.installedModels[0] || 'qwen3.5:2b';

    if (isTauriAvailable()) {
      try {
        const userMsg = options.messages.find(m => m.role === 'user')?.content || '';
        const sysMsg = options.messages.find(m => m.role === 'system')?.content || undefined;

        const cleanContent = await invoke<string>('chat_ollama', {
          model: modelToUse,
          prompt: userMsg,
          systemPrompt: sysMsg
        });

        return {
          message: { content: cleanContent },
          modelUsed: modelToUse
        };
      } catch (err) {
        console.warn('[OllamaWrapper] Tauri chat_ollama failed, falling back to HTTP:', err);
      }
    }

    try {
      const requestOptions = {
        model: modelToUse,
        messages: options.messages,
        options: options.options || { temperature: 0.1 },
        stream: false
      };

      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestOptions),
        signal: AbortSignal.timeout(45000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const text = await response.text();
      let rawContent = '';

      if (text.includes('\n')) {
        const lines = text.trim().split('\n');
        for (const line of lines) {
          if (line.trim()) {
            try {
              const parsed = JSON.parse(line);
              if (parsed.message?.content) {
                rawContent += parsed.message.content;
              }
            } catch {
              // ignore
            }
          }
        }
      } else {
        const data = JSON.parse(text);
        rawContent = data.message?.content || '';
      }

      const cleanContent = rawContent.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '').trim();

      return {
        message: {
          content: cleanContent || rawContent
        },
        modelUsed: modelToUse
      };
    } catch (error) {
      console.error('[OllamaWrapper] Chat execution failed:', error);
      throw error;
    }
  }

  public async reconnect(): Promise<boolean> {
    return this.initializeOllama();
  }
}