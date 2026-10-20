import asyncHandler from "express-async-handler";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { roleSchema } from "../models/user/index.js";
import { SYSTEM_PERMISSIONS } from "../config/permissions.config.js";
import { seedDefaultRoles } from "../utils/seedDefaultRoles.js";

// @desc    Get system permissions schema
// @route   GET /api/roles/schema
// @access  Private
export const getPermissionSchema = asyncHandler(async (req, res) => {
  res.status(200).json(new ApiResponse(200, SYSTEM_PERMISSIONS, "Permission schema fetched successfully"));
});


// @desc    Create a new role
// @route   POST /api/roles
// @access  Private
export const createRole = asyncHandler(async (req, res) => {
  const RoleModel = req.getModel("Role", roleSchema);
  const { name, description, policies } = req.body;

  if (!name) {
    throw new ApiError(400, "Role name is required");
  }

  const RESERVED_NAMES = ["gm", "admin default role", "company management"];
  if (RESERVED_NAMES.includes(name.trim().toLowerCase())) {
    throw new ApiError(400, `The role name '${name}' is reserved by the system.`);
  }

  const roleExists = await RoleModel.findOne({ name, company: req.company._id });
  if (roleExists) {
    throw new ApiError(400, "Role with this name already exists");
  }

  const role = await RoleModel.create({
    company: req.company._id,
    name,
    description,
    policies,
    isDefault: false,
  });

  res.status(201).json(new ApiResponse(201, role, "Role created successfully"));
});

// @desc    Get all roles
// @route   GET /api/roles
// @access  Private
export const getRoles = asyncHandler(async (req, res) => {
  const RoleModel = req.getModel("Role", roleSchema);
  if (req.company && req.company._id) {
    await seedDefaultRoles(RoleModel, req.company._id);
  }
  const roles = await RoleModel.find({ company: req.company._id }).sort({ createdAt: -1 });

  res.status(200).json(new ApiResponse(200, roles, "Roles fetched successfully"));
});

// @desc    Get role by ID
// @route   GET /api/roles/:id
// @access  Private
export const getRoleById = asyncHandler(async (req, res) => {
  const RoleModel = req.getModel("Role", roleSchema);
  const role = await RoleModel.findOne({ _id: req.params.id, company: req.company._id });

  if (!role) {
    throw new ApiError(404, "Role not found");
  }

  res.status(200).json(new ApiResponse(200, role, "Role fetched successfully"));
});

// @desc    Update role
// @route   PUT /api/roles/:id
// @access  Private
export const updateRole = asyncHandler(async (req, res) => {
  const RoleModel = req.getModel("Role", roleSchema);
  const { name, description, policies, isActive } = req.body;

  const role = await RoleModel.findOne({ _id: req.params.id, company: req.company._id });

  if (!role) {
    throw new ApiError(404, "Role not found");
  }

  if (name) {
    const trimmed = name.trim();
    const RESERVED_NAMES = ["gm", "admin default role", "company management"];
    if (!role.isDefault && RESERVED_NAMES.includes(trimmed.toLowerCase())) {
      throw new ApiError(400, `The role name '${name}' is reserved by the system.`);
    }
    if (role.isDefault && trimmed.toLowerCase() !== role.name.toLowerCase()) {
      throw new ApiError(403, "System default role names cannot be renamed.");
    }
    role.name = trimmed;
  }
  if (description !== undefined) role.description = description;
  if (policies) role.policies = policies;
  if (isActive !== undefined) role.isActive = isActive;

  const updatedRole = await role.save();

  res.status(200).json(new ApiResponse(200, updatedRole, "Role updated successfully"));
});

// @desc    Delete role
// @route   DELETE /api/roles/:id
// @access  Private
export const deleteRole = asyncHandler(async (req, res) => {
  const RoleModel = req.getModel("Role", roleSchema);
  
  const role = await RoleModel.findOne({ _id: req.params.id, company: req.company._id });

  if (!role) {
    throw new ApiError(404, "Role not found");
  }

  if (role.isDefault) {
    throw new ApiError(403, `System default role '${role.name}' cannot be deleted.`);
  }

  await RoleModel.findOneAndDelete({ _id: req.params.id, company: req.company._id });

  res.status(200).json(new ApiResponse(200, null, "Role deleted successfully"));
});
