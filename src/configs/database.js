import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';
dotenv.config();

const db = new Sequelize({
  database: process.env.DATABASE,
  username: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  dialect: 'mysql',
});

export default db;
