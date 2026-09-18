const aiProvider = process.env.AI_PROVIDER || "ollama";

// This file is imported at server startup (well before any request exists),
// so it must never throw -- an installation with no AI provider configured
// at all (e.g. a fresh packaged install before the user has set anything
// up) still needs auth/library/launcher/etc. to work. Missing config is
// logged here and surfaced as a normal, catchable error only when an actual
// chat request tries to use the misconfigured provider (see OllamaClient /
// NvidiaNimClient), the same lazy-validation pattern used elsewhere
// (steamWebApiService.getApiKey(), atlasConnection.getAtlasConnection()).
if (aiProvider !== "ollama" && aiProvider !== "nvidia") {
  console.warn(
    `[AIConfig] AI_PROVIDER must be "ollama" or "nvidia", got "${aiProvider}" -- AI features will be unavailable.`,
  );
}

if (aiProvider === "ollama") {
  if (!process.env.OLLAMA_BASE_URL || !process.env.OLLAMA_MODEL) {
    console.warn(
      "[AIConfig] OLLAMA_BASE_URL/OLLAMA_MODEL are not set -- AI chat will fail until they're configured.",
    );
  }
}

if (aiProvider === "nvidia") {
  if (!process.env.NVIDIA_API_KEY || !process.env.NVIDIA_MODEL) {
    console.warn(
      "[AIConfig] NVIDIA_API_KEY/NVIDIA_MODEL are not set -- AI chat will fail until they're configured.",
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
