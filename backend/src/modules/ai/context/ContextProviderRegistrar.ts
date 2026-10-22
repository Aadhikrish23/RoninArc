import registry from "./ContextProviderRegistry";

import { LibraryContextProvider } from "../domains/games/context/LibraryContextProvider";
import { ReviewContextProvider } from "../domains/games/context/ReviewContextProvider";
import { CollectionContextProvider } from "../domains/games/context/CollectionContextProvider";

export function registerContextProviders() {
  registry.register(new LibraryContextProvider());
  registry.register(new ReviewContextProvider());
  registry.register(new CollectionContextProvider());

  return registry;
}