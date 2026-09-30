const STAFF_PERMISSIONS = Object.freeze({
  reviewer: ["clients:read", "clients:review"],
  viewer: ["clients:read"],
});

function hasPlatformPermission(role, required) {
  if (role === "owner") return true;
  const granted = STAFF_PERMISSIONS[role] || [];
  return required.every((permission) => granted.includes(permission));
}

module.exports = { STAFF_PERMISSIONS, hasPlatformPermission };
