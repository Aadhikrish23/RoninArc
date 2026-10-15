import { Outlet } from "react-router-dom";

import Navbar from "../../shared/components/Navbar";
import FirstLaunchModal from "../../features/settings/components/FirstLaunchModal";
import { AIAssistantLauncherProvider } from "../../features/ai/components/AIAssistantLauncher";
import { LaunchProvider } from "../../features/library/context/LaunchContext";
import ScrollToTop from "./ScrollToTop";

export default function ProtectedLayout() {
  return (
    <LaunchProvider>
      <AIAssistantLauncherProvider>
        <ScrollToTop />
        <Navbar />
        <FirstLaunchModal />
        <Outlet />
      </AIAssistantLauncherProvider>
    </LaunchProvider>
  );
}
