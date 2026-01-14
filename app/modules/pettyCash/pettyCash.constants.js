const pettyCashFilterAbleFields = [
  "searchTerm",
  "paymentMode",
  "paymentStatus",
  "startDate",
  "endDate",
];

const pettyCashSearchableFields = ["remarks"]; // ✅ এখানে searchTerm দিবে না

module.exports = {
  pettyCashFilterAbleFields,
  pettyCashSearchableFields,
};
