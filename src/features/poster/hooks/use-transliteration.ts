import { useCallback, useRef, useState } from "react";

import {
  extractLastToken,
  getSuggestions,
  splitByCursor,
} from "../lib/suggestions";

const TRANSLITERATE_DEBOUNCE_MS = 180;

export function useTransliteration() {
  const [nameSuggestions, setNameSuggestions] = useState<string[]>([]);
  const [roleSuggestions, setRoleSuggestions] = useState<string[]>([]);
  const [nameSuggestionsVisible, setNameSuggestionsVisible] = useState(false);
  const [roleSuggestionsVisible, setRoleSuggestionsVisible] = useState(false);
  const [nameSuggestionIndex, setNameSuggestionIndex] = useState(-1);
  const [roleSuggestionIndex, setRoleSuggestionIndex] = useState(-1);

  const nameDebounceRef = useRef<number | null>(null);
  const roleDebounceRef = useRef<number | null>(null);
  const nameLatestReqRef = useRef(0);
  const roleLatestReqRef = useRef(0);

  const fetchSuggestions = useCallback(
    async (
      input: HTMLInputElement | HTMLTextAreaElement,
      kind: "name" | "role",
    ) => {
      const { before } = splitByCursor(input);
      const { token } = extractLastToken(before);
      if (!token.trim()) {
        if (kind === "name") {
          setNameSuggestions([]);
          setNameSuggestionsVisible(false);
          setNameSuggestionIndex(-1);
        } else {
          setRoleSuggestions([]);
          setRoleSuggestionsVisible(false);
          setRoleSuggestionIndex(-1);
        }
        return;
      }

      let requestId = 0;
      if (kind === "name") {
        nameLatestReqRef.current += 1;
        requestId = nameLatestReqRef.current;
      } else {
        roleLatestReqRef.current += 1;
        requestId = roleLatestReqRef.current;
      }

      try {
        const suggestions = await getSuggestions(token);
        const stillLatest =
          kind === "name"
            ? requestId === nameLatestReqRef.current
            : requestId === roleLatestReqRef.current;
        if (!stillLatest) return;

        if (kind === "name") {
          setNameSuggestions(suggestions);
          setNameSuggestionsVisible(suggestions.length > 0);
          setNameSuggestionIndex(suggestions.length > 0 ? 0 : -1);
        } else {
          setRoleSuggestions(suggestions);
          setRoleSuggestionsVisible(suggestions.length > 0);
          setRoleSuggestionIndex(suggestions.length > 0 ? 0 : -1);
        }
      } catch (error) {
        console.error("Transliteration error:", error);
      }
    },
    [],
  );

  const scheduleSuggestions = useCallback(
    (kind: "name" | "role", input: HTMLInputElement | null) => {
      if (!input) return;
      if (kind === "name") {
        if (nameDebounceRef.current) {
          window.clearTimeout(nameDebounceRef.current);
        }
        nameDebounceRef.current = window.setTimeout(
          () => void fetchSuggestions(input, "name"),
          TRANSLITERATE_DEBOUNCE_MS,
        );
      } else {
        if (roleDebounceRef.current) {
          window.clearTimeout(roleDebounceRef.current);
        }
        roleDebounceRef.current = window.setTimeout(
          () => void fetchSuggestions(input, "role"),
          TRANSLITERATE_DEBOUNCE_MS,
        );
      }
    },
    [fetchSuggestions],
  );

  const setSuggestionIndex = useCallback(
    (kind: "name" | "role", nextIndex: number) => {
      const suggestions = kind === "name" ? nameSuggestions : roleSuggestions;
      const count = suggestions.length;
      if (count === 0) {
        if (kind === "name") setNameSuggestionIndex(-1);
        else setRoleSuggestionIndex(-1);
        return;
      }
      const normalized = ((nextIndex % count) + count) % count;
      if (kind === "name") setNameSuggestionIndex(normalized);
      else setRoleSuggestionIndex(normalized);
    },
    [nameSuggestions, roleSuggestions],
  );

  const applySuggestion = useCallback(
    (
      kind: "name" | "role",
      suggestion: string,
      input: HTMLInputElement | null,
      suffix = "",
    ): string | null => {
      if (!input) return null;
      const { before, after } = splitByCursor(input);
      const { prefix } = extractLastToken(before);
      const nextValue = `${prefix}${suggestion}${suffix}${after}`;

      input.value = nextValue;
      const newCursor = (prefix + suggestion + suffix).length;
      input.setSelectionRange(newCursor, newCursor);

      if (kind === "name") {
        setNameSuggestions([]);
        setNameSuggestionsVisible(false);
        setNameSuggestionIndex(-1);
      } else {
        setRoleSuggestions([]);
        setRoleSuggestionsVisible(false);
        setRoleSuggestionIndex(-1);
      }

      return nextValue;
    },
    [],
  );

  const hideNameSuggestions = useCallback(() => {
    window.setTimeout(() => {
      setNameSuggestionsVisible(false);
      setNameSuggestionIndex(-1);
    }, 100);
  }, []);

  const hideRoleSuggestions = useCallback(() => {
    window.setTimeout(() => {
      setRoleSuggestionsVisible(false);
      setRoleSuggestionIndex(-1);
    }, 100);
  }, []);

  return {
    applySuggestion,
    hideNameSuggestions,
    hideRoleSuggestions,
    nameSuggestionIndex,
    nameSuggestions,
    nameSuggestionsVisible,
    roleSuggestionIndex,
    roleSuggestions,
    roleSuggestionsVisible,
    scheduleSuggestions,
    setNameSuggestionsVisible,
    setRoleSuggestionsVisible,
    setSuggestionIndex,
  };
}
