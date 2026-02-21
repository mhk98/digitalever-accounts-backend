const CashInOutFilterAbleFields = [
  "searchTerm",
  "name",
  "paymentMode",
  "paymentStatus",
  "startDate",
  "endDate",
  "category",
  "bookId",
];

const CashInOutSearchableFields = [
  "status",
  "remarks",
  "paymentMode",
  "paymentStatus",
  "category",
]; // ✅ এখানে searchTerm দিবে না

module.exports = {
  CashInOutFilterAbleFields,
  CashInOutSearchableFields,
};
