import { Outlet } from "react-router-dom";

import Navbar from "../../shared/components/Navbar";
import FirstLaunchModal from "../../features/settings/components/FirstLaunchModal";
import { AIAssistantLauncherProvider } from "../../features/ai/components/AIAssistantLauncher";

export default function ProtectedLayout() {
  return (
    <AIAssistantLauncherProvider>
      <Navbar />
      <FirstLaunchModal />
      <Outlet />
    </AIAssistantLauncherProvider>
  );
}
