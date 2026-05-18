import ModelArchive from "../models/ModelArchive.js";
import path from "path";
import XLSX from "xlsx";
import fs from "fs";
import { Op } from "sequelize";
import { normalizeDateYMD } from "../utils/normalizeDate.js";
import { generateNoArchive } from "../utils/generateArchiveNumber.js";
import { convertDateCell } from "../utils/convertDateCell.js";
import { TOTAL_CAPACITY } from "../utils/archiveConstants.js";
import {
  calcLocationFromPosition,
  extractYearFromArchive,
} from "../utils/archiveLocation.js";
import {
  repackArchivesByYear,
  generateLocationAuto,
} from "../utils/archiveManagement.js";

export const getArchive = async (req, res) => {
  try {
    const { rows: response, count: total } = await ModelArchive.findAndCountAll(
      {
        order: [
          [
            ModelArchive.sequelize.literal(
              "CASE WHEN citizenship = 'WNA' THEN 1 ELSE 0 END",
            ),
            "ASC",
          ],
          ["location", "ASC"],
          ["createdAt", "DESC"],
        ],
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
    citizenship,
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
    const no_archive = generateNoArchive(
      normalizedDob || date_of_birth,
      citizenship,
    );

    // Extract tahun dari date_of_birth (format: YYYY-MM-DD atau DD-MM-YYYY)
    const normalizedDobYear = normalizeDateYMD(date_of_birth);
    if (!normalizedDobYear) {
      return res.status(422).json({
        msg: "Tanggal lahir (date_of_birth) harus diisi dan valid (YYYY-MM-DD)",
      });
    }
    const yearStorage = normalizedDobYear.split("-")[0];

    const t = await ModelArchive.sequelize.transaction();
    try {
      const existing = await ModelArchive.findAll({
        where: { application_status: "active" },
        attributes: [
          "uuid",
          "location",
          "application_date",
          "date_of_birth",
          "citizenship",
          "createdAt",
        ],
        order: [
          [
            ModelArchive.sequelize.literal(
              "CASE WHEN citizenship = 'WNA' THEN 1 ELSE 0 END",
            ),
            "ASC",
          ],
          ["date_of_birth", "ASC"],
          ["createdAt", "ASC"],
        ],
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      const repack = repackArchivesByYear(existing, [
        {
          tempId: "new",
          year: yearStorage,
          payload: {
            application_number,
            application_date,
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
            citizenship,
            no_archive,
            file: filename,
            file_path: pathFile,
            location: null,
          },
        },
      ]);

      if (repack.total > TOTAL_CAPACITY) {
        await t.rollback();
        return res.status(400).json({
          msg: `Kapasitas penyimpanan penuh! (Max ${TOTAL_CAPACITY} archive)`,
        });
      }

      // Apply location updates for shifted archives
      for (const upd of repack.updates) {
        await ModelArchive.update(
          { location: upd.location },
          { where: { uuid: upd.uuid }, transaction: t },
        );
      }

      // repack.newRecords harus berisi 1 record (yang baru)
      const newRecord = repack.newRecords[0];
      await ModelArchive.create(newRecord, { transaction: t });

      await t.commit();

      return res.status(201).json({
        msg: "Archive created successfully",
        location: newRecord.location,
      });
    } catch (err) {
      await t.rollback();
      throw err;
    }
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

    const existing = await ModelArchive.findAll({
      attributes: ["application_number"],
    });
    const existingSet = new Set(
      existing.map((x) => String(x.application_number)),
    );
    const batchSet = new Set();

    const insertData = [];

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
        citizenship,
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
      const dobYear = dobYmd ? dobYmd.split("-")[0] : null;
      const yearStorage = dobYear || new Date().getFullYear();

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
        citizenship: citizenship || null,
        no_archive: generateNoArchive(dobYmd, citizenship),
        year_storage: yearStorage,
        created_by: req.name || "system",
      });
    }

    if (insertData.length > 0) {
      const t = await ModelArchive.sequelize.transaction();
      try {
        const existing = await ModelArchive.findAll({
          where: { application_status: "active" },
          attributes: [
            "uuid",
            "location",
            "application_date",
            "date_of_birth",
            "citizenship",
          ],
          order: [
            [
              ModelArchive.sequelize.literal(
                "CASE WHEN citizenship = 'WNA' THEN 1 ELSE 0 END",
              ),
              "ASC",
            ],
            ["date_of_birth", "ASC"],
            ["createdAt", "ASC"],
          ],
          transaction: t,
          lock: t.LOCK.UPDATE,
        });

        const newItems = insertData.map((payload, idx) => ({
          tempId: `new-${idx}`,
          year: payload.year_storage,
          payload,
        }));

        const repack = repackArchivesByYear(existing, newItems);

        if (repack.total > TOTAL_CAPACITY) {
          await t.rollback();
          return res.status(400).json({
            message: `Kapasitas penyimpanan penuh! (Max ${TOTAL_CAPACITY} archive)`,
          });
        }

        for (const upd of repack.updates) {
          await ModelArchive.update(
            { location: upd.location },
            { where: { uuid: upd.uuid }, transaction: t },
          );
        }

        await ModelArchive.bulkCreate(
          repack.newRecords.map((r) => {
            const { year_storage, ...rest } = r;
            return rest;
          }),
          { transaction: t },
        );

        await t.commit();
      } catch (err) {
        await t.rollback();
        throw err;
      }
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
  const t = await ModelArchive.sequelize.transaction();

  try {
    const archive = await ModelArchive.findByPk(id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!archive)
      return res.status(404).json({ msg: "Archive tidak ditemukan!" });

    const currentArchive = archive.get({ plain: true });
    const resolveUpdatedValue = (value, fallback) => {
      if (value === undefined || value === null) return fallback;
      if (typeof value === "string" && value.trim() === "") return fallback;
      return value;
    };

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
      citizenship,
    } = req.body;

    const payload = {
      application_number: resolveUpdatedValue(
        application_number,
        currentArchive.application_number,
      ),
      application_date: resolveUpdatedValue(
        application_date,
        currentArchive.application_date,
      ),
      application_type: resolveUpdatedValue(
        application_type,
        currentArchive.application_type,
      ),
      passport_purpose: resolveUpdatedValue(
        passport_purpose,
        currentArchive.passport_purpose,
      ),
      passport_number: resolveUpdatedValue(
        passport_number,
        currentArchive.passport_number,
      ),
      passport_type: resolveUpdatedValue(
        passport_type,
        currentArchive.passport_type,
      ),
      service_method: resolveUpdatedValue(
        service_method,
        currentArchive.service_method,
      ),
      full_name: resolveUpdatedValue(full_name, currentArchive.full_name),
      date_of_birth: resolveUpdatedValue(
        date_of_birth,
        currentArchive.date_of_birth,
      ),
      gender: resolveUpdatedValue(gender, currentArchive.gender),
      passport_registration_number: resolveUpdatedValue(
        passport_registration_number,
        currentArchive.passport_registration_number,
      ),
      issue_date: resolveUpdatedValue(issue_date, currentArchive.issue_date),
      expiration_date: resolveUpdatedValue(
        expiration_date,
        currentArchive.expiration_date,
      ),
      province: resolveUpdatedValue(province, currentArchive.province),
      district_city: resolveUpdatedValue(
        district_city,
        currentArchive.district_city,
      ),
      sub_district: resolveUpdatedValue(
        sub_district,
        currentArchive.sub_district,
      ),
      location: resolveUpdatedValue(location, currentArchive.location),
      citizenship: resolveUpdatedValue(citizenship, currentArchive.citizenship),
    };

    // Jika citizenship berubah, regenerate no_archive
    const citizenshipChanged =
      payload.citizenship !== currentArchive.citizenship;
    if (citizenshipChanged) {
      const dobForArchive =
        payload.date_of_birth || currentArchive.date_of_birth;
      const newNoArchive = generateNoArchive(
        dobForArchive,
        payload.citizenship,
      );
      if (newNoArchive) {
        payload.no_archive = newNoArchive;
      }
    }

    const isActiveArchive = currentArchive.application_status === "active";

    if (!req.files || !req.files.file) {
      await archive.update(payload, { transaction: t });

      if (isActiveArchive) {
        const actives = await ModelArchive.findAll({
          where: { application_status: "active" },
          attributes: [
            "uuid",
            "location",
            "application_date",
            "date_of_birth",
            "citizenship",
            "createdAt",
          ],
          order: [
            [
              ModelArchive.sequelize.literal(
                "CASE WHEN citizenship = 'WNA' THEN 1 ELSE 0 END",
              ),
              "ASC",
            ],
            ["date_of_birth", "ASC"],
            ["createdAt", "ASC"],
          ],
          transaction: t,
          lock: t.LOCK.UPDATE,
        });

        const repack = repackArchivesByYear(actives, []);

        if (repack.total > TOTAL_CAPACITY) {
          await t.rollback();
          return res.status(400).json({
            msg: `Kapasitas penyimpanan penuh! (Max ${TOTAL_CAPACITY} archive)`,
          });
        }

        for (const upd of repack.updates) {
          await ModelArchive.update(
            { location: upd.location },
            { where: { uuid: upd.uuid }, transaction: t },
          );
        }
      }

      await archive.reload({ transaction: t });
      await t.commit();
      return res.status(200).json({
        msg: "Archive updated successfully",
        updatedArchive: archive,
      });
    }

    const file = req.files.file;
    const fileSize = file.data.length;
    const ext = path.extname(file.name).toLowerCase();
    const allowedTypes = [".png", ".jpg", ".jpeg", ".pdf"];

    if (!allowedTypes.includes(ext)) {
      await t.rollback();
      return res
        .status(422)
        .json({ msg: "Format file tidak didukung! (PDF/PNG/JPG/JPEG)" });
    }
    if (fileSize > 30 * 1024 * 1024) {
      await t.rollback();
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

    await archive.update(
      {
        ...payload,
        file: filename,
        file_path,
      },
      { transaction: t },
    );

    if (isActiveArchive) {
      const actives = await ModelArchive.findAll({
        where: { application_status: "active" },
        attributes: [
          "uuid",
          "location",
          "application_date",
          "date_of_birth",
          "citizenship",
          "createdAt",
        ],
        order: [
          [
            ModelArchive.sequelize.literal(
              "CASE WHEN citizenship = 'WNA' THEN 1 ELSE 0 END",
            ),
            "ASC",
          ],
          ["date_of_birth", "ASC"],
          ["createdAt", "ASC"],
        ],
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      const repack = repackArchivesByYear(actives, []);

      if (repack.total > TOTAL_CAPACITY) {
        await t.rollback();
        return res.status(400).json({
          msg: `Kapasitas penyimpanan penuh! (Max ${TOTAL_CAPACITY} archive)`,
        });
      }

      for (const upd of repack.updates) {
        await ModelArchive.update(
          { location: upd.location },
          { where: { uuid: upd.uuid }, transaction: t },
        );
      }
    }

    await archive.reload({ transaction: t });
    await t.commit();

    return res.status(200).json({
      msg: "Archive updated successfully",
      updatedArchive: archive,
    });
  } catch (error) {
    if (!t.finished) {
      await t.rollback();
    }
    console.log(error);
    return res.status(500).json({ msg: "Server error", error: String(error) });
  }
};

export const updateArchiveStatus = async (req, res) => {
  const { id } = req.params;
  const { application_status } = req.body;

  const t = await ModelArchive.sequelize.transaction();
  try {
    const archive = await ModelArchive.findByPk(id, { transaction: t });

    if (!archive) {
      await t.rollback();
      return res.status(404).json({ msg: "Archive tidak ditemukan!" });
    }

    const isDeactivating = application_status === "inactive";

    // Update status archive
    await archive.update(
      {
        application_status,
        location: isDeactivating ? null : archive.location,
      },
      { transaction: t },
    );

    // Jika archive di-inactive, repack semua archive aktif untuk menutup celah
    if (isDeactivating) {
      const actives = await ModelArchive.findAll({
        where: { application_status: "active" },
        attributes: [
          "uuid",
          "location",
          "application_date",
          "date_of_birth",
          "citizenship",
          "createdAt",
        ],
        order: [
          [
            ModelArchive.sequelize.literal(
              "CASE WHEN citizenship = 'WNA' THEN 1 ELSE 0 END",
            ),
            "ASC",
          ],
          ["date_of_birth", "ASC"],
          ["createdAt", "ASC"],
        ],
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      // Repack untuk menutup celah yang ditinggalkan
      const repack = repackArchivesByYear(actives, []);

      if (repack.total > TOTAL_CAPACITY) {
        await t.rollback();
        return res.status(400).json({
          msg: `Kapasitas penyimpanan penuh! (Max ${TOTAL_CAPACITY} archive)`,
        });
      }

      // Update location untuk archive yang bergeser
      for (const upd of repack.updates) {
        await ModelArchive.update(
          { location: upd.location },
          { where: { uuid: upd.uuid }, transaction: t },
        );
      }

      // Fetch semua archive yang diupdate SEBELUM commit
      const updatedArchiveIds = [id, ...repack.updates.map((u) => u.uuid)];
      const updatedArchives = await ModelArchive.findAll({
        where: {
          uuid: {
            [Op.in]: updatedArchiveIds,
          },
        },
        order: [
          ["location", "ASC"],
          ["date_of_birth", "ASC"],
        ],
        transaction: t,
      });

      await t.commit();

      return res.status(200).json({
        msg: "Archive status updated successfully",
        archivesShifted: repack.updates.length,
        updatedArchives: updatedArchives,
        updates: repack.updates.map((u) => ({
          uuid: u.uuid,
          newLocation: u.location,
        })),
      });
    }

    // Reload archive untuk mendapatkan data terbaru dari database
    await archive.reload({ transaction: t });

    await t.commit();

    return res.status(200).json({
      msg: "Archive status updated successfully",
      updatedArchive: archive,
    });
  } catch (error) {
    if (!t.finished) {
      await t.rollback();
    }
    console.error(error);
    return res.status(500).json({ msg: "Server error", error: error.message });
  }
};

export const repackActiveArchives = async (req, res) => {
  const t = await ModelArchive.sequelize.transaction();
  try {
    const actives = await ModelArchive.findAll({
      where: { application_status: "active" },
      attributes: [
        "uuid",
        "location",
        "application_date",
        "date_of_birth",
        "citizenship",
        "createdAt",
      ],
      order: [
        [
          ModelArchive.sequelize.literal(
            "CASE WHEN citizenship = 'WNA' THEN 1 ELSE 0 END",
          ),
          "ASC",
        ],
        ["date_of_birth", "ASC"], // urutkan berdasarkan tahun lahir dulu
        ["createdAt", "ASC"], // kemudian waktu pembuatan
      ],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    const repack = repackArchivesByYear(actives, []);

    if (repack.total > TOTAL_CAPACITY) {
      await t.rollback();
      return res.status(400).json({
        msg: `Kapasitas penyimpanan penuh! (Max ${TOTAL_CAPACITY} archive)`,
      });
    }

    // Log untuk debug
    console.log(
      `Repack: ${repack.total} total archives, ${repack.updates.length} akan diupdate`,
    );

    for (const upd of repack.updates) {
      await ModelArchive.update(
        { location: upd.location },
        { where: { uuid: upd.uuid }, transaction: t },
      );
    }

    await t.commit();
    return res.status(200).json({
      msg: "Repack berhasil",
      updated: repack.updates.length,
      total: repack.total,
    });
  } catch (error) {
    if (!t.finished) {
      await t.rollback();
    }
    console.error("Repack error:", error);
    return res.status(500).json({ msg: "Repack gagal", error: error.message });
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
