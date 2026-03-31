const CashInOutFilterAbleFields = [
  "searchTerm",
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
  "amount",
  "paymentMode",
  "paymentStatus",
  "category",
  "bankAccount",
]; // ✅ এখানে searchTerm দিবে না

module.exports = {
  CashInOutFilterAbleFields,
  CashInOutSearchableFields,
};
