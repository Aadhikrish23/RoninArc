import {
  Box,
  Button,
  Heading,
  Text,
  VStack,
  useColorModeValue,
  useDisclosure,
} from "@chakra-ui/react";
import { Grid, GridItem, Divider, HStack, Switch } from "@chakra-ui/react";

import { useColorMode } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../../auth/context/AuthContext";

import ChangePasswordModal from "../components/ChangePasswordModal";
import LogoutAllDevicesModal from "../components/LogoutAllDevicesModal";
import DeleteAccountModal from "../components/DeleteAccountModal";
import ImportWizardModal from "../components/ImportWizardModal";

export default function SettingsPage() {
  const bg = useColorModeValue("gray.50", "gray.900");

  const mutedText = useColorModeValue("gray.600", "gray.400");

  const navigate = useNavigate();

  const { logout, user } = useAuth();

  const [username, setUsername] = useState("Unknown User");
  console.log(username)
  const { colorMode, toggleColorMode } = useColorMode();

  const [isPasswordOpen, setPasswordOpen] = useState(false);

  const [isLogoutAllOpen, setLogoutAllOpen] = useState(false);

  const [isImportOpen, setImportOpen] = useState(false);

  const deleteModal = useDisclosure();
  const isDesktop = typeof window !== "undefined" && !!window.electronAPI;

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
            Configure RoninArc launcher preferences.
          </Text>
        </Box>

        <Grid
          templateColumns={{
            base: "1fr",
            lg: "1fr 1fr",
          }}
          gap={6}
        >
          {/* ACCOUNT */}

          <GridItem>
            <Box borderWidth="1px" borderRadius="xl" p={6} h="100%">
              <Heading size="md" mb={5}>
                Account
              </Heading>

              <VStack align="stretch" spacing={3}>
                <Button
                  variant="ghost"
                  justifyContent="start"
                  onClick={() => setPasswordOpen(true)}
                >
                  Change Password
                </Button>

                <Button
                  variant="ghost"
                  justifyContent="start"
                  onClick={handleLogout}
                >
                  Logout
                </Button>

                <Button
                  variant="ghost"
                  justifyContent="start"
                  onClick={() => setLogoutAllOpen(true)}
                >
                  Logout All Devices
                </Button>

                <Button
                  colorScheme="red"
                  variant="ghost"
                  justifyContent="start"
                  onClick={deleteModal.onOpen}
                >
                  Delete Account
                </Button>
              </VStack>
            </Box>
          </GridItem>

          {/* LAUNCHER */}

          <GridItem>
            <Box borderWidth="1px" borderRadius="xl" p={6} h="100%">
              <Heading size="md" mb={5}>
                Launcher
              </Heading>

              <VStack align="stretch" spacing={5}>
                {/* Theme */}

                <HStack justify="space-between">
                  <Text>Dark Mode</Text>

                  <Switch
                    isChecked={colorMode === "dark"}
                    onChange={toggleColorMode}
                    colorScheme="purple"
                  />
                </HStack>

                <Divider />

                {/* Import */}

                <Box>
                  <Text fontWeight="bold" mb={2}>
                    Library Import
                  </Text>

                  {!isDesktop ? (
                    <Box
                      p={3}
                      borderWidth="1px"
                      borderRadius="md"
                      borderColor="orange.500"
                      bg="orange.500/10"
                    >
                      <Text fontSize="sm" color="orange.300">
                        Steam and Epic library scanning requires the desktop
                        version of RoninArc.
                      </Text>
                    </Box>
                  ) : (
                    <>
                      <VStack align="stretch" spacing={2} mb={4}>
                        <HStack justify="space-between">
                          <Text>Steam</Text>

                          <Text color="green.400">✓</Text>
                        </HStack>

                        <HStack justify="space-between">
                          <Text>Epic Games</Text>

                          <Text color="green.400">✓</Text>
                        </HStack>
                      </VStack>

                      <Button
                        colorScheme="purple"
                        onClick={() => setImportOpen(true)}
                      >
                        Import Games
                      </Button>
                    </>
                  )}
                </Box>

              
              </VStack>
            </Box>
          </GridItem>
        </Grid>

        {/* Library Import */}
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

      <ImportWizardModal
        isOpen={isImportOpen}
        onClose={() => setImportOpen(false)}
      />
    </Box>
  );
}
