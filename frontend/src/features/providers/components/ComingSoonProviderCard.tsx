import { Button, VStack } from "@chakra-ui/react";
import ProviderCard from "./ProviderCard";
import { PROVIDER_CONFIGS } from "../constants/providers";

interface Props {
  providerId: string;
}

export default function ComingSoonProviderCard({ providerId }: Props) {
  const config = PROVIDER_CONFIGS[providerId];
  if (!config) return null;

  const IconComponent = config.icon;

  return (
    <div style={{ opacity: 0.6 }}>
      <ProviderCard
        title={config.name}
        icon={<IconComponent size={22} />}
        connected={false}
        loading={false}
        description={`Integration with ${config.name} is coming soon. You'll be able to automatically sync your library and playtime tracking.`}
      >
        <VStack align="stretch" spacing={3} w="100%">
          <Button isDisabled variant="outline" size="sm" w="100%">
            Coming Soon
          </Button>
        </VStack>
      </ProviderCard>
    </div>
  );
}
