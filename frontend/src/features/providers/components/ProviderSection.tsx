import {
  Heading,
  SimpleGrid,
  VStack,
} from "@chakra-ui/react";

interface Props {
  title?: string;
  children: React.ReactNode;
}

export default function ProviderSection({
  title = "Providers",
  children,
}: Props) {
  return (
    <VStack
      align="stretch"
      spacing={6}
    >
      <Heading size="md">
        {title}
      </Heading>

      <SimpleGrid
        columns={{
          base: 1,
          xl: 2,
        }}
        spacing={6}
      >
        {children}
      </SimpleGrid>
    </VStack>
  );
}