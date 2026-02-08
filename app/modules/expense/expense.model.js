const validator = require("validator");
const bcrypt = require("bcryptjs");

module.exports = (sequelize, DataTypes) => {
  const Expense = sequelize.define(
    "Expense",
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
      date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },

      amount: {
        type: DataTypes.FLOAT,
        allowNull: false,
        validate: {
          notEmpty: true, // Ensure name is not empty
        },
      },
    },
    {
      timestamps: true,
    },
  );

  return Expense;
};
