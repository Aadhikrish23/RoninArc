import {
  Button,
  Text,
  VStack,
  Badge,
} from "@chakra-ui/react";

import SettingsCard from "./SettingsCard";

interface Props {
  username: string;
  onLogout: () => void;
}

export default function AccountSection({
  username,
  onLogout,
}: Props) {
  return (
    <SettingsCard
      title="👤 Account"
      description="Your RoninArc profile."
    >
      <VStack
        align="stretch"
        spacing={4}
      >
        <Badge
          colorScheme="purple"
          w="fit-content"
          p={2}
          borderRadius="md"
        >
          {username}
        </Badge>

        <Button
          colorScheme="red"
          onClick={onLogout}
        >
          Logout
        </Button>
      </VStack>
    </SettingsCard>
  );
}