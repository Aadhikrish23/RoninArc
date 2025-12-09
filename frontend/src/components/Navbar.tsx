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
import { useNavigate } from "react-router-dom";
import { getCurrentUser } from "../utils/auth";

function Navbar() {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();
  const displayName = currentUser?.username || "Player";

  const subtleBorder = useColorModeValue("gray.200", "gray.700");

  return (
    <Box
      as="header"
      borderBottomWidth="1px"
      borderColor={subtleBorder}
      px={8}
      py={4}
      bg={useColorModeValue("whiteAlpha.900", "gray.900")}
      backdropFilter="blur(12px)"
      position="sticky"
      top={0}
      zIndex={10}
    >
      <Flex align="center" maxW="1200px" mx="auto">
        <Heading
          size="md"
          cursor="pointer"
          onClick={() => navigate("/")}
        >
          RoninArc
        </Heading>

        {/* Navigation Buttons */}
        <HStack spacing={4} ml={10}>
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
            Dashboard
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/")}
            fontWeight="semibold"
          >
            Library
          </Button>

          <Button variant="ghost" size="sm" onClick={() => navigate("/settings")}>
            Settings
          </Button>
        </HStack>

        <Spacer />

        {/* User Profile */}
        <HStack spacing={3}>
          <Avatar size="sm" name={displayName} />
          <Text fontSize="sm">{displayName}</Text>

          {/* TODO: Logout button later */}
        </HStack>
      </Flex>
    </Box>
  );
}

export default Navbar;
