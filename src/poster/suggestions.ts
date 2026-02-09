import { getTransliterateSuggestions } from "react-transliterate";

const TRANSLITERATE_LANG = "ne";

export const splitByCursor = (input: HTMLInputElement) => {
  const value = input.value;
  const cursorIndex = input.selectionStart ?? value.length;
  return {
    before: value.slice(0, cursorIndex),
    after: value.slice(cursorIndex),
  };
};

export const extractLastToken = (text: string) => {
  const match = text.match(/(\S+)\s*$/);
  if (!match) {
    return { token: "", prefix: text };
  }
  const token = match[1];
  const prefix = text.slice(0, match.index ?? 0);
  return { token, prefix };
};

export const getSuggestions = async (word: string) => {
  const data = await getTransliterateSuggestions(word, {
    numOptions: 6,
    showCurrentWordAsLastSuggestion: true,
    lang: TRANSLITERATE_LANG,
  });

  return data;
};
