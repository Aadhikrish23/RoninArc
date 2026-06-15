import { useEffect, useState } from "react";

import libraryApi from "../api/libraryApi";
import type { RawgGameResult } from "../../../types/library";

export function useRawgSearch() {
  const [searchText, setSearchText] = useState("");

  const [results, setResults] = useState<
    RawgGameResult[]
  >([]);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] = useState<
    string | null
  >(null);

  useEffect(() => {
    if (searchText.trim().length < 3) {
      setResults([]);
      setError(null);
      setLoading(false);
      return;
    }

    const timer = setTimeout(
      async () => {
        try {
          setLoading(true);
          setError(null);

          const data =
            await libraryApi.searchRawgGames(
              searchText,
              1
            );

          if (!data) {
            setError(
              "Failed to search RAWG"
            );
            return;
          }

          setResults(data);
        } catch (error: any) {
          setError(error.toString());
        } finally {
          setLoading(false);
        }
      },
      400
    );

    return () => clearTimeout(timer);
  }, [searchText]);

  const clearSearch = () => {
    setSearchText("");
    setResults([]);
    setError(null);
    setLoading(false);
  };

  return {
    searchText,
    setSearchText,

    results,

    loading,

    error,

    clearSearch,
  };
}