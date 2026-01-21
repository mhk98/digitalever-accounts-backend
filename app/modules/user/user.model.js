const validator = require("validator");
const bcrypt = require("bcryptjs");

module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define(
    "User",
    {
      Id: {
        type: DataTypes.INTEGER(10),
        primaryKey: true,
        autoIncrement: true,
        allowNull: true,
      },
      FirstName: {
        type: DataTypes.STRING(64),
        allowNull: true,
      },
      LastName: {
        type: DataTypes.STRING(64),
        allowNull: true,
      },
      Email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      Password: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      Address: {
        type: DataTypes.STRING(64),
        allowNull: true,
      },
      Phone: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      City: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      PostalCode: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      Country: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      image: {
        type: DataTypes.STRING,
        allowNull: true,
      },

      role: {
        type: DataTypes.ENUM(
          "superAdmin",
          "admin",
          "marketer",
          "leader",
          "inventor",
          "accountant",
          "staff",
          "user",
        ),
        allowNull: true,
        defaultValue: "user",
      },
      deletedAt: {
        type: DataTypes.DATE,
        allowNull: true, // This will be used for soft delete
      },
    },
    {
      timestamps: true,
      paranoid: true,
      hooks: {
        beforeCreate: async (user) => {
          if (user.Password) {
            const salt = await bcrypt.genSalt(10);
            user.Password = bcrypt.hashSync(user.Password, salt);
          }
        },
        beforeUpdate: async (user) => {
          if (user.changed("Password") && user.Password) {
            const salt = await bcrypt.genSalt(10);
            user.Password = bcrypt.hashSync(user.Password, salt);
          }
        },
      },
    },
  );

  User.prototype.validPassword = async function (Password) {
    return await bcrypt.compare(Password, this.Password);
  };

  return User;
};
