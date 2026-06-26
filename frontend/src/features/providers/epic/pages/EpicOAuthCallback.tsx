import {
  Box,
  Heading,
  Spinner,
  Text,
  Button,
  VStack,
  Icon,
  useColorModeValue,
} from "@chakra-ui/react";
import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircleIcon, WarningIcon } from "@chakra-ui/icons";
import useEpic from "../hooks/useEpic";

export default function EpicOAuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const code = searchParams.get("code");
  const { connect } = useEpic();

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [importedCount, setImportedCount] = useState(0);

  const hasCalledConnect = useRef(false);

  const bg = useColorModeValue("gray.50", "gray.900");
  const cardBg = useColorModeValue("white", "gray.800");

  useEffect(() => {
    if (!code) {
      setStatus("error");
      setErrorMessage("No authorization code was found in the URL. Please try again.");
      return;
    }

    if (hasCalledConnect.current) return;
    hasCalledConnect.current = true;

    const performConnection = async () => {
      try {
        const result = await connect(code);
        setImportedCount(result.importedGames || 0);
        setStatus("success");
        setTimeout(() => {
          navigate("/settings");
        }, 3000);
      } catch (err: any) {
        console.error(err);
        setStatus("error");
        setErrorMessage(
          err?.response?.data?.error ||
            err?.message ||
            "Failed to connect to Epic Games."
        );
      }
    };

    performConnection();
  }, [code, connect, navigate]);

  return (
    <Box
      minH="100vh"
      bg={bg}
      display="flex"
      alignItems="center"
      justifyContent="center"
      p={4}
    >
      <Box
        maxW="md"
        w="100%"
        bg={cardBg}
        borderWidth="1px"
        borderColor={useColorModeValue("gray.200", "whiteAlpha.100")}
        borderRadius="2xl"
        p={8}
        boxShadow="xl"
        textAlign="center"
      >
        <VStack spacing={6}>
          {status === "loading" && (
            <>
              <Spinner size="xl" color="blue.400" thickness="4px" />
              <Heading size="md">Connecting Epic Games</Heading>
              <Text color="gray.500">
                Please wait while we verify your account and sync your library...
              </Text>
            </>
          )}

          {status === "success" && (
            <>
              <Icon as={CheckCircleIcon} w={12} h={12} color="green.400" />
              <Heading size="md" color="green.400">
                Connection Successful!
              </Heading>
              <Text color="gray.500">
                Your Epic Games account has been connected. Imported{" "}
                <strong>{importedCount}</strong> games.
              </Text>
              <Text fontSize="sm" color="gray.400">
                Redirecting back to settings...
              </Text>
              <Button
                colorScheme="blue"
                onClick={() => navigate("/settings")}
              >
                Go to Settings
              </Button>
            </>
          )}

          {status === "error" && (
            <>
              <Icon as={WarningIcon} w={12} h={12} color="red.400" />
              <Heading size="md" color="red.400">
                Connection Failed
              </Heading>
              <Text color="red.300" fontSize="sm">
                {errorMessage}
              </Text>
              <Button
                colorScheme="purple"
                onClick={() => navigate("/settings")}
              >
                Return to Settings
              </Button>
            </>
          )}
        </VStack>
      </Box>
    </Box>
  );
}
