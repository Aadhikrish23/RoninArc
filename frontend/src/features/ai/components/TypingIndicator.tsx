import { Box, HStack } from "@chakra-ui/react";
import type { JSX } from "react";

export default function TypingIndicator(): JSX.Element {
  const dotAnimation = `
    @keyframes bounce {
      0%, 80%, 100% { transform: translateY(0); }
      40% { transform: translateY(-6px); }
    }
  `;

  return (
    <Box display="flex" justifyContent="flex-start" mb={4}>
      <style>{dotAnimation}</style>
      <Box
        maxW="70%"
        px={4}
        py={3}
        borderRadius="2xl"
        borderBottomLeftRadius="sm"
        bg="gray.800"
        borderWidth="1px"
        borderColor="gray.700"
      >
        <HStack spacing={2} align="center" h="20px" px={1}>
          {[0, 1, 2].map((i) => (
            <Box
              key={i}
              w="8px"
              h="8px"
              bg="purple.400"
              borderRadius="full"
              style={{
                animation: "bounce 1.4s infinite ease-in-out both",
                animationDelay: `${i * 0.16}s`,
              }}
            />
          ))}
        </HStack>
      </Box>
    </Box>
  );
}
