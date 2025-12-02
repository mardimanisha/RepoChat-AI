/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Text Generation module using Hugging Face Inference API
 * Replaces Anthropic Claude with open-source models
 * Uses Chat Completion API for better model compatibility
 */

import { HfInference } from "@huggingface/inference";

// Recommended models for chat completion
const DEFAULT_MODEL = "meta-llama/Llama-3.1-8B";
// Alternative models that support chat:
// const DEFAULT_MODEL = 'meta-llama/Llama-2-7b-chat-hf';
// const DEFAULT_MODEL = 'HuggingFaceH4/zephyr-7b-beta';
// const DEFAULT_MODEL = 'mistralai/Mixtral-8x7B-Instruct-v0.1';
// const DEFAULT_MODEL = 'openchat/openchat-3.5-1210';

const MAX_NEW_TOKENS = 1024;
const TEMPERATURE = 0.7;
const TOP_P = 0.95;

export interface TextGenerationConfig {
  hfToken: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  provider?: string; // Add provider option
}

export interface GenerateTextOptions {
  systemPrompt: string;
  userPrompt: string;
  chatHistory?: Array<{ role: "user" | "assistant"; content: string }>;
}

/**
 * Initialize Hugging Face Inference client
 */
export function createTextGenerator(config: TextGenerationConfig) {
  const {
    hfToken,
    model = DEFAULT_MODEL,
    maxTokens = MAX_NEW_TOKENS,
    temperature = TEMPERATURE,
    topP = TOP_P,
    provider, // Add provider
  } = config;

  if (!hfToken) {
    throw new Error("HF_TOKEN is required for text generation");
  }

  // Remove the empty options object - it doesn't help with provider selection
  const hf = new HfInference(hfToken);

  return {
    /**
     * Build messages array for chat completion
     */
    buildMessages(options: GenerateTextOptions) {
      const { systemPrompt, userPrompt, chatHistory = [] } = options;

      // Build messages in OpenAI-compatible format
      const messages: Array<{ role: string; content: string }> = [
        { role: "system", content: systemPrompt },
      ];

      // Add chat history
      chatHistory.forEach((msg) => {
        messages.push({
          role: msg.role === "user" ? "user" : "assistant",
          content: msg.content,
        });
      });

      // Add current user prompt
      messages.push({
        role: "user",
        content: userPrompt,
      });

      return messages;
    },

    /**
     * Generate text response using Chat Completion API
     */
    async generateText(options: GenerateTextOptions): Promise<string> {
      try {
        const messages = this.buildMessages(options);

        console.log("[HF] Generating text with model:", model);
        console.log("[HF] Messages count:", messages.length);

        // Build request options with explicit provider handling
        const requestOptions: any = {
          model,
          messages: messages as any,
          max_tokens: maxTokens,
          temperature,
          top_p: topP,
        };

        // Explicitly set provider to avoid auto-selection issues
        // If no provider specified, try 'together' as it's more reliable for chat models
        if (provider) {
          requestOptions.provider = provider;
          console.log("[HF] Using specified provider:", provider);
        } else {
          // Try to use 'together' provider by default, or let SDK handle it
          // Some models work better with specific providers
          requestOptions.provider = "together";
          console.log("[HF] No provider specified, using default: together");
        }

        const response = await hf.chatCompletion(requestOptions);

        // Extract the generated text from response
        const generatedText =
          response.choices?.[0]?.message?.content?.trim() || "";

        if (!generatedText) {
          throw new Error("No response generated from model");
        }

        console.log("[HF] Generated text length:", generatedText.length);

        return generatedText;
      } catch (error: any) {
        console.error("[HF] Error generating text:", error);

        // Handle provider-specific errors
        if (
          error.name === "ProviderApiError" ||
          error.message?.includes("provider")
        ) {
          throw new Error(
            `Hugging Face provider error: ${
              error.message || "Provider request failed"
            }. ` +
              `Try: 1) Setting HF_PROVIDER environment variable (e.g., 'together', 'fireworks'), ` +
              `2) Checking your provider settings at https://hf.co/settings/inference-providers, ` +
              `3) Using a different model that's available on your providers.`
          );
        }

        // Handle HTTP errors from provider
        if (
          error.message?.includes("HTTP error") ||
          error.message?.includes("Failed to perform inference")
        ) {
          throw new Error(
            `Hugging Face API HTTP error: The selected provider may not support this model or task. ` +
              `Original error: ${error.message}. ` +
              `Try setting HF_PROVIDER environment variable to a different provider.`
          );
        }

        // Handle common errors with better messages
        if (error.message?.includes("Rate limit")) {
          throw new Error(
            "Hugging Face API rate limit exceeded. Please try again in a few minutes."
          );
        }

        if (
          error.message?.includes("Model is currently loading") ||
          error.message?.includes("loading")
        ) {
          throw new Error(
            "The AI model is loading. This usually takes 30-60 seconds. Please try again in a moment."
          );
        }

        if (
          error.message?.includes("Authorization") ||
          error.message?.includes("token") ||
          error.message?.includes("unauthorized")
        ) {
          throw new Error(
            "Invalid Hugging Face token. Please check your HF_TOKEN environment variable."
          );
        }

        if (error.message?.includes("not supported for task")) {
          throw new Error(
            `Model ${model} doesn't support chat completion. Please use a chat-compatible model like mistralai/Mistral-7B-Instruct-v0.2 or meta-llama/Llama-2-7b-chat-hf.`
          );
        }

        // Return original error message if not a known error
        throw new Error(
          `Failed to generate text: ${error.message || "Unknown error"}`
        );
      }
    },

    /**
     * Stream text response using Chat Completion API
     */
    async *streamText(
      options: GenerateTextOptions
    ): AsyncGenerator<string, void, unknown> {
      try {
        const messages = this.buildMessages(options);

        console.log("[HF] Streaming text with model:", model);

        const streamOptions: any = {
          model,
          messages: messages as any,
          max_tokens: maxTokens,
          temperature,
          top_p: topP,
        };

        // Add provider if specified
        if (provider) {
          streamOptions.provider = provider;
        }

        const stream = hf.chatCompletionStream(streamOptions);

        for await (const chunk of stream) {
          if (chunk.choices?.[0]?.delta?.content) {
            yield chunk.choices[0].delta.content;
          }
        }
      } catch (error: any) {
        console.error("[HF] Error streaming text:", error);
        throw new Error(
          `Failed to stream text: ${error.message || "Unknown error"}`
        );
      }
    },

    /**
     * Get model information
     */
    getModelInfo() {
      return {
        model,
        maxTokens,
        temperature,
        topP,
      };
    },
  };
}

