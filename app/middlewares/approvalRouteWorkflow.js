const db = require("../../models");
const ApiError = require("../../error/ApiError");
const { Op } = require("sequelize");
const { ENUM_USER_ROLE } = require("../enums/user");
const {
  applyCreateWorkflow,
  applyUpdateWorkflow,
  buildDeleteWorkflowPayload,
  isPrivilegedRole,
} = require("../../shared/approvalWorkflow");
const {
  rebuildAssetsStockBalances,
} = require("../modules/assetsStock/assetsStockSync");

const Notification = db.notification;
const User = db.user;
const PENDING_UPDATE_NOTE = "[Approval pending for update]";
const UPDATE_APPROVED_NOTE = "[Update request approved]";

const readDeleteNote = (req) =>
  req.body?.note ||
  req.query?.note ||
  req.headers["x-delete-note"] ||
  req.headers["x-approval-note"];

const hasAttribute = (Model, field) => Boolean(Model?.rawAttributes?.[field]);

const stripWorkflowNote = (value) =>
  String(value || "")
    .replace(/\[Approval pending for update\]/g, "")
    .replace(/\[Update request approved\]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(undefined|null)$/i, "");

const buildPendingUpdateNote = (value) => {
  const note = stripWorkflowNote(value);
  return note ? `${note} ${PENDING_UPDATE_NOTE}` : PENDING_UPDATE_NOTE;
};

const buildApprovedUpdateNote = (value) => {
  const note = stripWorkflowNote(value);
  return note ? `${note} ${UPDATE_APPROVED_NOTE}` : UPDATE_APPROVED_NOTE;
};

const notifyApprovedPettyCash = async (req) => {
  const users = await User.findAll({
    attributes: ["Id", "role"],
    where: {
      Id: { [Op.ne]: req.user?.Id || null },
      role: { [Op.in]: [ENUM_USER_ROLE.ACCOUNTANT] },
    },
  });

  if (!users.length) return;

  await Promise.all(
    users.map((user) =>
      Notification.create({
        userId: user.Id,
        message: "Petty cash requisition request approved",
        url: `/shifa.digitalever.com.bd/petty-cash`,
      }),
    ),
  );
};

const notifyApprovedAssetsRequisition = async (req) => {
  const users = await User.findAll({
    attributes: ["Id", "role"],
    where: {
      Id: { [Op.ne]: req.user?.Id || null },
      role: { [Op.in]: [ENUM_USER_ROLE.INVENTOR] },
    },
  });

  if (!users.length) return;

  await Promise.all(
    users.map((user) =>
      Notification.create({
        userId: user.Id,
        message: "Assets requisition request approved",
        url: `/shifa.digitalever.com.bd/assets-requisition`,
      }),
    ),
  );
};

