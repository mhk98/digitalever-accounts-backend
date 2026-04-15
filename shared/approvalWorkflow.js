const { ENUM_USER_ROLE } = require("../app/enums/user");
const ApiError = require("../error/ApiError");

const PRIVILEGED_ROLES = [ENUM_USER_ROLE.SUPER_ADMIN, ENUM_USER_ROLE.ADMIN];

const isPrivilegedRole = (role) => PRIVILEGED_ROLES.includes(role);

const sanitizeApprovalNote = (value) => {
  const note = String(value || "").trim();
  return note || null;
};

const applyCreateWorkflow = (payload = {}, user = {}) => {
  return {
    ...payload,
    status: isPrivilegedRole(user.role) ? payload.status || "Active" : payload.status,
    pendingAction: null,
    approvalNote: null,
    requestedByUserId: null,
  };
};

const applyUpdateWorkflow = (payload = {}, user = {}) => {
  if (isPrivilegedRole(user.role)) {
    return {
      ...payload,
      status: payload.status || "Active",
      pendingAction: null,
      approvalNote: sanitizeApprovalNote(payload.approvalNote),
      requestedByUserId: null,
    };
  }

  return {
    ...payload,
    status: "Pending",
    pendingAction: "Update",
    approvalNote: sanitizeApprovalNote(payload.approvalNote),
    requestedByUserId: user.Id || null,
  };
};

const ensureDeleteNote = (note) => {
  const sanitized = sanitizeApprovalNote(note);

  if (!sanitized) {
    throw new ApiError(400, "A delete request note is required");
  }

  return sanitized;
};

const buildDeleteWorkflowPayload = (note, user = {}) => ({
  status: "Pending",
  pendingAction: "Delete",
  approvalNote: ensureDeleteNote(note),
  requestedByUserId: user.Id || null,
});

module.exports = {
  isPrivilegedRole,
  applyCreateWorkflow,
  applyUpdateWorkflow,
  buildDeleteWorkflowPayload,
};
