const validator = require("validator");
const bcrypt = require("bcryptjs");

module.exports = (sequelize, DataTypes) => {
  const ReceivedProduct = sequelize.define(
    "ReceivedProduct",
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
      purchase_price: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
        validate: {
          notEmpty: true, // Ensure name is not empty
        },
      },
      sale_price: {
        type: DataTypes.INTEGER(10),
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
      supplier: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      note: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      status: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {
      timestamps: true,
    },
  );

  return ReceivedProduct;
};
