import { Box, Button, Heading, Text, useColorModeValue } from "@chakra-ui/react";

interface Props {
  /** "Couldn't load your library" */
  title: string;
  message?: string | null;
  onRetry?: () => void;
}

/** A page that failed to load: what failed, why, and a way to try again. */
export default function LoadError({ title, message, onRetry }: Props) {
  const muted = useColorModeValue("gray.600", "gray.400");
  return (
    <Box role="alert" w="100%" py={10} textAlign="center" borderWidth="1px" borderStyle="dashed" borderRadius="xl">
      <Heading size="sm" mb={2}>
        {title}
      </Heading>
      {message && (
        <Text color={muted} fontSize="sm" mb={onRetry ? 4 : 0}>
          {message}
        </Text>
      )}
      {onRetry && (
        <Button size="sm" colorScheme="purple" variant="outline" onClick={onRetry}>
          Try again
        </Button>
      )}
    </Box>
  );
}
