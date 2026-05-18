import { normalizeDateYMD } from "./normalizeDate.js";
import {
  RACKS_PER_SIDE,
  ARCHIVE_PER_RACK,
  TOTAL_PER_CABINET,
} from "./archiveConstants.js";

export const calcLocationFromPosition = (position, yearStorage) => {
  const cabinetNum = Math.floor((position - 1) / TOTAL_PER_CABINET) + 1;
  const posInCabinet = (position - 1) % TOTAL_PER_CABINET;
  const sideQuotaPerCabinet = RACKS_PER_SIDE * ARCHIVE_PER_RACK;
  const sideNum = Math.floor(posInCabinet / sideQuotaPerCabinet) + 1;
  const posInSide = posInCabinet % sideQuotaPerCabinet;
  const rack = Math.floor(posInSide / ARCHIVE_PER_RACK) + 1;
  const cabinetLetter = cabinetNum === 1 ? "A" : "B";
  const sideLetter = sideNum === 1 ? "A" : "B";
  return `${yearStorage}-${cabinetLetter}-${sideLetter}-${String(rack).padStart(2, "0")}`;
};

export const extractYearFromArchive = (archive, fallbackYear) => {
  if (archive.location && /^\d{4}/.test(archive.location)) {
    return archive.location.slice(0, 4);
  }
  if (archive.date_of_birth) {
    const norm = normalizeDateYMD(String(archive.date_of_birth));
    if (norm) return norm.split("-")[0];
  }
  return fallbackYear;
};
