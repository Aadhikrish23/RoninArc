import {
  Box,
  VStack,
  HStack,
  Text,
  Badge,
  useColorModeValue,
  Collapse,
  Button,
  Progress,
  Icon,
} from "@chakra-ui/react";
import { useState } from "react";
import type { JSX } from "react";
import { FiActivity, FiChevronDown, FiChevronUp } from "react-icons/fi";

interface ExecutionSummaryProps {
  metrics?: {
    overallMs: number;
    layers: Record<string, number>;
  };
}

export default function ExecutionSummary({
  metrics,
}: ExecutionSummaryProps): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const borderColor = useColorModeValue("gray.200", "gray.700");
  const mutedText = useColorModeValue("gray.500", "gray.400");
  const summaryBg = useColorModeValue("gray.50", "gray.850");
  const progressBg = useColorModeValue("gray.200", "gray.700");

  if (!metrics) return <></>;

  const layers = metrics.layers || {};
  const overallMs = metrics.overallMs || 1;

  const formatKey = (key: string): string => {
    return key
      .replace(/[-_]+/g, " ")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  };

  const activeLayers = Object.entries(layers)
    .filter(([, value]) => value > 0)
    .map(([key, value]) => ({
      name: formatKey(key),
      duration: value,
      percentage: Math.min(100, Math.round((value / overallMs) * 100)),
    }));

  return (
    <Box mt={3} borderTopWidth="1px" borderColor={borderColor} pt={2} w="full">
      {/* Collapsible Trigger */}
      <Button
        size="xs"
        variant="ghost"
        colorScheme="purple"
        onClick={() => setIsOpen(!isOpen)}
        leftIcon={<Icon as={FiActivity} />}
        rightIcon={<Icon as={isOpen ? FiChevronUp : FiChevronDown} />}
        px={2}
      >
        Execution Summary ({metrics.overallMs}ms)
      </Button>

      <Collapse in={isOpen} animateOpacity>
        <Box
          mt={2}
          p={4}
          borderRadius="xl"
          bg={summaryBg}
          borderWidth="1px"
          borderColor={borderColor}
        >
          <VStack align="stretch" spacing={3}>
            <HStack justify="space-between">
              <Text fontSize="xs" fontWeight="bold" color="purple.400">
                Backend Performance Breakdown
              </Text>
              <Badge colorScheme="purple" variant="subtle" fontSize="10px">
                Total: {metrics.overallMs}ms
              </Badge>
            </HStack>

            {activeLayers.length === 0 ? (
              <Text fontSize="xs" color={mutedText}>
                No individual layer breakdown available.
              </Text>
            ) : (
              activeLayers.map((layer, idx) => (
                <Box key={idx}>
                  <HStack justify="space-between" mb={1}>
                    <Text fontSize="xs" color="gray.300">
                      {layer.name}
                    </Text>
                    <Text fontSize="xs" fontWeight="semibold" color="purple.300">
                      {layer.duration}ms
                    </Text>
                  </HStack>
                  <Progress
                    value={layer.percentage}
                    size="xs"
                    colorScheme="purple"
                    borderRadius="full"
                    bg={progressBg}
                  />
                </Box>
              ))
            )}
          </VStack>
        </Box>
      </Collapse>
    </Box>
  );
}
