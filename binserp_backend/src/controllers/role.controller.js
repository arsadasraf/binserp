import asyncHandler from "express-async-handler";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { roleSchema } from "../models/user/index.js";

// @desc    Create a new role
// @route   POST /api/roles
// @access  Private
export const createRole = asyncHandler(async (req, res) => {
  const RoleModel = req.getModel("Role", roleSchema);
  const { name, description, policies } = req.body;

  if (!name) {
    throw new ApiError(400, "Role name is required");
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
  });

  res.status(201).json(new ApiResponse(201, role, "Role created successfully"));
});

// @desc    Get all roles
// @route   GET /api/roles
// @access  Private
export const getRoles = asyncHandler(async (req, res) => {
  const RoleModel = req.getModel("Role", roleSchema);
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

  if (name) role.name = name;
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

  if (role.isDefault && (role.name === "Admin Default Role" || role.name === "Company Management")) {
    throw new ApiError(403, "The Admin Default Role is required for company management and cannot be deleted.");
  }

  await RoleModel.findOneAndDelete({ _id: req.params.id, company: req.company._id });

  res.status(200).json(new ApiResponse(200, null, "Role deleted successfully"));
});
