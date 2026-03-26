const validator = require("validator");
const bcrypt = require("bcryptjs");

module.exports = (sequelize, DataTypes) => {
  const EmployeeList = sequelize.define(
    "EmployeeList",
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
      employee_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
          notEmpty: true, // Ensure name is not empty
        },
      },
      salary: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
          notEmpty: true, // Ensure name is not empty
        },
      },

      date: {
        type: DataTypes.DATEONLY,
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
      deletedAt: {
        type: DataTypes.DATE,
        allowNull: true, // This will be used for soft delete
      },
    },
    {
      timestamps: true,
      paranoid: true, // Soft delete enabled
      tableName: "EmployeeLists",
    },
  );

  return EmployeeList;
};
