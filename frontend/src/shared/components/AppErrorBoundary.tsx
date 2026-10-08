import { Component, type ErrorInfo, type ReactNode } from "react";
import { Box, Button, Code, Heading, HStack, Text, VStack } from "@chakra-ui/react";
import { captureException } from "../logging/clientLogger";

interface State {
  error: Error | null;
}

/** Last line of defence: a render crash shows a recovery screen, not a blank window. */
export default class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    captureException(error, { source: "react.errorBoundary", componentStack: info.componentStack?.slice(0, 1500) });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <Box minH="100vh" display="flex" alignItems="center" justifyContent="center" p={6} role="alert">
        <VStack spacing={4} maxW="480px" textAlign="center">
          <Heading size="lg">Something went wrong</Heading>
          <Text color="gray.500">
            RoninArc hit an unexpected error. It has been logged so it can be fixed. Your library is safe.
          </Text>
          <Code fontSize="xs" p={2} borderRadius="md" maxW="100%" whiteSpace="pre-wrap">
            {this.state.error.message}
          </Code>
          <HStack>
            <Button colorScheme="purple" onClick={() => window.location.reload()}>
              Reload
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                window.location.hash = "#/";
                this.setState({ error: null });
              }}
            >
              Go to Library
            </Button>
          </HStack>
        </VStack>
      </Box>
    );
  }
}
