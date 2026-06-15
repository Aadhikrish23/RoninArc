import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

import "./index.css";
import { ChakraProvider } from "@chakra-ui/react";
import { HashRouter } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
   <ChakraProvider>
  <AuthProvider>
    <HashRouter>
      <App />
    </HashRouter>
  </AuthProvider>
</ChakraProvider>
  </StrictMode>
);
