import {
  Box,
  Input,
  InputGroup,
  InputLeftElement,
  Icon,
  Spinner,
  useColorModeValue,
  InputRightElement,
  Text,
} from "@chakra-ui/react";

import { SearchIcon } from "@chakra-ui/icons";

import type { RawgGameResult, Game } from "../types/library";
import RawgSearchDropdown from "./RawgSearchDropdown";
import { useEffect, useRef, useState } from "react";

interface RawgSearchProps {
  searchText: string;
  onSearchChange: (value: string) => void;
  ownedResults: Game[];
  discoverResults: RawgGameResult[];
  loading: boolean;
  error: string | null;
  /** The text the results are for. */
  searchedText?: string;
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
  searchedText,
  onSearchSubmit,
  onAddGame,
}: RawgSearchProps) {
  const cardBg = useColorModeValue("white", "gray.800");

  const subtleBorder = useColorModeValue("gray.200", "gray.700");
 
  // The server already ranks by title match (abbreviations, typos, subtitles); keep its order.
  const rankedDiscoverResults = discoverResults;

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
            onAdd={onAddGame}
            onViewAll={() => {
              setDropdownOpen(false);
              onSearchSubmit();
            }}
          />
        )}

        {dropdownOpen && !error && !loading && searchText.trim().length >= 3 && searchedText === searchText.trim() &&
          ownedResults.length === 0 && discoverResults.length === 0 && (
            <Box position="absolute" top="100%" left={0} right={0} mt={2} p={4} zIndex={20} bg={cardBg}
              borderWidth="1px" borderColor={subtleBorder} borderRadius="xl" shadow="lg">
              <Text fontSize="sm">No games found for "{searchText.trim()}".</Text>
              <Text fontSize="xs" color="gray.500" mt={1}>Check the spelling, or try the game's full name.</Text>
            </Box>
          )}
      </Box>
    </>
  );
}
