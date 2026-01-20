const validator = require("validator");
const bcrypt = require("bcryptjs");

module.exports = (sequelize, DataTypes) => {
  const Meta = sequelize.define(
    "Meta",
    {
      Id: {
        type: DataTypes.INTEGER(10),
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      platform: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notEmpty: true, // Ensure name is not empty
        },
      },
      amount: {
        type: DataTypes.FLOAT,
        allowNull: false,
        validate: {
          notEmpty: true, // Ensure name is not empty
        },
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

  return Meta;
};
