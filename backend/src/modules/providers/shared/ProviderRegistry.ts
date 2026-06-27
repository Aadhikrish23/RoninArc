import { GameProvider } from "./GameProvider";
import epicProvider from "../epic/epicProvider";
import steamProvider from "../steam/steamProvider";

class ProviderRegistry {
  private providers = new Map<string, GameProvider>();

  constructor() {
    this.providers.set("epic", epicProvider);
    this.providers.set("steam", steamProvider);
  }

  get(providerId: string): GameProvider {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error(`Provider ${providerId} is not registered.`);
    }
    return provider;
  }
}

export default new ProviderRegistry();
