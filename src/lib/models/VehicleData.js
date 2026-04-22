// models/VehicleData.js
import mongoose from 'mongoose';

// --- Core Vehicle Schema: Fast, essential real-time data only ---
const VehicleSchema = new mongoose.Schema({
  // --- Core Identifiers ---
  imei_id: { type: String, required: true, unique: true, index: true },
  user_id: { type: String, required: true, index: true },

  // --- Vehicle Metadata ---
  vehicle_no: { type: String, index: true },
  vehicle_type: String,
  company: { type: String, index: true },

  // --- Timestamps ---
  server_date: { type: Date, required: true, index: true },
  device_date: { type: Date, required: true },

  // --- Location & Movement ---
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  altitude: Number,
  speed: Number,
  odometer: Number, // Corrected spelling
  angle_name: String,

  // --- Detailed Location Info ---
  location_name: String,
  road: String,
  district_name: String,
  city_name: String,
  state_name: String,
  country_name: String,
  poi: String,

  // --- Device & Vehicle Status ---
  // Suggested: Use Boolean for Y/N fields for better querying
  user_status: String,      // Keeping as String if it can be other than Y/N
  ignition_state: Boolean,  // e.g., true for "Y", false for "N"
  battery_power: Boolean,   // e.g., true for "Y", false for "N"
  movement_status: String,
  sleep_mode: String,
  sleep_mode_desc: String,
  valid: mongoose.Schema.Types.Mixed,

  // --- Power & Signal ---
  battery_level: Number,
  battery_voltage: Number,
  external_voltage: Number,
  satellites: Number,
  gnss_state: String,
  gnss_status: String,
  gsm_signal_level: Number,

  // --- Weather & Fuel ---
  weather: String,
  weather_icon: String,
  temp_c: Number,
  temp_f: Number,
  feelslike_c: Number,
  feelslike_f: Number,
  humidity: Number,
  high_petrol: Number,
  stan_petrol: Number,
  high_diesel: Number,
  stan_diesel: Number,
  kerosene: Number,
  jet_propellant: Number,

  // --- Raw/Custom Data ---
  ios_data: String,
}, {
  // Mongoose-managed timestamps are a good practice
  timestamps: true // This will add `createdAt` and `updatedAt` fields automatically
});

export const Vehicle = mongoose.models.Vehicle || mongoose.model('Vehicle', VehicleSchema);

// Schema for historical path points
const VehiclePathPointSchema = new mongoose.Schema({
    // --- CRITICAL FIX: 'unique: true' has been removed ---
    // We need to store MANY path points for the SAME imei_id.
    imei_id: { type: String, required: true, index: true },

    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    speed: Number,
    timestamp: { type: Date, required: true }
});

// Optional: Add a TTL (Time To Live) index to automatically delete old path points
// This example keeps data for 90 days.
VehiclePathPointSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export const VehiclePathPoint = mongoose.models.VehiclePathPoint || mongoose.model('VehiclePathPoint', VehiclePathPointSchema);
