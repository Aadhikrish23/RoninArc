import {
  Box,
  Input,
  InputGroup,
  InputLeftElement,
  Icon,
  Spinner,
  useColorModeValue,
  InputRightElement,
} from "@chakra-ui/react";

import { SearchIcon } from "@chakra-ui/icons";

import type { RawgGameResult } from "../types/library";
import RawgSearchDropdown from "./RawgSearchDropdown";
import { rankSearchResults } from "../utils/searchRanking";
import { useMemo } from "react";

interface RawgSearchProps {
  searchText: string;

  onSearchChange: (value: string) => void;

  results: RawgGameResult[];

  loading: boolean;

  error: string | null;

  onAddGame: (game: RawgGameResult) => void;
  onSearchSubmit: () => void;
}

export default function RawgSearch({
  searchText,
  onSearchChange,
  results,
  loading,
  error,
  onAddGame,
  onSearchSubmit,
}: RawgSearchProps) {
  const cardBg = useColorModeValue("white", "gray.800");

  const subtleBorder = useColorModeValue("gray.200", "gray.700");
 
const rankedResults = useMemo(
  () =>
    rankSearchResults(
      results,
      searchText
    ),
  [results, searchText]
);
console.log("RAWG Results", results);
console.log("Ranked Results", rankedResults);
  return (
    <>
      <Box mb={6}>
        <InputGroup size="lg">
          <InputLeftElement>
            <Icon as={SearchIcon} color="gray.400" />
          </InputLeftElement>

          <Input
            placeholder="Search games..."
            value={searchText}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                onSearchSubmit();
              }
            }}
            borderRadius="xl"
            bg={cardBg}
            borderColor={subtleBorder}
          />
          <InputRightElement>
            {loading && <Spinner size="sm" />}
          </InputRightElement>
        </InputGroup>

        {!error && searchText.trim() && results.length > 0 && (
          
          <RawgSearchDropdown
            results={rankedResults.slice(0, 5)}
            onViewAll={onSearchSubmit}
          />
        )}
      </Box>
    </>
  );
}
