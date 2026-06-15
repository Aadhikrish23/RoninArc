import { HStack, Button } from "@chakra-ui/react";

interface StatusFilterProps {
  selectedStatus: string;

  onStatusChange: (
    status: string
  ) => void;
}

const STATUS_FILTERS = [
  { label: "All", value: "all" },
  { label: "Plan to Play", value: "plan" },
  { label: "Playing", value: "playing" },
  { label: "Completed", value: "completed" },
  { label: "Dropped", value: "dropped" },
];

export default function StatusFilter({
  selectedStatus,
  onStatusChange,
}: StatusFilterProps) {
  return (
    <HStack spacing={3} mb={6} wrap="wrap">
      {STATUS_FILTERS.map((status) => (
        <Button
          key={status.value}
          size="sm"
          borderRadius="full"
          variant={
            selectedStatus === status.value
              ? "solid"
              : "outline"
          }
          colorScheme={
            selectedStatus === status.value
              ? "purple"
              : undefined
          }
          onClick={() =>
            onStatusChange(status.value)
          }
        >
          {status.label}
        </Button>
      ))}
    </HStack>
  );
}