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

import type { RawgGameResult, Game } from "../types/library";
import RawgSearchDropdown from "./RawgSearchDropdown";
import { rankSearchResults } from "../utils/searchRanking";
import { useMemo } from "react";

interface RawgSearchProps {
  searchText: string;
  onSearchChange: (value: string) => void;
  ownedResults: Game[];
  discoverResults: RawgGameResult[];
  loading: boolean;
  error: string | null;
  onAddGame: (game: RawgGameResult) => void;
  onSearchSubmit: () => void;
}

export default function RawgSearch({
  searchText,
  onSearchChange,
  ownedResults,
  discoverResults,
  loading,
  error,
  onSearchSubmit,
}: RawgSearchProps) {
  const cardBg = useColorModeValue("white", "gray.800");

  const subtleBorder = useColorModeValue("gray.200", "gray.700");
 
  const rankedDiscoverResults = useMemo(
    () =>
      rankSearchResults(
        discoverResults,
        searchText
      ),
    [discoverResults, searchText]
  );
console.log("RAWG Results", discoverResults);
console.log("Ranked Results", rankedDiscoverResults);
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

        {!error && searchText.trim() && (ownedResults.length > 0 || discoverResults.length > 0) && (
          <RawgSearchDropdown
            ownedResults={ownedResults}
            discoverResults={rankedDiscoverResults}
            onViewAll={onSearchSubmit}
          />
        )}
      </Box>
    </>
  );
}
