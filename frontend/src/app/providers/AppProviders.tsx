import type { ReactNode } from "react";

import { ChakraProvider } from "@chakra-ui/react";
import { HashRouter } from "react-router-dom";

import { AuthProvider } from "../../features/auth/context/AuthContext";
import { ProviderProvider } from "../../features/providers/context/ProviderContext";

interface Props {
  children: ReactNode;
}

export default function AppProviders({
  children,
}: Props) {
  return (
    <ChakraProvider>
      <AuthProvider>
        <ProviderProvider>
          <HashRouter>
            {children}
          </HashRouter>
        </ProviderProvider>
      </AuthProvider>
    </ChakraProvider>
  );
}