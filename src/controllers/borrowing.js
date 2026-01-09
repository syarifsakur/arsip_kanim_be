import ModelArchive from "../models/ModelArchive.js";
import ModelBorrowing from "../models/ModelBorrowing.js";

export const getBorrowings = async (req, res) => {
  try {
    const { rows: response, count: total } =
      await ModelBorrowing.findAndCountAll({
        include: [
          {
            model: ModelArchive,
            as: "archive",
            // attributes: [
            //   "uuid",
            //   "application_number",
            //   "application_date",
            //   "application_type",
            //   "passport_type",
            //   "passport_number",
            //   "passport_registration_number",
            //   "service_method",
            //   "full_name",
            //   "date_of_birth",
            //   "gender",
            //   "issue_date",
            //   "expiration_date",
            // ],
          },
        ],
        attributes: [
          "uuid",
          "borrowers_name",
          "division",
          "loan_date",
          "return_date",
          "status",
        ],
        order: [["createdAt", "DESC"]],
      });

    return res.status(200).json({ data: response, total: total });
  } catch (error) {
    return res.status(500).json({ msg: error.message });
  }
};

export const getBorrowingById = async (req, res) => {
  try {
    const { id } = req.params;
    const borrowing = await ModelBorrowing.findByPk(id);
    if (!borrowing)
      return res.status(404).json({ msg: "Peminjaman tidak ditemukan!" });
    return res.status(200).json(borrowing);
  } catch (error) {
    return res.status(500).json(error);
  }
};

export const createBorrowing = async (req, res) => {
  const { id_archive, borrowers_name, division, loan_date, return_date } =
    req.body;

  const archive = await ModelArchive.findByPk(id_archive);
  if (!archive)
    return res.status(404).json({ msg: "Archive tidak ditemukan!" });

  try {
    await ModelBorrowing.create({
      id_archive,
      borrowers_name,
      division,
      loan_date,
      return_date,
      status: "dipinjam",
    });

    return res.status(201).json({ msg: "Peminjaman berhasil dibuat" });
  } catch (error) {
    return res.status(500).json({ msg: error.message });
  }
};

export const updateBorrowing = async (req, res) => {
  const { id_archive, borrowers_name, division, loan_date, return_date } =
    req.body;
  const { id } = req.params;

  const borrowing = await ModelBorrowing.findByPk(id);
  if (!borrowing)
    return res.status(404).json({ msg: "Peminjaman tidak ditemukan!" });

  try {
    await borrowing.update({
      id_archive,
      borrowers_name,
      division,
      loan_date,
      return_date,
    });

    return res.status(200).json({ msg: "Peminjaman berhasil diperbarui" });
  } catch (error) {
    console.log(error);
    return res.status(500).json(error);
  }
};

export const updateBorrowingStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const borrowing = await ModelBorrowing.findByPk(id);
  if (!borrowing)
    return res.status(404).json({ msg: "Peminjaman tidak ditemukan!" });

  try {
    await borrowing.update({
      status,
    });

    return res
      .status(200)
      .json({ msg: "Status peminjaman berhasil diperbarui" });
  } catch (error) {
    return res.status(500).json(error);
  }
};

export const deleteBorrowing = async (req, res) => {
  try {
    const { id } = req.params;
    const borrowing = await ModelBorrowing.findByPk(id);
    if (!borrowing)
      return res.status(404).json({ msg: "Peminjaman tidak ditemukan!" });
    await borrowing.destroy();
    return res.status(200).json({ msg: "Peminjaman berhasil dihapus" });
  } catch (error) {
    return res.status(500).json({ msg: error.message });
  }
};
