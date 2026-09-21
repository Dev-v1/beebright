export function hideSpelling(text, word, replacement = "___") {
  if (!text || !word) return text;
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.replace(new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`, "giu"), replacement);
}

export function sentenceHint(text, word) {
  const masked = hideSpelling(text, word);
  return masked?.includes("___")
    ? masked
    : text || "A checked example sentence is not yet available for this word.";
}
