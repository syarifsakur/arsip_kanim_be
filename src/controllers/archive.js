import ModelArchive from "../models/ModelArchive.js";
import path from "path";
import XLSX from "xlsx";
import fs from "fs";
import { Op } from "sequelize";

// Normalize date string to YYYY-MM-DD. Supports 'YYYY-MM-DD' and 'DD-MM-YYYY'.
const normalizeDateYMD = (value) => {
  if (!value || typeof value !== "string") return null;
  const parts = value.split("-");
  if (parts.length !== 3) return null;
  const [a, b, c] = parts;
  if (a.length === 4) return `${a}-${b}-${c}`;
  if (c.length === 4) return `${c}-${b}-${a}`;
  return null;
};

// Generate no_archive from date_of_birth (-> 1-YYMMDD)
const generateNoArchive = (dob) => {
  const ymd = normalizeDateYMD(dob);
  if (!ymd) return null;
  const [yyyy, mm, dd] = ymd.split("-");
  const yy = yyyy.slice(-2);
  return `1-${yy}${mm}${dd}`;
};

const generateLocationAuto = async (yearStorage) => {
  try {
    const count = await ModelArchive.count({
      where: {
        location: {
          [Op.like]: `${yearStorage}%`,
        },
      },
    });
    const position = count + 1;

    const RACKS_PER_SIDE = 5;
    const SIDES_PER_CABINET = 2;
    const ARCHIVE_PER_RACK = 10;
    const TOTAL_PER_CABINET =
      RACKS_PER_SIDE * SIDES_PER_CABINET * ARCHIVE_PER_RACK; 
    const TOTAL_CAPACITY = 2 * TOTAL_PER_CABINET; 

    if (position > TOTAL_CAPACITY) {
      throw new Error(
        `Kapasitas penyimpanan tahun ${yearStorage} penuh! (Max ${TOTAL_CAPACITY} archive)`,
      );
    }

    // Hitung cabinet (1-100 = Cabinet 1, 101-200 = Cabinet 2)
    const cabinet = Math.floor((position - 1) / TOTAL_PER_CABINET) + 1;

    // Hitung posisi dalam cabinet (0-99)
    const posInCabinet = (position - 1) % TOTAL_PER_CABINET;

    // Hitung side (0 sampai posisi side x kuota per side)
    const sideQuotaPerCabinet = RACKS_PER_SIDE * ARCHIVE_PER_RACK; // 50
    const side = Math.floor(posInCabinet / sideQuotaPerCabinet) + 1;

    // Hitung posisi dalam side (0-49)
    const posInSide = posInCabinet % sideQuotaPerCabinet;

    // Hitung rack berdasarkan posisi dan kapasitas per rack
    const rack = Math.floor(posInSide / ARCHIVE_PER_RACK) + 1;

    // Format: YYYYCLSR (Tahun, Cabinet 2digit, Side 2digit, Rack 2digit)
    const location = `${yearStorage}${String(cabinet).padStart(2, "0")}${String(side).padStart(2, "0")}${String(rack).padStart(2, "0")}`;

    return {
      location,
      cabinet,
      side,
      rack,
      position,
      totalForYear: position,
    };
  } catch (error) {
    throw error;
  }
};

