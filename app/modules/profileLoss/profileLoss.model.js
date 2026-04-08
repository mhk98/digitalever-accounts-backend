module.exports = (sequelize, DataTypes) => {
  const ProfileLoss = sequelize.define(
    "ProfileLoss",
    {
      Id: {
        type: DataTypes.INTEGER(10),
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },

      salesType: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      products: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
      },

      purchase: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
        validate: {
          notEmpty: true, // Ensure price is not empty
        },
      },
      revenue: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
        validate: {
          notEmpty: true, // Ensure price is not empty
        },
      },
      return: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
        validate: {
          notEmpty: true, // Ensure price is not empty
        },
      },

      cost: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
        validate: {
          notEmpty: true, // Ensure price is not empty
        },
      },

      profitLoss: {
        type: DataTypes.INTEGER(10),
        allowNull: false,
        validate: {
          notEmpty: true, // Ensure price is not empty
        },
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

  return ProfileLoss;
};
