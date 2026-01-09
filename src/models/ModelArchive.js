import { DataTypes } from "sequelize";
import db from "../configs/database.js";

const ModelArchive = db.define(
  "Archive",
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
    no_archive:{
      type: DataTypes.STRING,
    },
    application_number: {
      type: DataTypes.STRING,
    },
    application_date: {
      type: DataTypes.DATEONLY,
    },

    // ENUM application_type
    application_type: {
      type: DataTypes.ENUM(
        "BARU",
        "GANTI (PENUH / HALAMAN PENUH)",
        "GANTI (HABIS MASA BERLAKU)",
        "GANTI (HILANG)"
      ),
    },

    // ENUM change
    // change_type: {
    //   type: DataTypes.ENUM(
    //     "halaman_penuh",
    //     "habis_masa_berlaku",
    //     "hilang",
    //     "rusak",
    //     "hilang_karena_keadaan_kahar",
    //     "rusak_karena_keadaan_kahar"
    //   ),
    // },

    passport_purpose: {
      type: DataTypes.STRING,
    },
    passport_number: {
      type: DataTypes.STRING,
    },

    // ENUM passport_type
    passport_type: {
      type: DataTypes.ENUM(
        "paspor biasa elektronik laminasi 5 tahun",
        "paspor biasa elektronik laminasi 10 tahun",
        "PASPOR BIASA 24 H"
      ),
    },

    service_method: {
      type: DataTypes.ENUM("layanan percepatan", "layanan online"),
    },

    full_name: {
      type: DataTypes.STRING,
    },
    date_of_birth: {
      type: DataTypes.DATEONLY,
    },

    // ENUM gender
    gender: {
      type: DataTypes.ENUM("L", "P"),
    },

    passport_registration_number: {
      type: DataTypes.STRING,
    },
    issue_date: {
      type: DataTypes.DATEONLY,
    },
    expiration_date: {
      type: DataTypes.DATEONLY,
    },

    province: {
      type: DataTypes.STRING,
    },
    district_city: {
      type: DataTypes.STRING,
    },
    sub_district: {
      type: DataTypes.STRING,
    },
    file: {
      type: DataTypes.STRING,
    },
    file_path: {
      type: DataTypes.STRING,
    },
  },

  {
    freezeTableName: true,
    timestamps: true,
  }
);

export default ModelArchive;
