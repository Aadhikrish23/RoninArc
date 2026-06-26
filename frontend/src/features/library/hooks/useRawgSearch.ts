import { useEffect, useState } from "react";

import libraryApi from "../api/libraryApi";
import type { SearchResponse } from "../types/library";
import { getErrorMessage } from "../../../shared/utils/error";

export function useRawgSearch() {
  const [searchText, setSearchText] = useState("");

  const [results, setResults] = useState<SearchResponse>({
    owned: [],
    discover: [],
    totalOwned: 0,
    totalDiscover: 0,
  });

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 1. Immediately reset state if search text is too short
    if (searchText.trim().length < 3) {
      setResults({
        owned: [],
        discover: [],
        totalOwned: 0,
        totalDiscover: 0,
      });
      setError(null);
      setLoading(false);
      return;
    }

    // 2. Single debounce timer for all search activities
    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        setError(null);

        // Trigger the API call
        const data = await libraryApi.searchRawgGames(searchText, 1);

        if (!data) {
          setError("Failed to search RAWG");
          return;
        }

        setResults(data);
      } catch (error: unknown) {
        setError(getErrorMessage(error));
      } finally {
        setLoading(false);
      }
    }, 400); // Standardized to a 400ms delay

    // 4. Cleanup function cancels the timer if user keeps typing
    return () => clearTimeout(timer);
  }, [searchText]);

  const clearSearch = () => {
    setSearchText("");
    setResults({
      owned: [],
      discover: [],
      totalOwned: 0,
      totalDiscover: 0,
    });
    setError(null);
    setLoading(false);
  };

  return {
    searchText,
    setSearchText,
    ownedResults: results.owned,
    discoverResults: results.discover,
    totalOwned: results.totalOwned,
    totalDiscover: results.totalDiscover,
    loading,
    error,
    clearSearch,
  };
}