const applyApprovalWorkflow =
  ({ modelKey, entityLabel }) =>
  async (req, res, next) => {
    try {
      const Model = db[modelKey];
      if (!Model) {
        throw new ApiError(
          500,
          `${entityLabel || modelKey} workflow model not found`,
        );
      }

      if (req.method === "POST") {
        const nextBody = applyCreateWorkflow(req.body || {}, req.user || {});
        if (!hasAttribute(Model, "status")) {
          delete nextBody.status;
        }
        if (!hasAttribute(Model, "pendingAction")) {
          delete nextBody.pendingAction;
        }
        if (!hasAttribute(Model, "approvalNote")) {
          delete nextBody.approvalNote;
        }
        if (!hasAttribute(Model, "requestedByUserId")) {
          delete nextBody.requestedByUserId;
        }
        req.body = nextBody;
        return next();
      }

      if (req.method === "PUT" || req.method === "PATCH") {
        const nextBody = applyUpdateWorkflow(req.body || {}, req.user || {});

        if (!hasAttribute(Model, "status")) {
          delete nextBody.status;
        }

        if (!hasAttribute(Model, "pendingAction")) {
          delete nextBody.pendingAction;
        }

        if (hasAttribute(Model, "approvalNote")) {
          // keep
        } else if (hasAttribute(Model, "note")) {
          nextBody.note = buildPendingUpdateNote(req.body?.note);
          delete nextBody.approvalNote;
        } else {
          delete nextBody.approvalNote;
        }

        if (!hasAttribute(Model, "requestedByUserId")) {
          delete nextBody.requestedByUserId;
        }

        req.body = nextBody;
        return next();
      }

      if (req.method !== "DELETE") {
        return next();
      }

      if (isPrivilegedRole(req.user?.role)) {
        return next();
      }

      const existing = await Model.findOne({ where: { Id: req.params.id } });
      if (!existing) {
        throw new ApiError(404, `${entityLabel || "Record"} not found`);
      }

      const workflowPayload = buildDeleteWorkflowPayload(
        readDeleteNote(req),
        req.user,
      );
      const updatePayload = {};

      if (hasAttribute(Model, "status")) {
        updatePayload.status = hasAttribute(Model, "pendingAction")
          ? "Pending"
          : "Pending Delete";
      }

      if (hasAttribute(Model, "pendingAction")) {
        updatePayload.pendingAction = workflowPayload.pendingAction;
      }

      if (hasAttribute(Model, "approvalNote")) {
        updatePayload.approvalNote = workflowPayload.approvalNote;
      } else if (hasAttribute(Model, "note")) {
        updatePayload.note = workflowPayload.approvalNote;
      }

      if (hasAttribute(Model, "requestedByUserId")) {
        updatePayload.requestedByUserId = workflowPayload.requestedByUserId;
      }

      await Model.update(updatePayload, {
        where: { Id: req.params.id },
      });

      const updated = await Model.findOne({ where: { Id: req.params.id } });

      return res.status(200).json({
        success: true,
        message: `${entityLabel || "Record"} delete request submitted for approval`,
        data: updated,
      });
    } catch (error) {
      return next(error);
    }
  };

const approvePendingWorkflow =
  ({ modelKey, entityLabel }) =>
  async (req, res, next) => {
    try {
      const Model = db[modelKey];
      if (!Model) {
        throw new ApiError(
          500,
          `${entityLabel || modelKey} workflow model not found`,
        );
      }

      const existing = await Model.findOne({ where: { Id: req.params.id } });
      if (!existing) {
        throw new ApiError(404, `${entityLabel || "Record"} not found`);
      }

      if (
        existing.pendingAction === "Delete" ||
        existing.status === "Pending Delete"
      ) {
        await Model.destroy({ where: { Id: req.params.id } });
        if (
          ["assetsPurchase", "assetsSale", "assetsDamage"].includes(modelKey)
        ) {
          await db.sequelize.transaction(async (t) => {
            await rebuildAssetsStockBalances(t);
          });
        }
        return res.status(200).json({
          success: true,
          message: `${entityLabel || "Record"} deleted successfully`,
          data: { deleted: true, workflowAction: "deleted" },
        });
      }

      const approvalPayload = {};

      if (hasAttribute(Model, "status")) {
        approvalPayload.status = "Active";
      }
      if (hasAttribute(Model, "pendingAction")) {
        approvalPayload.pendingAction = null;
      }
      if (hasAttribute(Model, "approvalNote")) {
        approvalPayload.approvalNote = null;
      } else if (hasAttribute(Model, "note")) {
        approvalPayload.note = buildApprovedUpdateNote(existing.note);
      }
      if (hasAttribute(Model, "requestedByUserId")) {
        approvalPayload.requestedByUserId = null;
      }

      await Model.update(approvalPayload, { where: { Id: req.params.id } });

      const updated = await Model.findOne({ where: { Id: req.params.id } });

      if (["assetsPurchase", "assetsSale", "assetsDamage"].includes(modelKey)) {
        await db.sequelize.transaction(async (t) => {
          await rebuildAssetsStockBalances(t);
        });
      }
      if (modelKey === "pettyCash") {
        await notifyApprovedPettyCash(req);
      }
      if (modelKey === "assetsRequisition") {
        await notifyApprovedAssetsRequisition(req);
      }

      return res.status(200).json({
        success: true,
        message: `${entityLabel || "Record"} approved successfully`,
        data: updated,
      });
    } catch (error) {
      return next(error);
    }
  };

module.exports = {
  applyApprovalWorkflow,
  approvePendingWorkflow,
};
