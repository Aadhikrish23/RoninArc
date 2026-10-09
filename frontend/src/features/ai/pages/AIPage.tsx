import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAIAssistantLauncher } from "../components/AIAssistantLauncher";

/**
 * The assistant is a modal now, not a page. Old links to #/ai still work:
 * they land on the library with the assistant open.
 */
export default function AIPage() {
  const { open } = useAIAssistantLauncher();

  useEffect(() => {
    open();
  }, [open]);

  return <Navigate to="/" replace />;
}
