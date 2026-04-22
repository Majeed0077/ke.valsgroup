// src/components/InfoPanel.js
'use client';

import React from 'react';
import Image from 'next/image';
import styles from './InfoPanel.module.css'; 
import { getVehicleImageSrc } from '@/lib/vehicleImage';
import {
  FaTimes, FaMapMarkerAlt, FaRoute, FaTachometerAlt, FaInfoCircle,
  FaEye, FaShareAlt, FaPaperPlane, FaMapPin, FaThumbsUp,
  FaRegClock, FaUndoAlt, FaCog, FaCopy, FaCar, FaTruck, FaMotorcycle,
  FaShuttleVan, FaBusAlt, FaQuestionCircle, FaWheelchair, 
  FaAmbulance, FaTrailer, FaWind
} from 'react-icons/fa'; 

const InfoPanel = ({ isVisible, onClose, data }) => {

    if (!isVisible || !data) {
        return null;
    }

    // --- Data Transformation and Fallbacks ---
    // Prepare data for display, ensuring robustness with fallbacks.
    const vehicle_no = data.vehicle_no ?? 'N/A';
    const vehicle_type = data.vehicle_type ?? 'N/A';
    const status = data.sleep_mode_desc ?? data.movement_status ?? 'Inactive';
    const odometer = (data.odo_meter ?? 0).toString().padStart(7, '0');
    
    const driverName = [data.driver_first_name, data.driver_last_name].filter(Boolean).join(' ') || 'N/A';
    const driverMobile = data.driver_mobile ?? 'N/A'; // Assuming 'driver_mobile' might be a field
    
    const coordinates = (data.latitude != null && data.longitude != null) 
      ? `${data.latitude.toFixed(6)}, ${data.longitude.toFixed(6)}` 
      : 'N/A';
    
    const address = data.location_name ?? 'N/A';
    const geofence = data.poi ?? 'N/A';
    const currentSpeed = data.speed ?? 'N/A';

    // --- Helper Functions ---
    const copyToClipboard = (text, type) => {
        if (!text || text === "N/A") return;
        navigator.clipboard.writeText(text).catch(err => console.error(`Failed to copy ${type}: `, err));
    };

    const getStatusClass = (statusText) => {
        const statusKey = statusText?.trim().toLowerCase() || 'inactive';
        return styles[statusKey] || styles.inactive;
    };

    const handleGenericAction = (actionName) => {
        alert(`Action: ${actionName} for ${vehicle_no}`);
    };
    
    const vehicleIcon = () => {
        const typeLower = vehicle_type.toLowerCase();
        if (typeLower.includes('ambulance')) return <FaAmbulance className={styles.vehicleTypeIcon} />;
        if (typeLower.includes('trailer')) return <FaTrailer className={styles.vehicleTypeIcon} />;
        if (typeLower.includes('truck') || typeLower.includes('dumper') || typeLower.includes('mixer') || typeLower.includes('handler')) return <FaTruck className={styles.vehicleTypeIcon} />;
        if (typeLower.includes('car') || typeLower.includes('suv') || typeLower.includes('hatchback')) return <FaCar className={styles.vehicleTypeIcon} />;
        if (typeLower.includes('bike') || typeLower.includes('motorcycle')) return <FaMotorcycle className={styles.vehicleTypeIcon} />;
        if (typeLower.includes('van') || typeLower.includes('tempo')) return <FaShuttleVan className={styles.vehicleTypeIcon} />; 
        if (typeLower.includes('bus')) return <FaBusAlt className={styles.vehicleTypeIcon} />;
        if (typeLower.includes('rickshaw')) return <FaWheelchair className={styles.vehicleTypeIcon} />; 
        if (typeLower.includes('hotairballon')) return <FaWind className={styles.vehicleTypeIcon} />;
        return <FaQuestionCircle className={styles.vehicleTypeIcon} />; 
    };

    return (
        <div className={`${styles.panelContainer} ${isVisible ? styles.visible : ''}`}>
            <div className={styles.panelHeader}>
                <div className={styles.headerLeft}>
                    <button className={styles.headerButton} title="Vehicle Actions" onClick={() => handleGenericAction('Vehicle Actions')}><FaRoute /></button>
                    <button className={styles.headerButton} title="Geofence Info" onClick={() => handleGenericAction('Geofence Info')}><FaMapPin /></button>
                </div>
                <div className={styles.headerRight}>
                    <button className={styles.headerButton} title="Settings" onClick={() => handleGenericAction('Settings')}><FaCog /></button>
                    <button className={styles.headerButtonClose} onClick={onClose} title="Close Panel"><FaTimes /></button>
                </div>
            </div>

            <div className={styles.panelContent}>
                <div className={styles.vehicleInfo}>
                    <div className={styles.vehicleDetails}>
                        <div className={styles.vehicleType}>{vehicleIcon()} {vehicle_type}</div>
                        <div className={styles.plateContainer}>
                            <span className={styles.plateNumber}>{vehicle_no}</span>
                            <span className={`${styles.status} ${getStatusClass(status)}`}>{status}</span>
                        </div>
                        {/* Note: tripDistance is not in the primary data model and would require calculation */}
                        <div className={styles.tripInfo}>Current Trip: <span className={styles.tripValue}>{'N/A'} km</span></div>
                        <div className={styles.odometer}>
                            {odometer.split('').map((digit, index) => (
                                <span key={index} className={styles.odoDigit}>{digit}</span>
                            ))}
                        </div>
                        <div className={styles.driverInfo}>
                            <div>Driver: <span className={styles.driverValue}>{driverName}</span></div>
                            <div>Mobile: <span className={styles.driverValue}>{driverMobile}</span></div>
                        </div>
                         <div className={styles.detailsLink} onClick={() => handleGenericAction('View Full Details')}>
                            Details <FaInfoCircle size={12} style={{marginLeft: '4px'}}/>
                        </div>
                    </div>
                    <div className={styles.vehicleImageContainer}>
                        <Image src={getVehicleImageSrc(vehicle_type)} alt={vehicle_type} width={130} height={80} className={styles.vehicleImage} priority />
                    </div>
                </div>

                <div className={styles.actionButtons}>
                    <button className={styles.actionButton} title="View Details" onClick={() => handleGenericAction('View Details')}><FaEye /></button>
                    <button className={styles.actionButton} title="Share Location" onClick={() => handleGenericAction('Share Location')}><FaShareAlt /></button>
                    <button className={styles.actionButton} title="Send Command" onClick={() => handleGenericAction('Send Command')}><FaPaperPlane /></button>
                    <button className={styles.actionButton} title="View on Map" onClick={() => handleGenericAction('View on Map')}><FaMapMarkerAlt /></button>
                    <button className={styles.actionButton} title="Favorite" onClick={() => handleGenericAction('Favorite')}><FaThumbsUp /></button>
                </div>

                <div className={styles.locationSection}>
                    <div className={styles.locationItem}>
                        <FaMapMarkerAlt className={styles.locationIcon} />
                        <div className={styles.locationText}>
                            <span className={styles.locationLabel}>Coordinates</span>
                            <span className={styles.locationCoords}>{coordinates}</span>
                        </div>
                        <button className={styles.copyButton} onClick={() => copyToClipboard(coordinates, 'Coordinates')} title="Copy Coordinates" disabled={coordinates === 'N/A'}><FaCopy size={12}/></button>
                    </div>
                    <div className={styles.locationItem}>
                        <FaMapPin className={styles.locationIcon} /> 
                        <div className={styles.locationText}>
                            <span className={styles.locationLabel}>Address</span>
                            <span className={styles.locationDescription}>{address}</span>
                        </div>
                        <button className={styles.copyButton} onClick={() => copyToClipboard(address, 'Address')} title="Copy Address" disabled={address === 'N/A'}><FaCopy size={12}/></button>
                    </div>
                     <div className={styles.locationItem}>
                        <FaMapPin className={styles.locationIcon} />
                        <div className={styles.locationText}>
                            <span className={styles.locationLabel}>Geofence / POI</span>
                            <span className={styles.locationCoords}>{geofence}</span>
                        </div>
                         <button className={styles.copyButton} disabled={geofence === "N/A"} onClick={() => copyToClipboard(geofence, 'Geofence')} title="Copy Geofence"><FaCopy size={12}/></button>
                    </div>
                     <div className={styles.locationActions}>
                         <button className={styles.locationActionButton} title="Navigate Here" onClick={() => handleGenericAction('Navigate Here')}><FaRoute /></button>
                         <button className={styles.locationActionButton} title="Set Geofence" onClick={() => handleGenericAction('Set Geofence')}><FaMapPin /></button>
                         <button className={styles.locationActionButton} title="Street View" onClick={() => handleGenericAction('Street View')}><FaEye /></button>
                     </div>
                </div>

                {/* Note: Activity section data requires separate historical analysis/aggregation */}
                <div className={styles.activitySection}>
                    <div className={styles.activityHeader}><FaRegClock className={styles.sectionIcon} /> Today Activity</div>
                    <div className={styles.activityBody}>
                        <div className={styles.activityChart}><div className={styles.chartPlaceholder}>Activity Chart Area</div></div>
                        <div className={styles.activityLegend}>
                            <div className={styles.legendItem}><span className={`${styles.dot} ${styles.running}`}></span> Running <span className={styles.time}>N/A</span></div>
                            <div className={styles.legendItem}><span className={`${styles.dot} ${styles.idle}`}></span> Idle <span className={styles.time}>N/A</span></div>
                            <div className={styles.legendItem}><span className={`${styles.dot} ${styles.stop}`}></span> Stop <span className={styles.time}>N/A</span></div>
                        </div>
                    </div>
                </div>

                 <div className={styles.speedSection}>
                    <div className={styles.activityHeader}><FaTachometerAlt className={styles.sectionIcon} /> Speed</div>
                    <div className={styles.speedDetails}>
                        <div>Current Speed: <span className={styles.speedValue}>{currentSpeed} km/h</span></div>
                        <div>Average Speed: <span className={styles.speedValue}>N/A</span></div>
                        <div>Maximum Speed: <span className={styles.speedValue}>N/A</span></div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InfoPanel;
