import {
  Box,
  Heading,
  Text,
  Button,
  VStack,
  useColorModeValue,
  Divider,
  HStack,
} from "@chakra-ui/react";
import { useColorMode } from "@chakra-ui/react";
import { MoonIcon, SunIcon } from "@chakra-ui/icons";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { deleteCurrentUser, getCurrentUser } from "../utils/auth";

function SettingsPage() {
  // same palette as Library
  const bg = useColorModeValue("gray.50", "gray.900");
  const cardBg = useColorModeValue("white", "gray.800");
  const subtleBorder = useColorModeValue("gray.200", "gray.700");
  const mutedText = useColorModeValue("gray.600", "gray.400");

  const { colorMode, toggleColorMode } = useColorMode();
  const [username, setUsername] = useState<string | null>(null);
  const navigate = useNavigate();

   const currentUser = getCurrentUser();
    const displayName = currentUser?.username.toUpperCase() || "Ronin";
  
    console.log("currentUser::"+currentUser+
      "::displayName::"+displayName
    )
  useEffect(() => {
   const stored = currentUser?.username.toUpperCase() || "Ronin";
    if (stored) setUsername(stored);
  }, []);

  const handleLogout = () => {
    // clear auth stuff
     deleteCurrentUser();

    // (optional) clear anything else you stored for auth here

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

            {/* You can keep these as future options if you want */}
            {/* 
            <Button
              size="sm"
              isDisabled
              justifyContent="flex-start"
              variant="outline"
            >
              Change Password (coming soon)
            </Button>

            <Button
              size="sm"
              isDisabled
              justifyContent="flex-start"
              variant="outline"
              colorScheme="red"
              _disabled={{ opacity: 0.7 }}
            >
              Delete Account (coming soon)
            </Button> 
            */}
          </VStack>
        </Box>
      </Box>
    </Box>
  );
}

export default SettingsPage;
