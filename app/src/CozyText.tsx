
export const CozyThingText = ({ text = "" }) => {
  const lowerText = text.toLowerCase().trim();

  // Case 1: "lmt" -> First variation (lm in grey, t in brand-1/yellow)
  if (lowerText === 'lmt') {
    return (
      <span className="font-semibold">
        <span className="text-neutral-1">lm</span>
        <span className="text-brand-1">t</span>
      </span>
    );
  }

  // Case 2: "lmthing" -> lm in grey, thing in colorful variation
  if (lowerText === 'lmthing') {
    return (
      <span className="font-semibold">
        <span className="text-neutral-1">lm</span>
        <span className="text-brand-1">t</span>
        <span className="text-brand-2">h</span>
        <span className="text-brand-3">i</span>
        <span className="text-brand-4">n</span>
        <span className="text-brand-5">g</span>
      </span>
    );
  }

  // Case 3: "thing" -> colorful variation
  if (lowerText === 'thing') {
    return (
      <span className="font-semibold">
        <span className="text-brand-1">t</span>
        <span className="text-brand-2">h</span>
        <span className="text-brand-3">i</span>
        <span className="text-brand-4">n</span>
        <span className="text-brand-5">g</span>
      </span>
    );
  }

  // Fallback for any other text
  return <span>{text}</span>;
};

export default CozyThingText;
