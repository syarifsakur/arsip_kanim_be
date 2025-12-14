import { DataTypes } from "sequelize";
import db from "../configs/database.js";
import ModelArchive from "./ModelArchive.js";

const ModelBorrowing = db.define(
  "borrowing",
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

    id_archive: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },

    borrowers_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    division: {
      type: DataTypes.STRING,
    },

    loan_date: {
      type: DataTypes.DATEONLY,
    },

    return_date: {
      type: DataTypes.DATEONLY,
    },
  },
  {
    freezeTableName: true,
    timestamps: true,
  }
);

ModelBorrowing.belongsTo(ModelArchive, {
  foreignKey: "id_archive",
  as: "archive",
  onDelete: "cascade",
  onUpdate: "cascade",
});

export default ModelBorrowing;
