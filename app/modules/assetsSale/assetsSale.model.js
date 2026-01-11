const validator = require("validator");
const bcrypt = require("bcryptjs");

module.exports = (sequelize, DataTypes) => {
  const AssetsSale = sequelize.define(
    "AssetsSale",
    {
      Id: {
        type: DataTypes.INTEGER(10),
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notEmpty: true, // Ensure name is not empty
        },
      },
      quantity: {
        type: DataTypes.INTEGER(10),
        defaultValue: 0,
        allowNull: true,
      },
      price: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
        validate: {
          notEmpty: true, // Ensure name is not empty
        },
      },

      total: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
        validate: {
          notEmpty: true, // Ensure name is not empty
        },
      },
    },
    {
      timestamps: true,
    }
  );

  return AssetsSale;
};
