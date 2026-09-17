const aiProvider = process.env.AI_PROVIDER || "ollama";

if (aiProvider !== "ollama" && aiProvider !== "nvidia") {
  throw new Error(
    `Invalid configuration: AI_PROVIDER must be "ollama" or "nvidia", got "${aiProvider}".`,
  );
}

if (aiProvider === "ollama") {
  if (!process.env.OLLAMA_BASE_URL) {
    throw new Error(
      "Missing required configuration: OLLAMA_BASE_URL environment variable is not defined.",
    );
  }

  if (!process.env.OLLAMA_MODEL) {
    throw new Error(
      "Missing required configuration: OLLAMA_MODEL environment variable is not defined.",
    );
  }
}

if (aiProvider === "nvidia") {
  if (!process.env.NVIDIA_API_KEY) {
    throw new Error(
      "Missing required configuration: NVIDIA_API_KEY environment variable is not defined.",
    );
  }

  if (!process.env.NVIDIA_MODEL) {
    throw new Error(
      "Missing required configuration: NVIDIA_MODEL environment variable is not defined.",
    );
  }
}

export const AIConfig = {
  aiProvider: aiProvider as "ollama" | "nvidia",

  ollamaBaseUrl: process.env.OLLAMA_BASE_URL as string,
  ollamaModel: process.env.OLLAMA_MODEL as string,
  ollamaTimeout: process.env.OLLAMA_TIMEOUT
    ? parseInt(process.env.OLLAMA_TIMEOUT, 10)
    : 90000,

  nvidiaApiKey: process.env.NVIDIA_API_KEY as string,
  nvidiaModel: process.env.NVIDIA_MODEL as string,
  nvidiaBaseUrl: process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1",
  nvidiaTimeout: process.env.NVIDIA_TIMEOUT
    ? parseInt(process.env.NVIDIA_TIMEOUT, 10)
    : 60000,
};

export default AIConfig;
