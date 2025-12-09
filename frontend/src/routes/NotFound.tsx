import {
  Box,
  Flex,
  Heading,
  Text,
  Button,
  VStack,
} from "@chakra-ui/react";
import { Link as RouterLink } from "react-router-dom";

function NotFound() {
  return (
    <Flex
      minH="100vh"
      bg="#0a0a0a"
      align="center"
      justify="center"
      px={4}
    >
      <Box
        w="full"
        maxW="md"
        bg="gray.800"
        borderRadius="xl"
        boxShadow="8px 8px 15px #ff004d"
        p={10}
        textAlign="center"
      >
        <VStack spacing={4}>
          <Heading size="2xl" color="white">
            404
          </Heading>

          <Text fontSize="lg" color="gray.300">
            Oops... this page has gone rogue.
          </Text>

          <Text fontSize="sm" color="gray.500">
            The path you seek does not exist, Ronin.
          </Text>

          <Button
            as={RouterLink}
            to="/"
            mt={4}
            size="md"
            colorScheme="purple"
            w="full"
          >
            Return to Login
          </Button>

          
        </VStack>
      </Box>
    </Flex>
  );
}

export default NotFound;
