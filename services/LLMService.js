class LLMService {
  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY;
    this.anthropicKey = process.env.ANTHROPIC_API_KEY;
    this.defaultModel = process.env.DEFAULT_LLM_MODEL || 'gpt-3.5-turbo';
  }

  // Invoke LLM with various providers
  async invokeLLM({ prompt, model = this.defaultModel, maxTokens = 1000, temperature = 0.7, systemPrompt }) {
    try {
      if (model.startsWith('gpt-') || model.startsWith('gpt4')) {
        return await this.invokeOpenAI({ prompt, model, maxTokens, temperature, systemPrompt });
      } else if (model.startsWith('claude-')) {
        return await this.invokeAnthropic({ prompt, model, maxTokens, temperature, systemPrompt });
      } else {
        throw new Error(`Unsupported model: ${model}`);
      }
    } catch (error) {
      console.error('Error invoking LLM:', error);
      throw error;
    }
  }

  // OpenAI integration
  async invokeOpenAI({ prompt, model, maxTokens, temperature, systemPrompt }) {
    try {
      if (!this.apiKey) {
        // Return mock response for development
        return this.getMockLLMResponse(prompt, model);
      }

      const messages = [];
      if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
      }
      messages.push({ role: 'user', content: prompt });

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: maxTokens,
          temperature,
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      return {
        response: data.choices[0].message.content,
        model,
        usage: {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens
        },
        timestamp: new Date().toISOString(),
        provider: 'openai'
      };
    } catch (error) {
      console.error('OpenAI API error:', error);
      throw error;
    }
  }

  // Anthropic Claude integration
  async invokeAnthropic({ prompt, model, maxTokens, temperature, systemPrompt }) {
    try {
      if (!this.anthropicKey) {
        return this.getMockLLMResponse(prompt, model);
      }

      const messages = [{ role: 'user', content: prompt }];

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': this.anthropicKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          temperature,
          messages,
          ...(systemPrompt && { system: systemPrompt })
        })
      });

      if (!response.ok) {
        throw new Error(`Anthropic API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      return {
        response: data.content[0].text,
        model,
        usage: {
          promptTokens: data.usage.input_tokens,
          completionTokens: data.usage.output_tokens,
          totalTokens: data.usage.input_tokens + data.usage.output_tokens
        },
        timestamp: new Date().toISOString(),
        provider: 'anthropic'
      };
    } catch (error) {
      console.error('Anthropic API error:', error);
      throw error;
    }
  }

  // Mock response for development/testing
  getMockLLMResponse(prompt, model) {
    const responses = [
      "This is a mock response from the LLM service. In production, this would be replaced with actual API calls.",
      "Here's a simulated AI response to demonstrate the functionality. The actual implementation would connect to real LLM providers.",
      "Mock LLM response: Your request has been processed successfully. This is a placeholder response for testing purposes."
    ];

    const randomResponse = responses[Math.floor(Math.random() * responses.length)];

    return {
      response: `${randomResponse}\n\nOriginal prompt: "${prompt.substring(0, 100)}${prompt.length > 100 ? '...' : ''}"`,
      model,
      usage: {
        promptTokens: Math.floor(prompt.length / 4),
        completionTokens: Math.floor(randomResponse.length / 4),
        totalTokens: Math.floor((prompt.length + randomResponse.length) / 4)
      },
      timestamp: new Date().toISOString(),
      provider: 'mock'
    };
  }

  // Get available models
  getAvailableModels() {
    return {
      openai: ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo-preview'],
      anthropic: ['claude-3-sonnet-20240229', 'claude-3-haiku-20240307', 'claude-3-opus-20240229'],
      capabilities: {
        'gpt-3.5-turbo': { maxTokens: 4096, contextWindow: 16384 },
        'gpt-4': { maxTokens: 8192, contextWindow: 8192 },
        'claude-3-sonnet-20240229': { maxTokens: 4096, contextWindow: 200000 },
        'claude-3-haiku-20240307': { maxTokens: 4096, contextWindow: 200000 }
      }
    };
  }

  // Validate model and parameters
  validateRequest({ prompt, model, maxTokens, temperature }) {
    if (!prompt || typeof prompt !== 'string') {
      throw new Error('Prompt is required and must be a string');
    }

    if (prompt.length > 100000) {
      throw new Error('Prompt is too long (max 100,000 characters)');
    }

    const availableModels = this.getAvailableModels();
    const allModels = [...availableModels.openai, ...availableModels.anthropic];
    
    if (model && !allModels.includes(model)) {
      throw new Error(`Unsupported model: ${model}. Available models: ${allModels.join(', ')}`);
    }

    if (maxTokens && (maxTokens < 1 || maxTokens > 8192)) {
      throw new Error('maxTokens must be between 1 and 8192');
    }

    if (temperature !== undefined && (temperature < 0 || temperature > 2)) {
      throw new Error('temperature must be between 0 and 2');
    }
  }
}

export default new LLMService();