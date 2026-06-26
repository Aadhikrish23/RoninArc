import { useProvider } from "../../context/ProviderContext";

/**
 * Thin wrapper around useProvider("epic") to act as a backward-compatible
 * hook for Epic Games provider operations.
 */
export default function useEpic() {
  return useProvider("epic");
}

