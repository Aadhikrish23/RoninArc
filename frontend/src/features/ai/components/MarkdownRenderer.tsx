import { Box, Text, Code, UnorderedList, ListItem } from "@chakra-ui/react";
import type { JSX } from "react";

interface MarkdownRendererProps {
  content: string;
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps): JSX.Element {
  if (!content) return <></>;

  // Regex to split code blocks
  const parts = content.split(/(```[\s\S]*?```)/g);

  return (
    <Box>
      {parts.map((part, index) => {
        if (part.startsWith("```") && part.endsWith("```")) {
          // Parse code block
          const lines = part.slice(3, -3).trim().split("\n");
          let language = "text";
          let codeContent = part.slice(3, -3).trim();

          // Check if first line is a language identifier
          if (lines.length > 0 && /^[a-zA-Z0-9+#-]+$/.test(lines[0])) {
            language = lines[0];
            codeContent = lines.slice(1).join("\n");
          }

          return (
            <Box key={index} my={3} borderRadius="md" overflow="hidden">
              {language !== "text" && (
                <Box
                  bg="gray.800"
                  color="gray.400"
                  px={3}
                  py={1}
                  fontSize="xs"
                  fontFamily="mono"
                  borderBottom="1px solid"
                  borderColor="gray.700"
                  display="flex"
                  justifyContent="space-between"
                  alignItems="center"
                >
                  <span>{language.toUpperCase()}</span>
                </Box>
              )}
              <Code
                display="block"
                whiteSpace="pre-wrap"
                p={3}
                bg="gray.800"
                color="green.300"
                fontSize="sm"
                fontFamily="mono"
                overflowX="auto"
                w="full"
              >
                {codeContent}
              </Code>
            </Box>
          );
        }

        // Inline formatting (bold, lists, inline code, paragraphs)
        const inlineLines = part.split("\n");
        return (
          <Box key={index}>
            {inlineLines.map((line, lineIdx) => {
              const trimmed = line.trim();

              // Empty lines
              if (!trimmed) {
                return <Box key={lineIdx} h={2} />;
              }

              // Bullet list item
              if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
                return (
                  <UnorderedList key={lineIdx} pl={4} my={1}>
                    <ListItem fontSize="md" lineHeight="tall">
                      {renderFormattedText(trimmed.substring(2))}
                    </ListItem>
                  </UnorderedList>
                );
              }

              // Header 1-6
              const headerMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
              if (headerMatch) {
                const level = headerMatch[1].length;
                const text = headerMatch[2];
                const sizes = ["xl", "lg", "md", "sm", "xs", "xs"];
                return (
                  <Text
                    key={lineIdx}
                    fontWeight="bold"
                    fontSize={sizes[level - 1]}
                    mt={3}
                    mb={2}
                  >
                    {renderFormattedText(text)}
                  </Text>
                );
              }

              // Default paragraph
              return (
                <Text key={lineIdx} fontSize="md" mb={2} lineHeight="tall">
                  {renderFormattedText(line)}
                </Text>
              );
            })}
          </Box>
        );
      })}
    </Box>
  );
}

function renderFormattedText(text: string): JSX.Element {
  // Regex to detect bold (**text**) and inline code (`code`)
  const tokens = text.split(/(\*\*.*?\*\*|`.*?`)/g);

  return (
    <>
      {tokens.map((token, i) => {
        if (token.startsWith("**") && token.endsWith("**")) {
          return (
            <Box as="span" key={i} fontWeight="extrabold">
              {token.slice(2, -2)}
            </Box>
          );
        }
        if (token.startsWith("`") && token.endsWith("`")) {
          return (
            <Code
              key={i}
              as="span"
              fontSize="sm"
              fontFamily="mono"
              px={1.5}
              py={0.5}
              borderRadius="md"
              bg="whiteAlpha.200"
              color="purple.300"
            >
              {token.slice(1, -1)}
            </Code>
          );
        }
        return token;
      })}
    </>
  );
}
