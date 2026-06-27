import {
  Box,
  Heading,
  Text,
  useColorModeValue,
  useDisclosure,
  Grid,
  GridItem,
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

import ProviderSection from "../../providers/components/ProviderSection";
import EpicProviderCard from "../../providers/epic/components/EpicProviderCard";
import SteamProviderCard from "../../providers/steam/components/SteamProviderCard";
import ComingSoonProviderCard from "../../providers/components/ComingSoonProviderCard";

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
    setUsername(user?.name?.toUpperCase() ?? "RONIN");
  }, [user]);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <Box minH="100vh" bg={bg}>
      <Box maxW="900px" mx="auto" px={6} py={8}>
        <Box mb={8}>
          <Heading size="lg">Settings</Heading>
          <Text mt={2} color={mutedText}>
            Configure RoninArc launcher preferences and manage account connections.
          </Text>
        </Box>

        <Grid
          templateColumns={{
            base: "1fr",
            md: "1fr 1fr",
          }}
          gap={6}
        >
          <GridItem>
            <AccountSection username={username} onLogout={handleLogout} />
          </GridItem>

          <GridItem>
            <AppearanceSection />
          </GridItem>

          <GridItem colSpan={{ base: 1, md: 2 }}>
            <ProviderSection title="🔌 Account Connections">
              <EpicProviderCard />
              <SteamProviderCard />
              {/* <ComingSoonProviderCard providerId="gog" /> */}
            </ProviderSection>
          </GridItem>

          <GridItem>
            <SecuritySection
              onChangePassword={() => setPasswordOpen(true)}
              onLogoutAllDevices={() => setLogoutAllOpen(true)}
            />
          </GridItem>

          <GridItem>
            <DangerZoneSection onDeleteAccount={deleteModal.onOpen} />
          </GridItem>
        </Grid>
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
