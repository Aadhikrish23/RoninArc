import axios from "axios";
import AIConfig from "../config/AIConfig";

export class NvidiaNimClient {
  private readonly baseUrl = AIConfig.nvidiaBaseUrl;
  private readonly apiKey = AIConfig.nvidiaApiKey;
  private readonly model = AIConfig.nvidiaModel;
  private readonly timeout = AIConfig.nvidiaTimeout;

  /**
   * Sends prompt to NVIDIA NIM's OpenAI-compatible chat completions endpoint
   * and returns the raw text output (mirrors OllamaClient.generate's contract).
   */
  async generate(prompt: string): Promise<string> {
    const isDev = process.env.NODE_ENV !== "production";
    const startTime = Date.now();

    try {
      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        {
          model: this.model,
          messages: [{ role: "user", content: prompt }],
          temperature: 0,
          max_tokens: 1024,
          stream: false,
          // This model has a hybrid reasoning mode that, left on, spends thousands of
          // characters "thinking out loud" before ever emitting JSON -- often exceeding
          // max_tokens before it gets there (observed: 45-60s responses, some truncated
          // to pure reasoning prose with no JSON at all). Structured intent extraction
          // needs the direct answer, not a visible chain of thought, so it's turned off.
          chat_template_kwargs: { thinking: false },
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          timeout: this.timeout,
        },
      );

      const localDuration = Date.now() - startTime;

      if (!response || response.status !== 200 || !response.data) {
        throw new Error("Invalid HTTP response: Empty response from NVIDIA NIM.");
      }

      const content = response.data?.choices?.[0]?.message?.content;
      if (typeof content !== "string") {
        throw new Error("NVIDIA NIM response did not contain a valid message content field.");
      }

      if (isDev) {
        console.log(`[NvidiaNimClient] Selected Model: ${this.model}`);
        console.log(`[NvidiaNimClient] Request Duration: ${localDuration}ms`);
        console.log(`[NvidiaNimClient] Response Length: ${content.length}`);
      }

      return content;
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        if (error.code === "ECONNABORTED") {
          throw new Error("NVIDIA NIM request timed out. Please try again.");
        }
        if (error.response) {
          const status = error.response.status;
          if (status === 401) {
            throw new Error("NVIDIA NIM rejected the request (401 Unauthorized). Check that NVIDIA_API_KEY is set and valid.");
          }
          if (status === 429) {
            throw new Error("NVIDIA NIM rate limit exceeded (429 Too Many Requests). Please wait and try again.");
          }
          throw new Error(`NVIDIA NIM returned a non-200 HTTP response status: ${status}. Likely caused by an invalid model or request config.`);
        }
        throw new Error(`Failed to communicate with NVIDIA NIM: ${error.message}`);
      }
      throw error;
    }
  }
}

export default new NvidiaNimClient();
