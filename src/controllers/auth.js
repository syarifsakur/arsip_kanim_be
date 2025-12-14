import Admin from '../models/ModelAdmin.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export const register = async (req, res) => {
  const { username, password } = req.body;

  try {
    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(password, salt);

    const admin = await Admin.create({
      username,
      password: hashedPassword,
    });

    return res.status(201).json({ message: 'Berhasil Membuat Akun!' });
  } catch (error) {
    return res.status(500).json(error);
  }
};

export const Login = async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await Admin.findOne({ where: { username } });

    if (!user) {
      return res.status(404).json({ message: 'Username tidak ditemukan!' });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Password salah!' });
    }

    const token = jwt.sign(
      { userId: user.uuid },
      process.env.ACCESS_SECRET_TOKEN,
      { expiresIn: '10m' }
    );

    const refreshToken = jwt.sign(
      { userId: user.uuid },
      process.env.REFRESH_SECRET_TOKEN,
      { expiresIn: '1d' }
    );

    await Admin.update({ token: refreshToken }, { where: { uuid: user.uuid } });

    const dataForClient = {
      userId: user.uuid,
      username: user.username,
    };

    res.cookie('token', refreshToken, {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
      secure: false,
    });

    return res.status(200).json({ dataForClient, token });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ message: 'Terjadi kesalahan server.', error });
  }
};

export const refreshTokenAuth = async (req, res) => {
  try {
    const refreshToken = req.cookies.token;
    if (!refreshToken) return res.sendStatus(401);

    const user = await Admin.findOne({
      where: { token: refreshToken },
    });

    if (!user) return res.sendStatus(401);

    jwt.verify(
      refreshToken,
      process.env.REFRESH_SECRET_TOKEN,
      (err, decoded) => {
        if (err) return res.sendStatus(403);

        const userId = decoded.userId;

        const token = jwt.sign({ userId }, process.env.ACCESS_SECRET_TOKEN, {
          expiresIn: '10m',
        });

        const dataForClient = {
          userId: user.uuid,
          username: user.username,
        };

        return res.status(200).json({ dataForClient, token: token });
      }
    );
  } catch (error) {
    console.error('Error in refreshTokenAuth:', error);
    return res
      .status(500)
      .json({ message: 'Server error', detail: error.message });
  }
};

export const changePassword = async (req, res) => {
  try {
    const { password_new, password_old } = req.body;
    const { userId } = req;

    const user = await Admin.findByPk(userId);

    const isMatch = await bcrypt.compare(password_old, user.password);

    if (!isMatch)
      return res.status(400).json({ password_old: 'Password anda salah.' });

    const salt = await bcrypt.genSalt();
    const hashPassword = await bcrypt.hash(password_new, salt);

    await Admin.update(
      {
        password: hashPassword,
      },
      {
        where: {
          uuid: userId,
        },
      }
    );

    return res.status(200).json({ message: 'Password berhasil diubah.' });
  } catch (error) {
    return res.status(500).json(error);
  }
};

export const logout = async (req, res) => {
  const { userId } = req;

  try {
    await Admin.update({ token: null }, { where: { uuid: userId } });

    res.clearCookie('token');
    return res.status(200).json({ message: 'Anda berhasil logout!' });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: error.message });
  }
};
