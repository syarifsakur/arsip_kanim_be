import User from "../models/ModelUser.js";
import bcrypt from "bcryptjs";

export const getUser = async (req, res) => {
  try {
    const response = await User.findAll({
      attributes: [
        "uuid",
        "username",
        "role",
        "division",
        "createdAt",
        "updatedAt",
      ],
    });
    return res.status(200).json(response);
  } catch (error) {
    return res.status(500).json(error);
  }
};

export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByPk(id);

    if (!user) return res.status(404).json({ msg: "User tidak ditemukan!" });

    return res.status(200).json(user);
  } catch (error) {
    return res.status(500).json(error);
  }
};

export const createUser = async (req, res) => {
  const { username, password, role, division } = req.body;
  try {
    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(password, salt);

    await User.create({
      username,
      password: hashedPassword,
      role,
      division,
    });

    return res.status(201).json({ message: "berhasil membuat user baru" });
  } catch (error) {
    return res.status(500).json(error);
  }
};

export const updateUser = async (req, res) => {
  const { username, role, division } = req.body;
  const { id } = req.params;

  const user = await User.findByPk(id);
  if (!user) return res.status(404).json({ msg: "User tidak ditemukan!" });

  try {
    await User.update(
      {
        username,
        role,
        division,
      },
      {
        where: {
          uuid: id,
        },
      },
    );

    return res.status(200).json({ msg: "User berhasil diperbarui!" });
  } catch (error) {
    return res.status(500).json(error);
  }
};

export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ msg: "User tidak ditemukan!" });

    await User.destroy({ where: { uuid: id } });
    return res.status(200).json({ msg: "User berhasil dihapus!" });
  } catch (error) {
    return res.status(500).json(error);
  }
};