// Convert various Excel cell date formats to YYYY-MM-DD
const convertDateCell = (value) => {
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

export const getArchive = async (req, res) => {
  try {
    const { rows: response, count: total } = await ModelArchive.findAndCountAll(
      {
        order: [["createdAt", "DESC"]],
      },
    );

    return res.status(200).json({ data: response, total: total });
  } catch (error) {
    return res.status(500).json(error);
  }
};

export const getByIdArchive = async (req, res) => {
  try {
    const { id } = req.params;
    const response = await ModelArchive.findByPk(id);
    if (!response)
      return res.status(404).json({ msg: "Archive tidak ditemukan!" });
    return res.status(200).json(response);
  } catch (error) {
    return res.status(500).json(error);
  }
};

export const createArchive = async (req, res) => {
  const {
    application_number,
    application_date,
    passport_purpose,
    application_type,
    passport_number,
    passport_type,
    service_method,
    full_name,
    date_of_birth,
    gender,
    passport_registration_number,
    issue_date,
    expiration_date,
    province,
    district_city,
    sub_district,
  } = req.body;

  if (!req.files) return res.status(422).json({ img: "Img harus di isi!" });

  // Validasi application_date untuk extract tahun
  if (!application_date) {
    return res
      .status(422)
      .json({ msg: "Tanggal permohonan (application_date) harus diisi!" });
  }

  const file = req.files.file;
  const fileSize = file.data.length;
  const ext = path.extname(file.name);
  const allowedTypes = [".png", ".jpg", ".jpeg", ".pdf"];
  const filename = Date.now() + ext;

  if (!allowedTypes.includes(ext.toLowerCase()))
    return res.status(422).json({ img: "Format img tidak di dukung!" });
  if (fileSize > 30000000)
    return res.status(422).json({ img: "Ukuran img terlalu besar!" });

  const pathFile = `${req.protocol}://${req.get(
    "host",
  )}/public/archive/${filename}`;

  file.mv(`public/archive/${filename}`);

  try {
    const normalizedDob = normalizeDateYMD(date_of_birth);
    const no_archive = generateNoArchive(normalizedDob || date_of_birth);

    // Extract tahun dari application_date (format: YYYY-MM-DD atau DD-MM-YYYY)
    const normalizedAppDate = normalizeDateYMD(application_date);
    const yearStorage = normalizedAppDate
      ? normalizedAppDate.split("-")[0]
      : application_date;

    // Generate lokasi penyimpanan otomatis (format: YYYYCLSR)
    // Hitung total archive yang sudah ada untuk tahun ini
    const existingCount = await ModelArchive.count({
      where: {
        location: {
          [Op.like]: `${yearStorage}%`,
        },
      },
    });

    const position = existingCount + 1;

    // Konstanta kapasitas
    const RACKS_PER_SIDE = 5;
    const SIDES_PER_CABINET = 2;
    const ARCHIVE_PER_RACK = 10;
    const TOTAL_PER_CABINET =
      RACKS_PER_SIDE * SIDES_PER_CABINET * ARCHIVE_PER_RACK;
    const TOTAL_CAPACITY = 2 * TOTAL_PER_CABINET;

    if (position > TOTAL_CAPACITY) {
      return res.status(400).json({
        msg: `Kapasitas penyimpanan tahun ${yearStorage} penuh! (Max ${TOTAL_CAPACITY} archive)`,
      });
    }

    // Hitung lokasi
    const cabinet = Math.floor((position - 1) / TOTAL_PER_CABINET) + 1;
    const posInCabinet = (position - 1) % TOTAL_PER_CABINET;
    const sideQuotaPerCabinet = RACKS_PER_SIDE * ARCHIVE_PER_RACK;
    const side = Math.floor(posInCabinet / sideQuotaPerCabinet) + 1;
    const posInSide = posInCabinet % sideQuotaPerCabinet;
    const rack = Math.floor(posInSide / ARCHIVE_PER_RACK) + 1;

    const location = `${yearStorage}${String(cabinet).padStart(2, "0")}${String(side).padStart(2, "0")}${String(rack).padStart(2, "0")}`;

    await ModelArchive.create({
      application_number,
      application_date,
      application_number,
      passport_purpose,
      application_type,
      passport_number,
      passport_type,
      service_method,
      full_name,
      date_of_birth: normalizedDob || date_of_birth,
      gender,
      passport_registration_number,
      issue_date,
      expiration_date,
      province,
      district_city,
      sub_district,
      no_archive,
      file: filename,
      file_path: pathFile,
      location: location,
    });

    return res.status(201).json({
      msg: "Archive created successfully",
      location: location,
      details: {
        year: yearStorage,
        cabinet: cabinet,
        side: side,
        rack: rack,
        position: position,
      },
    });
  } catch (error) {
    return res.status(500).json({ msg: error.message });
  }
};

export const createImportArchive = async (req, res) => {
  try {
    if (!req.files || !req.files.file) {
      return res.status(400).json({ message: "File Excel harus diupload!" });
    }

    const file = req.files.file;
    const workbook = XLSX.read(file.data, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    // Parse as array-of-arrays so we can detect header row and accept only below
    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: null,
      blankrows: false,
    });

    if (!rows.length) {
      return res.status(400).json({ message: "Data Excel kosong!" });
    }

    // Find the header row (contains "NO PERMOHONAN" and "TANGGAL PERMOHONAN")
    const headerIndex = rows.findIndex((row) => {
      if (!row || row.length === 0) return false;
      const values = row
        .filter((v) => typeof v === "string")
        .map((v) => v.trim().toUpperCase());
      return (
        values.includes("NO PERMOHONAN") &&
        values.includes("TANGGAL PERMOHONAN")
      );
    });

    if (headerIndex === -1) {
      return res.status(400).json({
        message:
          "Header tabel tidak ditemukan. Pastikan format sesuai contoh dan mulai dari baris judul kolom.",
      });
    }

    // Build duplicate set from DB
    const existing = await ModelArchive.findAll({
      attributes: ["application_number"],
    });
    const existingSet = new Set(
      existing.map((x) => String(x.application_number)),
    );
    const batchSet = new Set();

    const insertData = [];

    // Process only rows below header
    for (let i = headerIndex + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length < 17) continue; // require all key columns

      // Map columns by position based on provided format
      const [
        no,
        application_number,
        application_date,
        application_type,
        passport_purpose,
        passport_number,
        passport_type,
        service_method,
        full_name,
        date_of_birth,
        gender,
        passport_registration_number,
        issue_date,
        expiration_date,
        province,
        district_city,
        sub_district,
      ] = row;

      // Validate application number (second column). Skip header/invalid rows.
      const appNo =
        application_number == null ? "" : String(application_number).trim();
      if (!appNo || !/^\d{6,}$/.test(appNo)) continue;
      if (existingSet.has(appNo)) continue;
      if (batchSet.has(appNo)) continue;
      batchSet.add(appNo);

      const dobYmd = convertDateCell(date_of_birth);
      const appDateYmd = convertDateCell(application_date);
      const yearStorage = appDateYmd
        ? appDateYmd.split("-")[0]
        : new Date().getFullYear();

      insertData.push({
        application_number: appNo,
        application_date: appDateYmd,
        application_type: application_type || null,
        passport_purpose: passport_purpose || null,
        passport_number: passport_number || null,
        passport_type: passport_type || null,
        service_method: service_method || null,
        full_name: full_name || null,
        date_of_birth: dobYmd,
        gender: gender || null,
        passport_registration_number: passport_registration_number || null,
        issue_date: convertDateCell(issue_date),
        expiration_date: convertDateCell(expiration_date),
        province: province || null,
        district_city: district_city || null,
        sub_district: sub_district || null,
        no_archive: generateNoArchive(dobYmd),
        year_storage: yearStorage,
        created_by: req.name || "system",
      });
    }

    if (insertData.length > 0) {
      // Generate location otomatis untuk setiap archive dengan tracking per tahun
      const yearCounters = {}; // Track posisi per tahun

      for (let i = 0; i < insertData.length; i++) {
        const year = insertData[i].year_storage;

        // Inisialisasi counter untuk tahun ini jika belum ada
        if (!yearCounters[year]) {
          // Hitung total archive yang sudah ada di database untuk tahun ini
          const existingCount = await ModelArchive.count({
            where: {
              location: {
                [Op.like]: `${year}%`,
              },
            },
          });
          yearCounters[year] = existingCount;
        }

        // Increment counter untuk tahun ini
        yearCounters[year]++;
        const position = yearCounters[year];

        // Konstanta kapasitas
        const RACKS_PER_SIDE = 5;
        const SIDES_PER_CABINET = 2;
        const ARCHIVE_PER_RACK = 10;
        const TOTAL_PER_CABINET =
          RACKS_PER_SIDE * SIDES_PER_CABINET * ARCHIVE_PER_RACK;
        const TOTAL_CAPACITY = 2 * TOTAL_PER_CABINET;

        if (position > TOTAL_CAPACITY) {
          throw new Error(
            `Kapasitas penyimpanan tahun ${year} penuh! (Max ${TOTAL_CAPACITY} archive)`,
          );
        }

        // Hitung lokasi
        const cabinet = Math.floor((position - 1) / TOTAL_PER_CABINET) + 1;
        const posInCabinet = (position - 1) % TOTAL_PER_CABINET;
        const sideQuotaPerCabinet = RACKS_PER_SIDE * ARCHIVE_PER_RACK;
        const side = Math.floor(posInCabinet / sideQuotaPerCabinet) + 1;
        const posInSide = posInCabinet % sideQuotaPerCabinet;
        const rack = Math.floor(posInSide / ARCHIVE_PER_RACK) + 1;

        const location = `${year}${String(cabinet).padStart(2, "0")}${String(side).padStart(2, "0")}${String(rack).padStart(2, "0")}`;
        insertData[i].location = location;
      }

      await ModelArchive.bulkCreate(insertData);
    }

    return res.status(201).json({
      message: "Import berhasil",
      inserted: insertData.length,
      skipped: Math.max(rows.length - (headerIndex + 1) - insertData.length, 0),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Terjadi kesalahan",
      error: error.message,
    });
  }
};

