import {
  calcLocationFromPosition,
  extractYearFromArchive,
} from "./archiveLocation.js";
import {
  TOTAL_CAPACITY,
  TOTAL_PER_CABINET,
  RACKS_PER_SIDE,
  ARCHIVE_PER_RACK,
} from "./archiveConstants.js";

export const repackArchivesByYear = (existingRows, newItems) => {
  const allItems = [];

  for (const row of existingRows) {
    const year = extractYearFromArchive(row);
    if (!year) continue;
    allItems.push({
      kind: "existing",
      uuid: row.uuid,
      year: year,
      prevLocation: row.location,
      citizenship: row.citizenship,
    });
  }

  for (const item of newItems) {
    allItems.push({
      kind: "new",
      tempId: item.tempId,
      year: item.year,
      payload: item.payload,
      citizenship: item.payload.citizenship,
    });
  }

  allItems.sort((a, b) => {
    const aIsWNA =
      a.citizenship && a.citizenship.toUpperCase() === "WNA" ? 1 : 0;
    const bIsWNA =
      b.citizenship && b.citizenship.toUpperCase() === "WNA" ? 1 : 0;
    if (aIsWNA !== bIsWNA) {
      return aIsWNA - bIsWNA;
    }
    const yearA = parseInt(a.year);
    const yearB = parseInt(b.year);
    return yearA - yearB;
  });

  const combined = allItems;
  let position = 1;
  const updates = [];
  const newRecords = [];

  for (const item of combined) {
    const location = calcLocationFromPosition(position, item.year);
    if (item.kind === "existing") {
      if (item.prevLocation !== location) {
        updates.push({ uuid: item.uuid, location });
      }
    } else {
      newRecords.push({ ...item.payload, location });
    }
    position++;
  }

  return {
    total: combined.length,
    updates,
    newRecords,
  };
};

export const generateLocationAuto = async (ModelArchive, yearStorage, Op) => {
  try {
    const count = await ModelArchive.count({
      where: {
        location: {
          [Op.like]: `${yearStorage}%`,
        },
      },
    });
    const position = count + 1;

    if (position > TOTAL_CAPACITY) {
      throw new Error(
        `Kapasitas penyimpanan tahun ${yearStorage} penuh! (Max ${TOTAL_CAPACITY} archive)`,
      );
    }

    const cabinet = Math.floor((position - 1) / TOTAL_PER_CABINET) + 1;
    const posInCabinet = (position - 1) % TOTAL_PER_CABINET;
    const sideQuotaPerCabinet = RACKS_PER_SIDE * ARCHIVE_PER_RACK;
    const side = Math.floor(posInCabinet / sideQuotaPerCabinet) + 1;
    const posInSide = posInCabinet % sideQuotaPerCabinet;
    const rack = Math.floor(posInSide / ARCHIVE_PER_RACK) + 1;
    const cabinetLetter = cabinet === 1 ? "A" : "B";
    const sideLetter = side === 1 ? "A" : "B";
    const location = `${yearStorage}-${cabinetLetter}-${sideLetter}-${String(rack).padStart(2, "0")}`;

    return {
      location,
      cabinet: cabinetLetter,
      side: sideLetter,
      rack,
      position,
      totalForYear: position,
    };
  } catch (error) {
    throw error;
  }
};
