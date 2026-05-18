import { normalizeDateYMD } from "./normalizeDate.js";

export const generateNoArchive = (dob, citizenship) => {
  const ymd = normalizeDateYMD(dob);
  if (!ymd) return null;
  const [yyyy, mm, dd] = ymd.split("-");
  const yy = yyyy.slice(-2);
  const prefix = citizenship && citizenship.toUpperCase() === "WNA" ? "2" : "1";
  return `${prefix}-${yy}${mm}${dd}`;
};
