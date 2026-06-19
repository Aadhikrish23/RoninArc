import {
  Box,
  Heading,
  Text,
  Button,
  VStack,
  useColorModeValue,
  Divider,
  HStack,
  useDisclosure,
} from "@chakra-ui/react";
import { useColorMode } from "@chakra-ui/react";
import { MoonIcon, SunIcon } from "@chakra-ui/icons";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
// import { deleteCurrentUser, getCurrentUser } from "../utils/auth";
import { useAuth } from "../context/AuthContext";
import ChangePasswordModal from "../features/settings/components/ChangePasswordModal";
import LogoutAllDevicesModal from "../features/settings/components/LogoutAllDevicesModal";

import DeleteAccountModal from "../features/settings/components/DeleteAccountModal";

function SettingsPage() {
  // same palette as Library
  const bg = useColorModeValue("gray.50", "gray.900");
  const cardBg = useColorModeValue("white", "gray.800");
  const subtleBorder = useColorModeValue("gray.200", "gray.700");
  const mutedText = useColorModeValue("gray.600", "gray.400");

  const { colorMode, toggleColorMode } = useColorMode();
  const [username, setUsername] = useState<string | null>(null);
  const [isPasswordOpen, setPasswordOpen] = useState(false);
  const [isLogoutAllOpen, setLogoutAllOpen] = useState(false);
  const navigate = useNavigate();
  const deleteModal = useDisclosure();
  const { logout, user } = useAuth();

  //  const currentUser = getCurrentUser();
  const displayName = user?.name.toUpperCase() || "Ronin";

  useEffect(() => {
    const stored = user?.name.toUpperCase() || "Ronin";

    setUsername(stored);
  }, [user]);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <Box minH="100vh" bg={bg}>
      <Navbar />

      <Box maxW="1200px" mx="auto" px={6} py={8}>
        {/* Header */}
        <Box mb={6}>
          <Heading size="lg">Settings</Heading>
          <Text fontSize="sm" color={mutedText} mt={1}>
            Manage your RoninArc account and preferences.
          </Text>
        </Box>

        {/* Card */}
        <Box
          borderWidth="1px"
          borderRadius="xl"
          borderColor={subtleBorder}
          bg={cardBg}
          p={6}
          boxShadow="sm"
        >
          <VStack align="stretch" spacing={5}>
            {/* Theme section */}
            <HStack justify="space-between" align="flex-start">
              <Box>
                <Text fontWeight="medium">Theme</Text>
                <Text fontSize="sm" color={mutedText}>
                  Switch between light and dark mode.
                </Text>
              </Box>

              <Button
                size="sm"
                onClick={toggleColorMode}
                leftIcon={colorMode === "light" ? <MoonIcon /> : <SunIcon />}
                variant="outline"
              >
                {colorMode === "light" ? "Dark mode" : "Light mode"}
              </Button>
            </HStack>

            <Divider />

            {/* Account + logout */}
            <Box>
              <Text fontWeight="medium" mb={1}>
                Account
              </Text>
              <Text fontSize="sm" color={mutedText}>
                Logged in as: <strong>{username ?? "Unknown user"}</strong>
              </Text>
            </Box>

            <Button
              size="sm"
              colorScheme="red"
              alignSelf="flex-start"
              onClick={handleLogout}
            >
              Logout
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setPasswordOpen(true)}
            >
              Change Password
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setLogoutAllOpen(true)}
            >
              Logout All Devices
            </Button>
            <Button
              size="sm"
              colorScheme="red"
              variant="outline"
              alignSelf="flex-start"
              onClick={deleteModal.onOpen}
            >
              Delete Account
            </Button>
          </VStack>
        </Box>
      </Box>
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

export default SettingsPage;
