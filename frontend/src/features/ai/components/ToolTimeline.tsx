import {
  Box,
  VStack,
  HStack,
  Text,
  Icon,
  Badge,
  useColorModeValue,
  Collapse,
  Button,
} from "@chakra-ui/react";
import { useState } from "react";
import type { JSX } from "react";
import { FiCheckCircle, FiClock, FiActivity, FiChevronDown, FiChevronUp } from "react-icons/fi";

interface ToolTimelineProps {
  metrics?: {
    overallMs: number;
    layers: Record<string, number>;
  };
  status?: string;
}

export default function ToolTimeline({
  metrics,
  status = "SUCCESS",
}: ToolTimelineProps): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const borderColor = useColorModeValue("gray.200", "gray.700");
  const mutedText = useColorModeValue("gray.500", "gray.400");
  const timelineBg = useColorModeValue("gray.50", "gray.850");

  if (!metrics) return <></>;

  const layers = metrics.layers || {};

  const timelineSteps = [
    {
      name: "Load Session & Context",
      duration: layers.conversation ?? 0,
      description: "Loaded conversation state and user session metadata.",
    },
    {
      name: "Resumed Memory Store",
      duration: layers.memory ?? 0,
      description: "Fetched active context parameters and player preferences.",
    },
    {
      name: "Planned Execution Steps",
      duration: layers.planning ?? 0,
      description: "Generated planning targets and evaluated constraints.",
    },
    {
      name: "Executed Target Action",
      duration: layers.execution ?? 0,
      description: "Called native application components and resolved outcomes.",
    },
  ];

  return (
    <Box mt={3} borderTopWidth="1px" borderColor={borderColor} pt={2}>
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
        Agent Execution Trace ({metrics.overallMs}ms)
      </Button>

      <Collapse in={isOpen} animateOpacity>
        <Box
          mt={2}
          p={4}
          borderRadius="xl"
          bg={timelineBg}
          borderWidth="1px"
          borderColor={borderColor}
        >
          <VStack align="stretch" spacing={4} position="relative" pl={4}>
            {/* Vertical timeline line decoration */}
            <Box
              position="absolute"
              left="19px"
              top="16px"
              bottom="16px"
              w="2px"
              bg="purple.500"
              opacity={0.3}
              zIndex={0}
            />

            {timelineSteps.map((step, idx) => {
              const isLast = idx === timelineSteps.length - 1;
              const isStepSuccess = status === "SUCCESS" || !isLast;

              return (
                <HStack key={idx} align="flex-start" spacing={3} position="relative" zIndex={1}>
                  {/* Timeline Node */}
                  <Icon
                    as={isStepSuccess ? FiCheckCircle : FiClock}
                    color={isStepSuccess ? "green.400" : "yellow.500"}
                    w={5}
                    h={5}
                    bg={timelineBg}
                    borderRadius="full"
                  />

                  {/* Step Description */}
                  <Box flex="1">
                    <HStack justify="space-between">
                      <Text fontSize="xs" fontWeight="bold">
                        {step.name}
                      </Text>
                      {step.duration > 0 && (
                        <Badge variant="subtle" colorScheme="gray" fontSize="9px">
                          {step.duration}ms
                        </Badge>
                      )}
                    </HStack>
                    <Text fontSize="10px" color={mutedText} mt={0.5}>
                      {step.description}
                    </Text>
                  </Box>
                </HStack>
              );
            })}
          </VStack>
        </Box>
      </Collapse>
    </Box>
  );
}
