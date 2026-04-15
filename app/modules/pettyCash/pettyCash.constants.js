const pettyCashFilterAbleFields = [
  "searchTerm",
  "paymentMode",
  "paymentStatus",
  "status",
  "startDate",
  "endDate",
  "category",
];

const pettyCashSearchableFields = [
  "status",
  "remarks",
  "paymentMode",
  "paymentStatus",
  "category",
  "amount",
]; // ✅ এখানে searchTerm দিবে না

module.exports = {
  pettyCashFilterAbleFields,
  pettyCashSearchableFields,
};
