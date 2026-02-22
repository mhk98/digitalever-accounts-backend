const pettyCashFilterAbleFields = [
  "searchTerm",
  "paymentMode",
  "paymentStatus",
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
]; // ✅ এখানে searchTerm দিবে না

module.exports = {
  pettyCashFilterAbleFields,
  pettyCashSearchableFields,
};
