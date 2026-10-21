import {
  Button,
  
  VStack,
  Badge,
} from "@chakra-ui/react";

import { FiUser } from "react-icons/fi";

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
      title="Account"
      icon={FiUser}
      description="Your RoninArc profile."
    >
      <VStack
        align="stretch"
        spacing={4}
      >
        <Badge
          colorScheme="purple"
          w="fit-content"
          textTransform="none"
          fontSize="sm"
          p={2}
          borderRadius="md"
        >
          {username}
        </Badge>

        <Button
          variant="outline"
          onClick={onLogout}
        >
          Log out
        </Button>
      </VStack>
    </SettingsCard>
  );
}