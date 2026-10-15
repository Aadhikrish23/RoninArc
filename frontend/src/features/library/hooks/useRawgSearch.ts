import { useEffect, useRef, useState } from "react";

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
  // The text the current results are for, so "no results" never shows for a search still pending.
  const [searchedText, setSearchedText] = useState("");

  const [error, setError] = useState<string | null>(null);

  // Only the newest search may update results: a slow earlier reply must not overwrite it.
  const latestRequest = useRef(0);

  // ---------- Reusable search ----------
  const performSearch = async (options: { silent?: boolean } = {}) => {
    const requestId = ++latestRequest.current;
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
      if (!options.silent) setLoading(true);
      setError(null);

      const data = await libraryApi.searchRawgGames(searchText, 1);
      if (requestId !== latestRequest.current) return;

      if (!data) {
        setError("Failed to search RAWG");
        return;
      }

      setResults(data);
      setSearchedText(searchText.trim());
    } catch (error) {
      if (requestId === latestRequest.current) setError(getErrorMessage(error));
    } finally {
      if (requestId === latestRequest.current) setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch();
    }, 400);

    return () => clearTimeout(timer);
  }, [searchText]);

  const clearSearch = () => {
    latestRequest.current++;
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
    searchedText,
    clearSearch,
    performSearch,
  };
}