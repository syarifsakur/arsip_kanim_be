import ModelArchive from "../models/ModelArchive.js";
import path from "path";
import XLSX from "xlsx";
import fs from "fs";

// Normalize date string to YYYY-MM-DD. Supports 'YYYY-MM-DD' and 'DD-MM-YYYY'.
const normalizeDateYMD = (value) => {
  if (!value || typeof value !== "string") return null;
  const parts = value.split("-");
  if (parts.length !== 3) return null;
  const [a, b, c] = parts;
  // If first part has 4 digits, assume YYYY-MM-DD
  if (a.length === 4) return `${a}-${b}-${c}`;
  // If last part has 4 digits, assume DD-MM-YYYY
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

export const getArchive = async (req, res) => {
  try {
    const { rows: response, count: total } = await ModelArchive.findAndCountAll(
      {
        order: [["createdAt", "DESC"]],
      }
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
    "host"
  )}/public/archive/${filename}`;

  file.mv(`public/archive/${filename}`);

  try {
    const normalizedDob = normalizeDateYMD(date_of_birth);
    const no_archive = generateNoArchive(normalizedDob || date_of_birth);
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
    });

    return res.status(201).json({ msg: "Archive created successfully" });
  } catch (error) {
    return res.status(500).json(error);
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
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });

    if (!rows.length) {
      return res.status(400).json({ message: "Data Excel kosong!" });
    }

    const existing = await ModelArchive.findAll({
      attributes: ["application_number"],
    });

    const existingSet = new Set(existing.map((x) => x.application_number));
    const batchSet = new Set();

    const insertData = [];

    for (const r of rows) {
      const applicationNumber = r["__EMPTY"];

      if (!applicationNumber) continue;
      if (existingSet.has(applicationNumber)) continue;
      if (batchSet.has(applicationNumber)) continue;

      batchSet.add(applicationNumber);

      const convertDate = (value) => {
        if (!value) return null;

        // Jika berupa string dd-mm-yyyy
        if (typeof value === "string" && value.includes("-")) {
          const [dd, mm, yyyy] = value.split("-");
          if (dd && mm && yyyy) {
            return `${yyyy}-${mm}-${dd}`;
          }
        }

        return null;
      };

      const dob = convertDate(r["__EMPTY_8"]);
      insertData.push({
        application_number: r["__EMPTY"],
        application_date: convertDate(r["__EMPTY_1"]),
        application_type: r["__EMPTY_2"],
        passport_purpose: r["__EMPTY_3"],
        passport_number: r["__EMPTY_4"],
        passport_type: r["__EMPTY_5"],
        service_method: r["__EMPTY_6"],
        full_name: r["__EMPTY_7"],
        date_of_birth: dob,
        gender: r["__EMPTY_9"],
        passport_registration_number: r["__EMPTY_10"],
        issue_date: convertDate(r["__EMPTY_11"]),
        expiration_date: convertDate(r["__EMPTY_12"]),
        province: r["__EMPTY_13"],
        district_city: r["__EMPTY_14"],
        sub_district: r["__EMPTY_15"],
        no_archive: generateNoArchive(dob),
        created_by: req.name || "system",
      });
    }

    if (insertData.length > 0) {
      await ModelArchive.bulkCreate(insertData);
    }

    return res.status(201).json({
      message: "Import berhasil",
      inserted: insertData.length,
      skipped: rows.length - insertData.length,
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
    } = req.body;

    // payload dasar (tanpa file)
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

    // simpan file
    await file.mv(relPath);

    const file_path = `${req.protocol}://${req.get(
      "host"
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
