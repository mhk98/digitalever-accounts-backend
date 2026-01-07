const validator = require("validator");
const bcrypt = require("bcryptjs");

module.exports = (sequelize, DataTypes) => {
  const Product = sequelize.define("Product", {
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
    
  }, {
    timestamps: true,
    tableName: "Products",
  });

  return Product;
};
