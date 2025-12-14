import jwt from 'jsonwebtoken';
import Admin from '../models/ModelAdmin.js';

const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader)
      return res.status(401).json({ message: 'Token not found!' });

    const token = authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ message: 'Token not found!' });

    jwt.verify(token, process.env.ACCESS_SECRET_TOKEN, async (err, decoded) => {
      if (err) {
        return res.sendStatus(403);
      }

      req.userId = decoded.userId;

      const user = await Admin.findOne({
        where: {
          uuid: decoded?.userId,
        },
      });
      req.name = user.fullname;

      next();
    });
  } catch (error) {
    console.error('Kesalahan Verivy Token:', error.message);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

export default verifyToken;
