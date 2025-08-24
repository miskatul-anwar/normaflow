// Ollama wrapper for Tauri compatibility with streaming NDJSON support
interface ChatMessage {
  role: 'user' | 'system' | 'assistant';
  content: string;
}

interface ChatOptions {
  model: string;
  messages: ChatMessage[];
  options?: {
    temperature?: number;
    top_p?: number;
  };
  stream?: boolean;
}

interface ChatResponse {
  message: {
    content: string;
    role: string;
  };
  done?: boolean;
}

interface FinalChatResponse {
  message: {
    content: string;
  };
}

export class OllamaWrapper {
  private isAvailable: boolean = false;
  private baseUrl: string = 'http://localhost:11434';

  constructor() {
    this.initializeOllama();
  }

  private async initializeOllama() {
    try {
      console.log('[OllamaWrapper] Testing connection...');
      
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        this.isAvailable = true;
        console.log('[OllamaWrapper] Connected successfully');
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.warn('[OllamaWrapper] Connection failed:', error);
      this.isAvailable = false;
    }
  }

  private parseNDJSON(text: string): ChatResponse[] {
    const lines = text.trim().split('\n');
    const responses: ChatResponse[] = [];
    
    for (const line of lines) {
      if (line.trim()) {
        try {
          const parsed = JSON.parse(line) as ChatResponse;
          responses.push(parsed);
        } catch (error) {
          console.warn('[OllamaWrapper] Failed to parse JSON line:', line, error);
          // Continue parsing other lines even if one fails
        }
      }
    }
    
    return responses;
  }

  private assembleStreamingResponse(responses: ChatResponse[]): FinalChatResponse {
    let fullContent = '';
    
    for (const response of responses) {
      if (response.message && response.message.content) {
        fullContent += response.message.content;
      }
    }
    
    return {
      message: {
        content: fullContent
      }
    };
  }

  async chat(options: ChatOptions): Promise<FinalChatResponse> {
    if (!this.isAvailable) {
      throw new Error('Ollama service not available');
    }

    try {
      // Force streaming to false for simpler parsing, or handle streaming properly
      const requestOptions = {
        ...options,
        stream: false // This will make Ollama return a single response instead of streaming
      };

      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestOptions),
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const text = await response.text();
      
      // Handle both streaming and non-streaming responses
      if (text.includes('\n')) {
        // Streaming NDJSON response
        console.log('[OllamaWrapper] Parsing streaming NDJSON response');
        const responses = this.parseNDJSON(text);
        if (responses.length === 0) {
          throw new Error('No valid JSON responses found in stream');
        }
        return this.assembleStreamingResponse(responses);
      } else {
        // Single JSON response
        console.log('[OllamaWrapper] Parsing single JSON response');
        try {
          const data = JSON.parse(text) as ChatResponse;
          return {
            message: {
              content: data.message?.content || ''
            }
          };
        } catch (parseError) {
          console.error('[OllamaWrapper] JSON parse error:', parseError);
          console.error('[OllamaWrapper] Response text:', text);
          throw new Error(`Failed to parse response: ${parseError}`);
        }
      }
    } catch (error) {
      console.error('[OllamaWrapper] Chat error:', error);
      throw error;
    }
  }

  // Alternative streaming method if you want to handle streaming properly
  async chatStreaming(options: ChatOptions): Promise<FinalChatResponse> {
    if (!this.isAvailable) {
      throw new Error('Ollama service not available');
    }

    try {
      const requestOptions = {
        ...options,
        stream: true
      };

      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestOptions),
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('No response body available');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) break;
          
          buffer += decoder.decode(value, { stream: true });
          
          // Process complete lines
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep the incomplete line in buffer
          
          for (const line of lines) {
            if (line.trim()) {
              try {
                const parsed = JSON.parse(line) as ChatResponse;
                if (parsed.message && parsed.message.content) {
                  fullContent += parsed.message.content;
                }
                
                if (parsed.done) {
                  return {
                    message: {
                      content: fullContent
                    }
                  };
                }
              } catch (error) {
                console.warn('[OllamaWrapper] Failed to parse streaming line:', line);
              }
            }
          }
        }
        
        // Process any remaining buffer
        if (buffer.trim()) {
          try {
            const parsed = JSON.parse(buffer) as ChatResponse;
            if (parsed.message && parsed.message.content) {
              fullContent += parsed.message.content;
            }
          } catch (error) {
            console.warn('[OllamaWrapper] Failed to parse final buffer:', buffer);
          }
        }

        return {
          message: {
            content: fullContent
          }
        };
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      console.error('[OllamaWrapper] Streaming chat error:', error);
      throw error;
    }
  }

  isServiceAvailable(): boolean {
    return this.isAvailable;
  }

  async reconnect(): Promise<boolean> {
    await this.initializeOllama();
    return this.isAvailable;
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await this.chat({
        model: 'llama3.2:3b',
        messages: [{ role: 'user', content: 'hello' }],
        options: { temperature: 0.1 }
      });
      return !!(response && response.message && response.message.content);
    } catch (error) {
      console.error('[OllamaWrapper] Test connection failed:', error);
      return false;
    }
  }
}