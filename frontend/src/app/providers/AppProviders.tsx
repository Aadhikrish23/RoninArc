import type { ReactNode } from "react";

import { ChakraProvider, extendTheme } from "@chakra-ui/react";
import { HashRouter } from "react-router-dom";

import { AuthProvider } from "../../features/auth/context/AuthContext";
import { ProviderProvider } from "../../features/providers/context/ProviderContext";
import { LibraryProvider } from "../../features/library/context/LibraryContext";
import { CollectionProvider } from "../../features/collections/context/CollectionContext";
import { AIProvider } from "../../features/ai/context/AIContext";
import AppErrorBoundary from "../../shared/components/AppErrorBoundary";

// Chakra's defaults, except badges keep the case they're written in ("84% match", "In your library")
// instead of shouting in all caps.
const theme = extendTheme({
  components: {
    Badge: { baseStyle: { textTransform: "none", letterSpacing: "normal" } },
  },
});

interface Props {
  children: ReactNode;
}

export default function AppProviders({ children }: Props) {
  // Toasts at the bottom left: clear of the nav and username (top), the assistant button (bottom right) and centred page buttons like "Remove From Library".
  return (
    <ChakraProvider theme={theme} toastOptions={{ defaultOptions: { position: "bottom-left" } }}>
      <AppErrorBoundary>
      <AuthProvider>
        <ProviderProvider>
          <LibraryProvider>
            <CollectionProvider>
              <AIProvider>
                <HashRouter>{children}</HashRouter>
              </AIProvider>
            </CollectionProvider>
          </LibraryProvider>
        </ProviderProvider>
      </AuthProvider>
      </AppErrorBoundary>
    </ChakraProvider>
  );
}
