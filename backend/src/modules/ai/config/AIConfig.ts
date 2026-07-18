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

export const AIConfig = {
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL,
  ollamaModel: process.env.OLLAMA_MODEL,
  ollamaTimeout: process.env.OLLAMA_TIMEOUT
    ? parseInt(process.env.OLLAMA_TIMEOUT, 10)
    : 90000,
};

export default AIConfig;
