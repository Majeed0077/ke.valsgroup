import mongoose from "mongoose";

const baseOptions = { timestamps: true };

const OrganizationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, unique: true, index: true },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
  },
  baseOptions
);

const CompanySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, unique: true, index: true },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
  },
  baseOptions
);

const BranchSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, unique: true, index: true },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    location: { type: String, default: "", trim: true },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
  },
  baseOptions
);

const VehicleGroupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, unique: true, index: true },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
      index: true,
    },
    description: { type: String, default: "", trim: true },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
  },
  baseOptions
);

const MasterVehicleSchema = new mongoose.Schema(
  {
    vehicleNo: { type: String, required: true, trim: true, unique: true, index: true },
    imei: { type: String, trim: true, unique: true, sparse: true, default: null },
    vehicleType: { type: String, required: true, trim: true },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
      index: true,
    },
    vehicleGroupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "VehicleGroup",
      required: true,
      index: true,
    },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
  },
  baseOptions
);

export const Organization =
  mongoose.models.Organization || mongoose.model("Organization", OrganizationSchema);
export const Company = mongoose.models.Company || mongoose.model("Company", CompanySchema);
export const Branch = mongoose.models.Branch || mongoose.model("Branch", BranchSchema);
export const VehicleGroup =
  mongoose.models.VehicleGroup || mongoose.model("VehicleGroup", VehicleGroupSchema);
export const MasterVehicle =
  mongoose.models.MasterVehicle || mongoose.model("MasterVehicle", MasterVehicleSchema);
