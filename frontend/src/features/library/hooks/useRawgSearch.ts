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

  // ---------- Reusable search ----------
  const performSearch = async () => {
    if (searchText.trim().length < 3) {
      setResults({
        owned: [],
        discover: [],
        totalOwned: 0,
        totalDiscover: 0,
      });
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const data = await libraryApi.searchRawgGames(searchText, 1);

      if (!data) {
        setError("Failed to search RAWG");
        return;
      }

      setResults(data);
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch();
    }, 400);

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
    performSearch,
  };
}