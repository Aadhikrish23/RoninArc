import {
  Box,
  Flex,
  Heading,
  HStack,
  Button,
  Avatar,
  Text,
  Spacer,
  useColorModeValue,
} from "@chakra-ui/react";
import { useLocation, useNavigate } from "react-router-dom";
// import { getCurrentUser } from "../utils/auth";
import { useAuth } from "../../features/auth/context/AuthContext";

function Navbar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  // The tab for the page you're on is highlighted; focus outlines alone made the wrong tab look active.
  const active = (section: "dashboard" | "library" | "settings") =>
    section === "dashboard" ? pathname.startsWith("/dashboard")
      : section === "settings" ? pathname.startsWith("/settings")
        : !pathname.startsWith("/dashboard") && !pathname.startsWith("/settings") && !pathname.startsWith("/ai");
  const tab = (section: "dashboard" | "library" | "settings") => ({
    variant: active(section) ? "solid" : "ghost",
    colorScheme: active(section) ? "purple" : undefined,
    "aria-current": active(section) ? ("page" as const) : undefined,
  });

  const { user } = useAuth();

  const displayName = user?.name || "Player";

  const subtleBorder = useColorModeValue("gray.200", "gray.700");

  return (
    <Box
      as="header"
      borderBottomWidth="1px"
      borderColor={subtleBorder}
      py={4}
      bg={useColorModeValue("whiteAlpha.900", "gray.900")}
      backdropFilter="blur(12px)"
      position="sticky"
      top={0}
      zIndex={10}
    >
      {/* Same width and gutter as the library pages, so the logo lines up with the content. */}
      <Flex align="center" maxW="1400px" mx="auto" px={6}>
        <Heading as="button" size="md" cursor="pointer" aria-label="RoninArc home" onClick={() => navigate("/", { state: { libraryHome: Date.now() } })}>
          RoninArc
        </Heading>

        {/* Navigation Buttons */}
        <HStack spacing={4} ml={10}>
          <Button
            {...tab("dashboard")}
            size="sm"
            onClick={() => navigate("/dashboard")}
          >
            Dashboard
          </Button>

          <Button
            {...tab("library")}
            size="sm"
            onClick={() => navigate("/", { state: { libraryHome: Date.now() } })}
          >
            Library
          </Button>

          <Button
            {...tab("settings")}
            size="sm"
            onClick={() => navigate("/settings")}
          >
            Settings
          </Button>
        </HStack>

        <Spacer />

        {/* User Profile */}
        <HStack spacing={3}>
          <Avatar size="sm" name={displayName} bg="purple.500" color="white" />
          <Text fontSize="sm">{displayName}</Text>

          {/* TODO: Logout button later */}
        </HStack>
      </Flex>
    </Box>
  );
}

export default Navbar;
