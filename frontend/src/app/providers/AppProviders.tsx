import type { ReactNode } from "react";

import { ChakraProvider } from "@chakra-ui/react";
import { HashRouter } from "react-router-dom";

import { AuthProvider } from "../../features/auth/context/AuthContext";

interface Props {
  children: ReactNode;
}

export default function AppProviders({
  children,
}: Props) {
  return (
    <ChakraProvider>
      <AuthProvider>
        <HashRouter>
          {children}
        </HashRouter>
      </AuthProvider>
    </ChakraProvider>
  );
}