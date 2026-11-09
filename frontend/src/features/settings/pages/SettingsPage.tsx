import {
  Box,
  Heading,
  Stack,
  Text,
  useColorModeValue,
  useDisclosure,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../../auth/context/AuthContext";

import ChangePasswordModal from "../components/ChangePasswordModal";
import LogoutAllDevicesModal from "../components/LogoutAllDevicesModal";
import DeleteAccountModal from "../components/DeleteAccountModal";

import AccountSection from "../components/AccountSection";
import AppearanceSection from "../components/AppearanceSection";
import SecuritySection from "../components/SecuritySection";
import DangerZoneSection from "../components/DangerZoneSection";
import SupportSection from "../components/SupportSection";
import CloudSyncSection from "../components/CloudSyncSection";

import ProviderSection from "../../providers/components/ProviderSection";
import EpicProviderCard from "../../providers/epic/components/EpicProviderCard";
import SteamProviderCard from "../../providers/steam/components/SteamProviderCard";

export default function SettingsPage() {
  const bg = useColorModeValue("gray.50", "gray.900");
  const mutedText = useColorModeValue("gray.600", "gray.400");
  const navigate = useNavigate();
  const { logout, user } = useAuth();

  const [username, setUsername] = useState("Unknown User");
  const [isPasswordOpen, setPasswordOpen] = useState(false);
  const [isLogoutAllOpen, setLogoutAllOpen] = useState(false);
  const deleteModal = useDisclosure();

  useEffect(() => {
    setUsername(user?.name ?? "Ronin");
  }, [user]);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <Box minH="100vh" bg={bg}>
      <Box maxW="1400px" mx="auto" px={6} pt={8} pb={24}>
        <Box mb={7}>
          <Heading size="lg">Settings</Heading>
          <Text mt={1.5} fontSize="sm" color={mutedText}>
            Your account, where your games come from, and this copy of RoninArc.
          </Text>
        </Box>

        {/* One column, in the order people look for things; deleting the account is last. */}
        <Stack spacing={10} maxW="760px">
          <AccountSection name={username} email={user?.email} onLogout={handleLogout} />

          <ProviderSection title="Game sources" description="Import the games you own. Resync to pick up new purchases.">
            <SteamProviderCard />
            <EpicProviderCard />
          </ProviderSection>

          <CloudSyncSection />
          <AppearanceSection />
          <SecuritySection
            onChangePassword={() => setPasswordOpen(true)}
            onLogoutAllDevices={() => setLogoutAllOpen(true)}
          />
          <SupportSection />
          <DangerZoneSection onDeleteAccount={deleteModal.onOpen} />
        </Stack>
      </Box>

      {/* Modals */}
      <ChangePasswordModal
        isOpen={isPasswordOpen}
        onClose={() => setPasswordOpen(false)}
      />

      <LogoutAllDevicesModal
        isOpen={isLogoutAllOpen}
        onClose={() => setLogoutAllOpen(false)}
      />

      <DeleteAccountModal
        isOpen={deleteModal.isOpen}
        onClose={deleteModal.onClose}
      />
    </Box>
  );
}
