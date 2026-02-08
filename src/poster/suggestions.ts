import { getTransliterateSuggestions } from "react-transliterate";

export const getSuggestions = async (word: string) => {
  const data = await getTransliterateSuggestions(word, {
    numOptions: 5,
    showCurrentWordAsLastSuggestion: true,
    lang: "ne",
  });

  return data;
};
