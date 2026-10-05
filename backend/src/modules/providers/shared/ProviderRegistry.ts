import { GameProvider } from "./GameProvider";
import AppError from "../../../shared/errors/AppError";
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
      throw new AppError(`Unknown provider: ${providerId}`, 404);
    }
    return provider;
  }
}

export default new ProviderRegistry();
