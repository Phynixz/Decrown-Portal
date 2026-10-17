function getReceiptAccessError(user) {
  if (user?.disapproved) return "This application was not approved.";
  if (user?.retainPending) return "Receipt unavailable until admin approval.";
  return "";
}

module.exports = getReceiptAccessError;