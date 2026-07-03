import registry from "./ContextProviderRegistry";

import { LibraryContextProvider } from "./LibraryContextProvider";
import { ReviewContextProvider } from "./ReviewContextProvider";
import { CollectionContextProvider } from "./CollectionContextProvider";

export function registerContextProviders() {
  registry.register(new LibraryContextProvider());
  registry.register(new ReviewContextProvider());
  registry.register(new CollectionContextProvider());

  return registry;
}