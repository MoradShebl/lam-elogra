import { useState, useEffect, useCallback, useRef } from "react";

const STATION_QUERIES = [
  '[public_transport=platform]',
  '[railway=station]',
  '[bus=yes]',
  '[subway=yes]',
  '[tram=yes]',
  '[station=yes]'
];
const RADIUS_STEPS = [1000, 2000, 5000];

const getStationType = (tags) => {
  if (tags.subway === 'yes') return 'مترو';
  if (tags.tram === 'yes') return 'ترام';
  if (tags.railway === 'station') return 'قطار';
  if (tags.bus === 'yes') return 'حافلة';
  if (tags.public_transport === 'platform') return 'منصة نقل';
  if (tags.station === 'yes') return 'محطة';
  return 'محطة';
};

const formatDistance = (km) => {
  if (km < 1) return `${Math.round(km * 1000)} متر`;
  return `${km.toFixed(2)} كم`;
};

const NearbyStation = () => {
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [stations, setStations] = useState([]);
  const [searchRadius, setSearchRadius] = useState(RADIUS_STEPS[0]);
  const [map, setMap] = useState(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState(null);
  const mapInitAttempts = useRef(0);
  const maxMapInitAttempts = 3;

  // Define getMarkerIconByType first as it's used by addStationMarkers
  const getMarkerIconByType = (type) => {
    switch (type) {
      case 'مترو':
        return 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png';
      case 'ترام':
        return 'https://maps.google.com/mapfiles/ms/icons/yellow-dot.png';
      case 'قطار':
        return 'https://maps.google.com/mapfiles/ms/icons/purple-dot.png';
      case 'حافلة':
        return 'https://maps.google.com/mapfiles/ms/icons/red-dot.png';
      default:
        return 'https://maps.google.com/mapfiles/ms/icons/orange-dot.png';
    }
  };

  // Calculate distance between two coordinates in kilometers
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
  };

  const deg2rad = (deg) => deg * (Math.PI / 180);

  // Navigation options with improved Google Maps integration
  const navigateToStation = useCallback((station) => {
    if (station && location) {
      // Use Google Maps with appropriate parameters
      const url = `https://www.google.com/maps/dir/?api=1&origin=${location.latitude},${location.longitude}&destination=${station.latitude},${station.longitude}&travelmode=walking&dir_action=navigate`;
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }, [location]);

  // Define addStationMarkers BEFORE the useEffect hooks that use it
  const addStationMarkers = useCallback((mapInstance) => {
    if (!mapInstance || !window.google) return;
    
    try {
      // Remove any existing markers (except user location)
      if (window.stationMarkers) {
        window.stationMarkers.forEach(marker => {
          try {
            marker.setMap(null);
          } catch (err) {
            console.error("Error removing marker:", err);
          }
        });
      }
      
      window.stationMarkers = [];
      
      // Add markers for each station
      const bounds = new window.google.maps.LatLngBounds();
      
      // Add user position to bounds
      if (location) {
        try {
          bounds.extend({ lat: location.latitude, lng: location.longitude });
        } catch (err) {
          console.error("Error adding user location to bounds:", err);
        }
      }
      
      let anyMarkerAdded = false;
      
      stations.forEach((station, index) => {
        try {
          if (!station.latitude || !station.longitude) {
            console.warn(`Station ${index} has invalid coordinates:`, station);
            return; // Skip this station
          }
          
          const marker = new window.google.maps.Marker({
            position: { lat: station.latitude, lng: station.longitude },
            map: mapInstance,
            title: station.name || 'محطة',
            icon: {
              url: getMarkerIconByType(station.type),
            },
          });
          
          const infowindow = new window.google.maps.InfoWindow({
            content: `
              <div style="direction: rtl; text-align: right; padding: 8px;">
                <strong>${station.name || 'محطة بدون اسم'}</strong><br>
                <span style="color: #0066cc;">${station.type}</span><br>
                <span>المسافة: ${formatDistance(station.distance)}</span><br>
                <button id="directions-btn-${station.id}" style="margin-top: 8px; padding: 4px 8px; background: #4285F4; color: white; border: none; border-radius: 4px; cursor: pointer;">الاتجاهات</button>
              </div>
            `,
          });
          
          marker.addListener("click", () => {
            try {
              infowindow.open({
                anchor: marker,
                map: mapInstance,
              });
              
              // Add event listener to direction button after info window is opened
              setTimeout(() => {
                const directionBtn = document.getElementById(`directions-btn-${station.id}`);
                if (directionBtn) {
                  directionBtn.addEventListener("click", () => {
                    navigateToStation(station);
                  });
                }
              }, 100);
            } catch (err) {
              console.error("Error opening info window:", err);
            }
          });
          
          window.stationMarkers.push(marker);
          bounds.extend({ lat: station.latitude, lng: station.longitude });
          anyMarkerAdded = true;
        } catch (err) {
          console.error(`Error creating marker for station ${index}:`, err, station);
        }
      });
      
      // Adjust map to fit all markers
      if (anyMarkerAdded) {
        try {
          mapInstance.fitBounds(bounds);
          
          // Add a slight zoom out to give context
          const listener = mapInstance.addListener('bounds_changed', () => {
            window.google.maps.event.removeListener(listener);
            if (mapInstance.getZoom() > 16) {
              mapInstance.setZoom(16);
            }
          });
        } catch (err) {
          console.error("Error fitting bounds:", err);
        }
      }
    } catch (err) {
      console.error("Error in addStationMarkers:", err);
    }
  }, [location, stations, navigateToStation]);

  // Load Google Maps script
  useEffect(() => {
    if (window.google && window.google.maps) {
      setMapLoaded(true);
      setMapError(null);
      return;
    }

    const loadGoogleMaps = () => {
      try {
        const googleMapsScript = document.createElement('script');
        googleMapsScript.src = `https://maps.googleapis.com/maps/api/js?libraries=places`;
        googleMapsScript.async = true;
        googleMapsScript.defer = true;
        
        googleMapsScript.onload = () => {
          console.log("Google Maps API loaded successfully");
          setMapLoaded(true);
          setMapError(null);
          mapInitAttempts.current = 0;
        };
        
        googleMapsScript.onerror = (err) => {
          console.error("Failed to load Google Maps API:", err);
          mapInitAttempts.current += 1;
          
          if (mapInitAttempts.current < maxMapInitAttempts) {
            // Retry loading after a delay
            setTimeout(() => {
              console.log(`Retrying Google Maps load (attempt ${mapInitAttempts.current + 1}/${maxMapInitAttempts})`);
              if (document.head.contains(googleMapsScript)) {
                document.head.removeChild(googleMapsScript);
              }
              loadGoogleMaps();
            }, 2000);
          } else {
            setMapError("فشل في تحميل خريطة جوجل. يرجى التحقق من اتصالك بالإنترنت وإعادة المحاولة.");
            setMapLoaded(false);
          }
        };
        
        document.head.appendChild(googleMapsScript);
        
        return googleMapsScript;
      } catch (err) {
        console.error("Error setting up Google Maps:", err);
        setMapError("حدث خطأ أثناء تحميل الخريطة");
        setMapLoaded(false);
        return null;
      }
    };

    const script = loadGoogleMaps();

    return () => {
      // Clean up script if component unmounts before script loads
      if (script && document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, []);

  // Initialize map when script loads and location is available
  useEffect(() => {
    if (!mapLoaded || !location) return;
    
    try {
      const mapOptions = {
        center: { lat: location.latitude, lng: location.longitude },
        zoom: 15,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
      };

      const newMap = new window.google.maps.Map(
        document.getElementById('google-map'),
        mapOptions
      );

      // Add user marker
      try {
        new window.google.maps.Marker({
          position: { lat: location.latitude, lng: location.longitude },
          map: newMap,
          title: 'موقعك الحالي',
          icon: {
            url: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png',
          },
        });
      } catch (markerErr) {
        console.error("Error creating user marker:", markerErr);
        // Continue even if marker creation fails
      }

      setMap(newMap);
      setMapError(null);

      // Add station markers when map is ready
      if (stations.length > 0) {
        addStationMarkers(newMap);
      }
    } catch (err) {
      console.error("Error initializing map:", err);
      setMapError("فشل في تهيئة الخريطة. يرجى إعادة تحميل الصفحة.");
    }
  }, [mapLoaded, location, stations, addStationMarkers]);

  // Add markers when stations are updated
  useEffect(() => {
    if (!map || !stations.length) return;
    
    try {
      addStationMarkers(map);
    } catch (err) {
      console.error("Error adding station markers:", err);
      // Don't set a visible error, just log it
    }
  }, [stations, map, addStationMarkers]);

  // Load cached data on component mount
  useEffect(() => {
    const getCachedData = () => {
      try {
        const cachedLocation = localStorage.getItem('userLocation');
        const cachedStations = localStorage.getItem('nearbyStations');
        const cachedTimestamp = localStorage.getItem('lastSearchTimestamp');
        
        if (cachedLocation && cachedStations && cachedTimestamp) {
          const now = new Date().getTime();
          const timestamp = parseInt(cachedTimestamp, 10);
          
          // Check if cache is less than 1 hour old
          if (!isNaN(timestamp) && now - timestamp < 3600000) {
            const parsedLocation = JSON.parse(cachedLocation);
            const parsedStations = JSON.parse(cachedStations);
            
            setLocation(parsedLocation);
            setStations(parsedStations);
          }
        }
      } catch (err) {
        console.error("Error loading cached data:", err);
        // Clear potentially corrupted cache
        localStorage.removeItem('userLocation');
        localStorage.removeItem('nearbyStations');
        localStorage.removeItem('lastSearchTimestamp');
      }
    };
    
    getCachedData();
  }, []);

  const findNearbyStations = async (radiusIndex = 0) => {
    setLoading(true);
    setError(null);
    setStations([]);
    
    try {
      // Get current position
      let position;
      
      if (!navigator.geolocation) {
        throw new Error("متصفحك لا يدعم تحديد الموقع. يرجى استخدام متصفح حديث.");
      }
      
      position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve, 
          (err) => {
            console.error("Geolocation error:", err);
            let errorMessage = "فشل في تحديد موقعك. ";
            
            switch (err.code) {
              case err.PERMISSION_DENIED:
                errorMessage += "يرجى السماح للموقع بالوصول إلى خدمات الموقع في إعدادات المتصفح.";
                break;
              case err.POSITION_UNAVAILABLE:
                errorMessage += "معلومات الموقع غير متاحة.";
                break;
              case err.TIMEOUT:
                errorMessage += "انتهت مهلة طلب الموقع.";
                break;
              default:
                errorMessage += "يرجى التأكد من تفعيل خدمات الموقع.";
            }
            
            reject(new Error(errorMessage));
          }, 
          {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0
          }
        );
      });
      
      const { latitude, longitude } = position.coords;
      const newLocation = { latitude, longitude };
      setLocation(newLocation);
      
      // Save location to cache
      try {
        localStorage.setItem('userLocation', JSON.stringify(newLocation));
      } catch (err) {
        console.error("Error saving location to localStorage:", err);
        // Non-critical error, continue
      }
      
      let allStations = [];
      let apiFailures = 0;
      let fetchSuccess = false;
      const totalQueries = STATION_QUERIES.length;
      
      // Search for stations with each query
      for (const query of STATION_QUERIES) {
        try {
          const radius = RADIUS_STEPS[radiusIndex];
          const url = `https://overpass-api.de/api/interpreter?data=[out:json];node(around:${radius},${latitude},${longitude})${query};out;`;
          
          const response = await fetch(url, { 
            timeout: 15000,
            headers: {
              'Accept': 'application/json'
            }
          });
          
          if (!response.ok) {
            apiFailures++;
            console.warn(`Failed to fetch with query ${query}: ${response.status} ${response.statusText}`);
            continue;
          }
          
          let data;
          try {
            data = await response.json();
          } catch (err) {
            console.error(`Error parsing JSON for query ${query}:`, err);
            apiFailures++;
            continue;
          }
          
          if (data && data.elements && data.elements.length > 0) {
            const newStations = data.elements
              .filter(element => element && element.lat && element.lon) // Ensure coordinates exist
              .map(element => {
                try {
                  return {
                    id: element.id,
                    name: element.tags?.name || element.tags?.['name:ar'] || 'محطة بدون اسم',
                    latitude: element.lat,
                    longitude: element.lon,
                    distance: calculateDistance(latitude, longitude, element.lat, element.lon),
                    type: getStationType(element.tags || {}),
                    tags: element.tags || {} // Store all tags for reference
                  };
                } catch (err) {
                  console.error("Error processing station element:", err, element);
                  return null; // Skip this element
                }
              })
              .filter(s => s !== null); // Remove any failed conversions
            
            allStations = allStations.concat(newStations);
            fetchSuccess = true;
          }
        } catch (err) {
          console.error(`Error fetching stations with query ${query}:`, err);
          apiFailures++;
        }
      }
      
      // If all queries failed, throw an error
      if (!fetchSuccess) {
        if (apiFailures === totalQueries) {
          throw new Error("فشل في الاتصال بخدمة البحث عن المحطات. يرجى التحقق من اتصالك بالإنترنت وإعادة المحاولة.");
        } else {
          throw new Error("لم يتم العثور على محطات قريبة في هذا النطاق.");
        }
      }
      
      // Remove duplicates by id
      const uniqueStations = Object.values(allStations.reduce((acc, s) => {
        // Keep the station with more information (preferring ones with names)
        if (!acc[s.id] || (!acc[s.id].name && s.name)) {
          acc[s.id] = s;
        }
        return acc;
      }, {}));
      
      // Sort by distance
      uniqueStations.sort((a, b) => a.distance - b.distance);
      
      // If no stations found, try with larger radius
      if (uniqueStations.length === 0 && radiusIndex < RADIUS_STEPS.length - 1) {
        setSearchRadius(RADIUS_STEPS[radiusIndex + 1]);
        return findNearbyStations(radiusIndex + 1);
      }
      
      // If still no stations found, show error
      if (uniqueStations.length === 0) {
        setError('لم يتم العثور على محطات قريبة. جرب موقعاً آخر أو تحقق من اتصالك بالإنترنت.');
        setStations([]);
        setLoading(false);
        return;
      }
      
      // Limit to top 10 stations for map display
      const topStations = uniqueStations.slice(0, 10);
      setStations(topStations);
      
      // Update cache
      try {
        const now = new Date().getTime();
        localStorage.setItem('nearbyStations', JSON.stringify(topStations));
        localStorage.setItem('lastSearchTimestamp', now.toString());
      } catch (err) {
        console.error("Error saving to localStorage:", err);
        // Non-critical error, continue
      }
      
    } catch (err) {
      console.error("Error finding nearby stations:", err);
      setError(err.message || 'حدث خطأ أثناء البحث عن المحطات القريبة.');
    } finally {
      setLoading(false);
    }
  };

  // Function to retry on map loading error
  const retryMapLoading = () => {
    setMapError(null);
    mapInitAttempts.current = 0;
    
    // Remove any existing script element
    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existingScript) {
      document.head.removeChild(existingScript);
    }
    
    // Force reload
    setMapLoaded(false);
  };

  return (
    <div className="station-container">
      <h2>المحطات القريبة</h2>
      
      {!loading && (
        <button
          className="btn station-btn"
          onClick={() => findNearbyStations()}
          style={{marginBottom: 16}}
          disabled={loading}
        >
          {stations.length ? 'تحديث الموقع والمحطات' : 'البحث عن المحطات القريبة'}
        </button>
      )}
      
      {loading && (
        <div className="loading">
          <div className="spinner"></div>
          <p>جاري البحث...</p>
        </div>
      )}
      
      {error && (
        <div className="error-message" style={{margin: '20px 0', padding: '16px', borderRadius: '8px', background: '#fff0f0', color: '#b71c1c', textAlign: 'center'}}>
          <p>{error}</p>
          <button className="btn station-btn" onClick={() => findNearbyStations()} style={{marginTop: 10}}>إعادة المحاولة</button>
        </div>
      )}
      
      {/* Google Maps container */}
      <div 
        id="google-map" 
        style={{
          width: '100%', 
          height: '400px', 
          borderRadius: '8px',
          border: '1px solid var(--third)',
          marginTop: loading || error ? 16 : 0,
          position: 'relative'
        }}
      >
        {!mapLoaded && !loading && !error && !mapError && (
          <div style={{display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', backgroundColor: '#f5f5f5'}}>
            <p>جاري تحميل الخريطة...</p>
          </div>
        )}
        
        {mapError && (
          <div style={{
            display: 'flex', 
            flexDirection: 'column',
            justifyContent: 'center', 
            alignItems: 'center', 
            height: '100%', 
            backgroundColor: '#f5f5f5', 
            padding: '20px',
            textAlign: 'center'
          }}>
            <p style={{color: '#b71c1c', marginBottom: '15px'}}>{mapError}</p>
            <button 
              className="btn station-btn"
              onClick={retryMapLoading}
            >
              إعادة تحميل الخريطة
            </button>
          </div>
        )}
      </div>
      
      {stations.length > 0 && !mapError && (
        <div style={{marginTop: 8, fontSize: '0.9rem', textAlign: 'center', color: 'var(--info)'}}>
          تم العثور على {stations.length} محطة قريبة
        </div>
      )}
    </div>
  );
};

export default NearbyStation;