const MarketingExpenseFilterAbleFields = [
  "searchTerm",
  "paymentMode",
  "paymentStatus",
  "startDate",
  "endDate",
  "category",
  "bookId",
];

const MarketingExpenseSearchableFields = [
  "status",
  "remarks",
  "paymentMode",
  "paymentStatus",
  "category",
]; // ✅ এখানে searchTerm দিবে না

module.exports = {
  MarketingExpenseFilterAbleFields,
  MarketingExpenseSearchableFields,
};
