import { Box, Flex, Grid, Heading, HStack, Spinner, Text, useColorModeValue, type BoxProps } from "@chakra-ui/react";
import type { ReactNode } from "react";

/**
 * Settings is one column of sections. Each section is a heading (plus an optional line about it)
 * over a panel of rows: what a setting is on the left, its buttons on the right.
 */

export function SettingsSection({ id, title, description, children }: { id?: string; title: string; description?: string; children: ReactNode }) {
  const muted = useColorModeValue("gray.600", "gray.400");
  return (
    <Box as="section" id={id} aria-labelledby={id ? `${id}-title` : undefined}>
      <Box mb={3}>
        <Heading as="h2" id={id ? `${id}-title` : undefined} fontSize="md" fontWeight="semibold">
          {title}
        </Heading>
        {description && (
          <Text mt={0.5} fontSize="sm" color={muted} maxW="64ch">
            {description}
          </Text>
        )}
      </Box>
      {children}
    </Box>
  );
}

export function SettingsPanel({ danger = false, children, ...rest }: { danger?: boolean; children: ReactNode } & BoxProps) {
  const bg = useColorModeValue("white", "gray.800");
  const border = useColorModeValue(danger ? "red.200" : "gray.200", danger ? "rgba(252,129,129,0.35)" : "whiteAlpha.100");
  const line = useColorModeValue("gray.200", "whiteAlpha.100");
  return (
    <Box
      bg={bg}
      borderWidth="1px"
      borderColor={border}
      borderRadius="xl"
      sx={{ "& > * + *": { borderTopWidth: "1px", borderTopColor: line } }}
      {...rest}
    >
      {children}
    </Box>
  );
}

interface RowProps {
  label: ReactNode;
  /** A status shown next to the label. */
  status?: ReactNode;
  /** A sentence about the setting, or facts about it (name, counts, when). */
  detail?: ReactNode;
  /** An avatar or icon before the label. */
  lead?: ReactNode;
  actions?: ReactNode;
  /** Shaded, for a question asked in place ("Stop syncing this PC?"). */
  highlight?: boolean;
  children?: ReactNode;
}

export function SettingsRow({ label, status, detail, lead, actions, highlight, children }: RowProps) {
  const muted = useColorModeValue("gray.600", "gray.400");
  const shade = useColorModeValue("gray.50", "whiteAlpha.50");
  return (
    <Box px={5} py={4} bg={highlight ? shade : undefined}>
      <Grid templateColumns={{ base: "1fr", md: "minmax(0, 1fr) auto" }} gap={{ base: 3, md: 6 }} alignItems="center">
        <HStack spacing={3.5} minW={0} align="center">
          {lead}
          <Box minW={0}>
            <HStack spacing={2.5} align="center" flexWrap="wrap">
              <Text fontSize="15px" fontWeight="semibold">
                {label}
              </Text>
              {status}
            </HStack>
            {detail && (
              <Text as="div" fontSize="sm" color={muted} mt={0.5} maxW="60ch" sx={{ fontVariantNumeric: "tabular-nums" }}>
                {detail}
              </Text>
            )}
          </Box>
        </HStack>
        {actions && (
          <Flex gap={2} align="center" justify={{ base: "flex-start", md: "flex-end" }} flexWrap="wrap">
            {actions}
          </Flex>
        )}
      </Grid>
      {children}
    </Box>
  );
}

export type StatusTone = "ok" | "off" | "warn" | "error" | "busy";

/** A small coloured dot and a word: "Connected", "Not connected", "Paused". */
export function StatusDot({ tone, children }: { tone: StatusTone; children: ReactNode }) {
  const colors = {
    ok: useColorModeValue("green.600", "green.300"),
    off: useColorModeValue("gray.500", "gray.500"),
    warn: useColorModeValue("orange.600", "orange.300"),
    error: useColorModeValue("red.600", "red.300"),
    busy: useColorModeValue("purple.600", "purple.200"),
  };
  return (
    <HStack as="span" spacing={1.5} fontSize="13px" fontWeight="semibold" color={colors[tone]}>
      {tone === "busy" ? <Spinner size="xs" speed="0.8s" /> : <Box as="span" w="8px" h="8px" borderRadius="full" bg="currentColor" />}
      <span>{children}</span>
    </HStack>
  );
}

/** The square holding a store's logo. */
export function IconTile({ children }: { children: ReactNode }) {
  const bg = useColorModeValue("gray.50", "whiteAlpha.50");
  const border = useColorModeValue("gray.200", "whiteAlpha.100");
  return (
    <Flex w="36px" h="36px" flex="none" borderRadius="lg" align="center" justify="center" bg={bg} borderWidth="1px" borderColor={border} aria-hidden>
      {children}
    </Flex>
  );
}

/** Small print at the bottom of a panel. */
export function SettingsNote({ children }: { children: ReactNode }) {
  const muted = useColorModeValue("gray.600", "gray.400");
  return (
    <Box px={5} py={3} fontSize="13px" color={muted}>
      {children}
    </Box>
  );
}
