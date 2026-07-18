import axios from "axios";
import AIConfig from "../config/AIConfig";

export class OllamaClient {
  private readonly baseUrl = AIConfig.ollamaBaseUrl;
  private readonly model = AIConfig.ollamaModel;
  private readonly timeout = AIConfig.ollamaTimeout;

  /**
   * Sends prompt to Ollama generate endpoint and returns the raw output string.
   */
  async generate(prompt: string): Promise<string> {
    if (process.env.MOCK_LLM === "true") {
      const match = prompt.match(/User Request:\s*\n([^\n]+)/);
      const query = match ? match[1].trim() : "";
      const queryLower = query.toLowerCase();
      console.log(`[OllamaClient Mock] Intercepted user query: "${query}"`);

      let responseText = "";

      if (queryLower.includes("launch")) {
        let gameName = "Fallout Shelter";
        if (queryLower.includes("elden ring")) {
          gameName = "Elden Ring";
        } else if (queryLower.includes("cyberpunk")) {
          gameName = "Cyberpunk 2077";
        } else if (queryLower.includes("unknown game")) {
          gameName = "Unknown Game";
        } else if (queryLower.includes("fallout") && !queryLower.includes("shelter")) {
          gameName = "Fallout";
        } else if (queryLower.includes("it")) {
          gameName = "it";
        }
        responseText = JSON.stringify({
          intents: [
            {
              type: "LaunchGame",
              targets: [{ type: "Game", name: gameName }],
              parameters: []
            }
          ]
        });
      } else if (queryLower.includes("complete")) {
        let gameName = "Fallout Shelter";
        if (queryLower.includes("cyberpunk")) {
          gameName = "Cyberpunk 2077";
        }
        responseText = JSON.stringify({
          intents: [
            {
              type: "CompleteGame",
              targets: [{ type: "Game", name: gameName }],
              parameters: []
            }
          ]
        });
      } else if (queryLower.includes("rate") || queryLower.includes("review")) {
        let rating = 9;
        let text = "";
        let gameName = "Fallout Shelter";
        if (queryLower.includes("it")) {
          gameName = "it";
        }
        if (queryLower.includes("9")) {
          rating = 9;
        } else if (queryLower.includes("10")) {
          rating = 10;
        }
        if (queryLower.includes("review")) {
          text = "Great game!";
        }
        responseText = JSON.stringify({
          intents: [
            {
              type: "ReviewGame",
              targets: [{ type: "Game", name: gameName }],
              parameters: [
                { type: "Rating", value: rating },
                ...(text ? [{ type: "Text", value: text }] : [])
              ]
            }
          ]
        });
      } else if (queryLower.includes("create") && queryLower.includes("collection")) {
        responseText = JSON.stringify({
          intents: [
            {
              type: "OrganizeCollection",
              targets: [{ type: "Collection", name: "RPG Collection" }],
              parameters: []
            }
          ]
        });
      } else if (queryLower.includes("add") && queryLower.includes("collection")) {
        let gameName = "Fallout Shelter";
        if (queryLower.includes("it")) {
          gameName = "it";
        }
        responseText = JSON.stringify({
          intents: [
            {
              type: "OrganizeCollection",
              targets: [
                { type: "Collection", name: "RPG Collection" },
                { type: "Game", name: gameName }
              ],
              parameters: []
            }
          ]
        });
      } else if (queryLower.includes("remove") && queryLower.includes("collection")) {
        responseText = JSON.stringify({
          intents: [
            {
              type: "OrganizeCollection",
              targets: [
                { type: "Collection", name: "RPG Collection" },
                { type: "Game", name: "Fallout Shelter" }
              ],
              parameters: []
            }
          ]
        });
      }

      if (responseText) {
        return responseText;
      }
      
      console.warn(`[OllamaClient Mock] No match found for query "${query}", proceeding to live request...`);
    }

    const isDev = process.env.NODE_ENV !== "production";
    const startTime = Date.now();

    try {
      const response = await axios.post(
        `${this.baseUrl}/api/generate`,
        {
          model: this.model,
          prompt,
          format: "json",
          stream: false,
        },
        {
          timeout: this.timeout,
        },
      );

      const endTime = Date.now();
      const localDuration = endTime - startTime;

      if (!response) {
        throw new Error("Invalid HTTP response: Empty response from Ollama.");
      }

      if (response.status !== 200) {
        throw new Error(`Ollama returned a non-200 status code: ${response.status} ${response.statusText}`);
      }

      if (!response.data) {
        throw new Error("Invalid HTTP response: Missing response data from Ollama.");
      }

      const { response: modelResponse, total_duration } = response.data;

      if (typeof modelResponse !== "string") {
        throw new Error("Ollama response did not contain a valid 'response' field.");
      }

      if (isDev) {
        const responseDuration = typeof total_duration === "number"
          ? `${Math.round(total_duration / 1000000)}ms`
          : "N/A";
        console.log(`[OllamaClient] Selected Model: ${this.model}`);
        console.log(`[OllamaClient] Request Duration: ${localDuration}ms`);
        console.log(`[OllamaClient] Response Duration: ${responseDuration}`);
        console.log(`[OllamaClient] Response Length: ${modelResponse.length}`);
      }

      return modelResponse;
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        if (error.code === "ECONNABORTED") {
          throw new Error("Ollama request timed out. Please check if Ollama is responsive.");
        }
        if (error.code === "ECONNREFUSED") {
          throw new Error(`Ollama is not running. Connection refused at ${this.baseUrl}. Please start the Ollama service.`);
        }
        if (error.response) {
          throw new Error(`Ollama returned a non-200 HTTP response status: ${error.response.status}. Likely caused by an invalid model or prompt config.`);
        }
        throw new Error(`Failed to communicate with Ollama: ${error.message}`);
      }
      throw error;
    }
  }
}

export default new OllamaClient();
