import { DataTypes } from "sequelize";
import db from "../configs/database.js";
import bcrypt from "bcryptjs";

const User = db.define(
  "user",
  {
    uuid: {
      type: DataTypes.STRING,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    username: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    token: {
      type: DataTypes.STRING,
    },
    division: {
      type: DataTypes.STRING,
    },
    role: {
      type: DataTypes.ENUM("superadmin", "admin", "user"),
    },
  },
  {
    freezeTableName: true,
  },
);

export default User;


