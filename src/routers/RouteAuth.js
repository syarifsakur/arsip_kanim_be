import express from 'express';
import {
  changePassword,
  Login,
  logout,
  refreshTokenAuth,
  register,
} from '../controllers/auth.js';
import verifyToken from '../middlewares/VerifyToken.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', Login);
router.get('/refresh-token', refreshTokenAuth);
router.put('/change-password', verifyToken, changePassword);
router.delete('/logout', verifyToken, logout);

export default router;
