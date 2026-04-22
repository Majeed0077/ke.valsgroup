// src/models/Geofence.js
import mongoose from 'mongoose';

const GeofenceSchema = new mongoose.Schema({
  name: { type: String, required: true },
  company: { type: String, required: true, index: true },
  companyId: { type: String, default: "", index: true },
  ownerUserId: { type: String, required: true, index: true },
  description: String,
  
  // To support both circles and polygons
  type: {
    type: String,
    enum: ['Polygon', 'Rectangle', 'Circle', 'Marker'],
    required: true,
  },

  // For Polygons: store GeoJSON Polygon coordinates
  // GeoJSON format is [longitude, latitude]
  polygon: {
    type: {
      type: String,
      enum: ['Polygon'],
    },
    coordinates: {
      type: [[[Number]]], // Array of linear rings [[ [lng, lat], [lng, lat], ... ]]
    },
  },

  // For Circles: store center and radius
  circle: {
    center: { // Leaflet uses lat/lng, which is fine to store
      lat: Number,
      lng: Number,
    },
    radius: Number, // in meters
  },

  rectangle: {
    bounds: {
      northEast: {
        lat: Number,
        lng: Number,
      },
      southWest: {
        lat: Number,
        lng: Number,
      },
    },
  },

  marker: {
    point: {
      lat: Number,
      lng: Number,
    },
  },

  isActive: { type: Boolean, default: true },
  
}, { timestamps: true });

// Create a 2dsphere index for efficient geospatial queries on polygons
GeofenceSchema.index({ polygon: '2dsphere' });

// In Next.js dev, hot reload can keep an old model cached with stale schema defaults.
if (process.env.NODE_ENV !== "production" && mongoose.models.Geofence) {
  delete mongoose.models.Geofence;
}

export const Geofence = mongoose.models.Geofence || mongoose.model('Geofence', GeofenceSchema);