/**
 * Fallback: Simple text generation for models that don't support chat
 * Use this if chatCompletion fails
 */
export function createSimpleTextGenerator(config: TextGenerationConfig) {
  const {
    hfToken,
    model = "google/flan-t5-xxl", // Use a model known to work with text generation
    maxTokens = MAX_NEW_TOKENS,
    temperature = TEMPERATURE,
  } = config;

  if (!hfToken) {
    throw new Error("HF_TOKEN is required for text generation");
  }

  const hf = new HfInference(hfToken);

  return {
    async generateText(options: GenerateTextOptions): Promise<string> {
      try {
        const { systemPrompt, userPrompt, chatHistory = [] } = options;

        // Build a single prompt string
        let fullPrompt = `${systemPrompt}\n\n`;

        if (chatHistory.length > 0) {
          fullPrompt += "Previous conversation:\n";
          chatHistory.forEach((msg) => {
            fullPrompt += `${msg.role === "user" ? "Human" : "Assistant"}: ${
              msg.content
            }\n`;
          });
          fullPrompt += "\n";
        }

        fullPrompt += `Human: ${userPrompt}\nAssistant:`;

        console.log("[HF] Using simple text generation with model:", model);

        const response = await hf.textGeneration({
          model,
          inputs: fullPrompt,
          parameters: {
            max_new_tokens: maxTokens,
            temperature,
            return_full_text: false,
          },
        });

        const generatedText = response.generated_text.trim();

        return generatedText;
      } catch (error: any) {
        console.error("[HF] Simple text generation error:", error);
        throw new Error(
          `Failed to generate text: ${error.message || "Unknown error"}`
        );
      }
    },

    getModelInfo() {
      return { model, maxTokens, temperature };
    },
  };
}
