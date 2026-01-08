const CashInOutFilterAbleFields = [
  "searchTerm",
  "name",
  "paymentMode",
  "paymentStatus",
  "startDate",
  "endDate",
  "bookId",
];

const CashInOutSearchableFields = ["name", "remarks"]; // ✅ এখানে searchTerm দিবে না

module.exports = {
  CashInOutFilterAbleFields,
  CashInOutSearchableFields,
};
