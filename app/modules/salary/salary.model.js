const validator = require("validator");
const bcrypt = require("bcryptjs");

module.exports = (sequelize, DataTypes) => {
  const Salary = sequelize.define(
    "Salary",
    {
      Id: {
        type: DataTypes.INTEGER(10),
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      late: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      early_leave: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      absent: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      friday_absent: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      unapproval_absent: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      deletedAt: {
        type: DataTypes.DATE,
        allowNull: true, // This will be used for soft delete
      },
    },
    {
      timestamps: true,
      paranoid: true, // Soft delete enabled
    },
  );

  return Salary;
};
