// // models/notification.js
// module.exports = (sequelize, DataTypes) => {
//   const Notification = sequelize.define(
//     "Notification",
//     {
//       userId: {
//         type: DataTypes.STRING,
//         allowNull: false,
//       },
//       url: {
//         type: DataTypes.STRING,
//         allowNull: false, // Enquiries, Tasks, Payments etc.
//       },
//       message: {
//         type: DataTypes.STRING,
//         allowNull: false,
//       },
//       isRead: {
//         type: DataTypes.BOOLEAN,
//         defaultValue: false,
//       },
//     },
//     {
//       tableName: "notifications", // চাইলে custom নাম
//       timestamps: true, // createdAt & updatedAt আসবে
//     },
//   );

//   return Notification;
// };

// models/notification.js
module.exports = (sequelize, DataTypes) => {
  const Notification = sequelize.define(
    "Notification",
    {
      userId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      url: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      message: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      isRead: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
    },
    {
      timestamps: true,
      paranoid: true, // Soft delete enabled
    },
  );

  return Notification;
};
