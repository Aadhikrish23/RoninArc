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
import { useMemo, useEffect, useRef, useState } from "react";

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

  // The suggestions close on Escape, a click elsewhere, or Enter (which opens the full results).
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setDropdownOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);
  return (
    <>
      <Box mb={6} ref={wrapperRef} position="relative">
        <InputGroup size="lg">
          <InputLeftElement>
            <Icon as={SearchIcon} color="gray.400" />
          </InputLeftElement>

          <Input
            placeholder="Search games..."
            value={searchText}
            onChange={(e) => {
              onSearchChange(e.target.value);
              setDropdownOpen(true);
            }}
            onFocus={() => setDropdownOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setDropdownOpen(false);
                onSearchSubmit();
              }
              if (e.key === "Escape") setDropdownOpen(false);
            }}
            borderRadius="xl"
            bg={cardBg}
            borderColor={subtleBorder}
          />
          <InputRightElement>
            {loading && <Spinner size="sm" />}
          </InputRightElement>
        </InputGroup>

        {dropdownOpen && !error && searchText.trim() && (ownedResults.length > 0 || discoverResults.length > 0) && (
          <RawgSearchDropdown
            ownedResults={ownedResults}
            discoverResults={rankedDiscoverResults}
            onViewAll={() => {
              setDropdownOpen(false);
              onSearchSubmit();
            }}
          />
        )}
      </Box>
    </>
  );
}
