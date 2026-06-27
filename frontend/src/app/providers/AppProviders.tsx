import type { ReactNode } from "react";

import { ChakraProvider } from "@chakra-ui/react";
import { HashRouter } from "react-router-dom";

import { AuthProvider } from "../../features/auth/context/AuthContext";
import { ProviderProvider } from "../../features/providers/context/ProviderContext";
import { LibraryProvider } from "../../features/library/context/LibraryContext";
import { CollectionProvider } from "../../features/collections/context/CollectionContext";

interface Props {
  children: ReactNode;
}

export default function AppProviders({ children }: Props) {
  return (
    <ChakraProvider>
      <AuthProvider>
        <ProviderProvider>
          <LibraryProvider>
            <CollectionProvider>
              <HashRouter>{children}</HashRouter>
            </CollectionProvider>
          </LibraryProvider>
        </ProviderProvider>
      </AuthProvider>
    </ChakraProvider>
  );
}