export const updateArchive = async (req, res) => {
  const { id } = req.params;

  try {
    const archive = await ModelArchive.findByPk(id);
    if (!archive)
      return res.status(404).json({ msg: "Archive tidak ditemukan!" });

    const {
      application_number,
      application_date,
      application_type,
      passport_purpose,
      passport_number,
      passport_type,
      service_method,
      full_name,
      date_of_birth,
      gender,
      passport_registration_number,
      issue_date,
      expiration_date,
      province,
      district_city,
      sub_district,
      location,
    } = req.body;

    const payload = {
      application_number,
      application_date,
      application_type,
      passport_purpose,
      passport_number,
      passport_type,
      service_method,
      full_name,
      date_of_birth,
      gender,
      passport_registration_number,
      issue_date,
      expiration_date,
      province,
      district_city,
      sub_district,
      location,
    };

    // ====== TANPA FILE BARU ======
    if (!req.files || !req.files.file) {
      await archive.update(payload);
      return res.status(200).json({ msg: "Archive updated successfully" });
    }

    // ====== DENGAN FILE BARU ======
    const file = req.files.file;
    const fileSize = file.data.length;
    const ext = path.extname(file.name).toLowerCase();
    const allowedTypes = [".png", ".jpg", ".jpeg", ".pdf"];

    if (!allowedTypes.includes(ext)) {
      return res
        .status(422)
        .json({ msg: "Format file tidak didukung! (PDF/PNG/JPG/JPEG)" });
    }
    if (fileSize > 30 * 1024 * 1024) {
      return res
        .status(422)
        .json({ msg: "Ukuran file terlalu besar! (maks 30MB)" });
    }

    const filename = `${Date.now()}${ext}`;
    const relPath = `public/archive/${filename}`;

    await file.mv(relPath);

    const file_path = `${req.protocol}://${req.get(
      "host",
    )}/public/archive/${filename}`;

    await archive.update({
      ...payload,
      file: filename,
      file_path,
    });

    return res.status(200).json({ msg: "Archive updated successfully" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ msg: "Server error", error: String(error) });
  }
};

export const updateArchiveStatus = async (req, res) => {
  const { id } = req.params;
  const { application_status } = req.body;

  const archive = await ModelArchive.findByPk(id);
  if (!archive)
    return res.status(404).json({ msg: "Archive tidak ditemukan!" });

  try {
    await archive.update({ application_status });
    return res.status(200).json({ msg: "Archive status updated successfully" });
  } catch (error) {
    return res.status(500).json(error);
  }
};

export const deleteArchive = async (req, res) => {
  try {
    const { id } = req.params;

    const Archive = await ModelArchive.findByPk(id);
    if (!Archive) {
      return res.status(404).json({ msg: "Archive tidak ditemukan!" });
    }

    if (Archive.file) {
      fs.unlinkSync(`public/archive/${Archive.file}`);
    }
    await Archive.destroy();
    return res.status(200).json({ msg: "Archive deleted successfully" });
  } catch (error) {
    console.log(error);
    return res.status(500).json(error);
  }
};
