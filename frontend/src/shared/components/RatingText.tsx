import { HStack, Icon, Text, useColorModeValue, type TextProps } from "@chakra-ui/react";
import { FaStar } from "react-icons/fa";

/** "★ 9/10" everywhere a score shows: one drawn star, readable on light and dark backgrounds. */
export default function RatingText({ children, ...props }: TextProps) {
  const star = useColorModeValue("yellow.500", "yellow.300");
  return (
    <Text as="span" display="inline-flex" alignItems="center" {...props}>
      <HStack as="span" spacing={1}>
        <Icon as={FaStar} color={star} boxSize="0.85em" aria-hidden />
        <span>{children}</span>
      </HStack>
    </Text>
  );
}
