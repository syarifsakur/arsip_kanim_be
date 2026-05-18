import XLSX from "xlsx";

export const convertDateCell = (value) => {
  if (!value) return null;

  if (typeof value === "string") {
    const s = value.trim();
    const m = s.match(/^(\d{2})[-\/]?(\d{2})[-\/]?(\d{4})$/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    const m2 = s.match(/^(\d{4})[-\/]?(\d{2})[-\/]?(\d{2})$/);
    if (m2) return `${m2[1]}-${m2[2]}-${m2[3]}`;
    return null;
  }

  if (typeof value === "number") {
    try {
      const d = XLSX.SSF.parse_date_code(value);
      if (d && d.y && d.m && d.d) {
        const yyyy = d.y;
        const mm = String(d.m).padStart(2, "0");
        const dd = String(d.d).padStart(2, "0");
        return `${yyyy}-${mm}-${dd}`;
      }
    } catch (_) {}
    return null;
  }

  return null;
};
