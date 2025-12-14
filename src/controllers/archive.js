import ModelArchive from "../models/ModelArchive.js";
import path from "path";
import XLSX from "xlsx";
import fs from "fs";

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

export const createArchive = async (req, res) => {
  const {
    application_number,
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
    await ModelArchive.create({
      application_number,
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

      console.log({ testing: r });

      insertData.push({
        application_number: r["__EMPTY"],
        application_date: convertDate(r["__EMPTY_1"]),
        application_type: r["__EMPTY_2"],
        passport_purpose: r["__EMPTY_3"],
        passport_number: r["__EMPTY_4"],
        passport_type: r["__EMPTY_5"],
        service_method: r["__EMPTY_6"],
        full_name: r["__EMPTY_7"],
        date_of_birth: convertDate(r["__EMPTY_8"]),
        gender: r["__EMPTY_9"],
        passport_registration_number: r["__EMPTY_10"],
        issue_date: convertDate(r["__EMPTY_11"]),
        expiration_date: convertDate(r["__EMPTY_12"]),
        province: r["__EMPTY_13"],
        district_city: r["__EMPTY_14"],
        sub_district: r["__EMPTY_15"],
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
  const {
    application_number,
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

  const Archive = await ModelArchive.findByPk(id);
  if (!Archive)
    return res.status(404).json({ msg: "Archive tidak ditemukan!" });

  if (!req.files || !req.files.file) {
    try {
      await ModelArchive.update({
        application_number,
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
      });

      return res.status(200).json({ msg: "Archive updated successfully" });
    } catch (error) {
      return res.status(500).json(error);
    }
  } else {
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
      await ModelArchive.create({
        application_number,
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
        file: filename,
        file_path: pathFile,
      });

      return res.status(201).json({ msg: "Archive created successfully" });
    } catch (error) {
      return res.status(500).json(error);
    }
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
