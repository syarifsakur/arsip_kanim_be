export const normalizeDateYMD = (value) => {
  if (!value || typeof value !== "string") return null;
  const parts = value.split("-");
  if (parts.length !== 3) return null;
  const [a, b, c] = parts;
  if (a.length === 4) return `${a}-${b}-${c}`;
  if (c.length === 4) return `${c}-${b}-${a}`;
  return null;
};
