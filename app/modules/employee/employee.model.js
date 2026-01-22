const validator = require("validator");
const bcrypt = require("bcryptjs");

module.exports = (sequelize, DataTypes) => {
  const Employee = sequelize.define(
    "Employee",
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
      basic_salary: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      incentive: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
      },
      holiday_payment: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
      },
      total_salary: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
      },
      advance: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
      },
      late: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
      },
      early_leave: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
      },
      absent: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
      },
      friday_absent: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
      },
      early_leave: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
      },
      unapproval_absent: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
      },
      note: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      deletedAt: {
        type: DataTypes.DATE,
        allowNull: true, // This will be used for soft delete
      },
    },
    {
      timestamps: true,
      paranoid: true, // Soft delete enabled
      tableName: "Employees",
    },
  );

  return Employee;
};
