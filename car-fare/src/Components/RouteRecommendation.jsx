import { useState, useEffect } from "react";

const RouteRecommendation = () => {
  const [userLocation, setUserLocation] = useState(null);
  const [destination, setDestination] = useState("");
  const [destinationCoords, setDestinationCoords] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [routeOptions, setRouteOptions] = useState([]);
  const [stations, setStations] = useState([]);
  const [showMap, setShowMap] = useState(false);

  // Load cached location on mount
  useEffect(() => {
    const cachedLocation = localStorage.getItem('userLocation');
    
    if (cachedLocation) {
      setUserLocation(JSON.parse(cachedLocation));
    }
  }, []);

  // Get user's current location
  const getUserLocation = () => {
    setLoading(true);
    setError(null);
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const newLocation = { latitude, longitude };
        setUserLocation(newLocation);
        localStorage.setItem('userLocation', JSON.stringify(newLocation));
        setLoading(false);
      },
      (err) => {
        console.error("Error getting location:", err);
        setError("تعذر الحصول على موقعك. يرجى التحقق من إعدادات الموقع الخاصة بك.");
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  // Search for destination and get coordinates
  const searchDestination = async () => {
    if (!destination.trim()) {
      setError("الرجاء إدخال وجهة");
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      // Using Nominatim API (OpenStreetMap's geocoding service)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(destination)}`
      );
      
      if (!response.ok) {
        throw new Error("فشل البحث عن الوجهة");
      }
      
      const data = await response.json();
      
      if (data && data.length > 0) {
        const location = data[0];
        setDestinationCoords({
          latitude: parseFloat(location.lat),
          longitude: parseFloat(location.lon),
          displayName: location.display_name
        });
        
        // Get route options if we have both user location and destination
        if (userLocation) {
          fetchRouteOptions(userLocation, {
            latitude: parseFloat(location.lat),
            longitude: parseFloat(location.lon)
          });
        }
      } else {
        setError("لم يتم العثور على الوجهة. يرجى المحاولة بطريقة أخرى.");
      }
    } catch (err) {
      console.error("Error searching destination:", err);
      setError(err.message || "حدث خطأ أثناء البحث عن الوجهة");
    } finally {
      setLoading(false);
    }
  };

  // Fetch route options using OpenRouteService API
  const fetchRouteOptions = async (start, end) => {
    setLoading(true);
    setError(null);
    try {
      // Overpass API for public transport platforms near start and end
      const overpass = async (lat, lon, type) => {
        let filter = '[public_transport=platform]';
        if (type === 'train') filter = '[railway=station]';
        if (type === 'microbus') filter = '[minibus=yes]';
        const url = `https://overpass-api.de/api/interpreter?data=[out:json];node(around:1500,${lat},${lon})${filter};out;`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("فشل جلب محطات النقل الحكومية");
        const data = await res.json();
        return (data.elements || []).map(e => ({
          id: e.id,
          name: e.tags.name || (type === 'train' ? "محطة قطار" : type === 'microbus' ? "محطة ميكروباص" : "محطة حكومية"),
          latitude: e.lat,
          longitude: e.lon,
          type
        }));
      };
      // Fetch all types
      const [busStart, busEnd, trainStart, trainEnd, microbusStart, microbusEnd] = await Promise.all([
        overpass(start.latitude, start.longitude, 'bus'),
        overpass(end.latitude, end.longitude, 'bus'),
        overpass(start.latitude, start.longitude, 'train'),
        overpass(end.latitude, end.longitude, 'train'),
        overpass(start.latitude, start.longitude, 'microbus'),
        overpass(end.latitude, end.longitude, 'microbus'),
      ]);
      // Helper to find best pair
      const findBestPair = (startArr, endArr, type, icon, label) => {
        let bestPair = null;
        let minDist = Infinity;
        for (const s of startArr) {
          for (const e of endArr) {
            const d = calculateDistance(s.latitude, s.longitude, e.latitude, e.longitude);
            if (d < minDist) {
              minDist = d;
              bestPair = { from: s, to: e, distance: d, type, icon, label };
            }
          }
        }
        return bestPair;
      };
      const busPair = findBestPair(busStart, busEnd, 'bus', '🚌', 'حافلة');
      const trainPair = findBestPair(trainStart, trainEnd, 'train', '🚆', 'قطار');
      const microbusPair = findBestPair(microbusStart, microbusEnd, 'microbus', '🚐', 'ميكروباص');
      // Build options
      const options = [];
      if (busPair) {
        options.push({
          mode: 'bus',
          icon: busPair.icon,
          name: `من ${busPair.from.name} إلى ${busPair.to.name}`,
          time: Math.round(busPair.distance * 3 + 10),
          cost: 3 + Math.round(busPair.distance * 0.5),
          from: busPair.from,
          to: busPair.to,
          distance: busPair.distance,
          label: busPair.label
        });
      }
      if (trainPair) {
        options.push({
          mode: 'train',
          icon: trainPair.icon,
          name: `من ${trainPair.from.name} إلى ${trainPair.to.name}`,
          time: Math.round(trainPair.distance * 1.2 + 20),
          cost: 5 + Math.round(trainPair.distance * 0.3),
          from: trainPair.from,
          to: trainPair.to,
          distance: trainPair.distance,
          label: trainPair.label
        });
      }
      if (microbusPair) {
        options.push({
          mode: 'microbus',
          icon: microbusPair.icon,
          name: `من ${microbusPair.from.name} إلى ${microbusPair.to.name}`,
          time: Math.round(microbusPair.distance * 2 + 8),
          cost: 2 + Math.round(microbusPair.distance * 0.4),
          from: microbusPair.from,
          to: microbusPair.to,
          distance: microbusPair.distance,
          label: microbusPair.label
        });
      }
      setRouteOptions(options);
      setStations([busPair?.from, busPair?.to]); // For map, prefer bus
      setShowMap(true);
    } catch {
      setError("تعذر الحصول على خيارات النقل الحكومية. جرب مرة أخرى لاحقًا.");
    } finally {
      setLoading(false);
    }
  };

  // Calculate distance between two points
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

  const deg2rad = (deg) => {
    return deg * (Math.PI / 180);
  };

  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!userLocation) {
      getUserLocation();
      return;
    }
    
    searchDestination();
  };

  // Navigate using the recommended option
  const navigateWithOption = (option) => {
    if (!userLocation || !destinationCoords) return;
    let url;
    if ((option.mode === "bus" || option.mode === "train" || option.mode === "microbus") && option.from && option.to) {
      url = `https://www.google.com/maps/dir/?api=1&origin=${option.from.latitude},${option.from.longitude}&destination=${option.to.latitude},${option.to.longitude}&travelmode=transit`;
    }
    if (url) window.open(url, "_blank");
  };

  return (
    <div className="route-recommendation-container enhanced-ui">
      <h2>مخطط الرحلة الذكي</h2>
      
      <form onSubmit={handleSubmit} className="destination-form">
        <div className="input-group">
          <input
            type="text"
            className="card-input"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="أدخل الوجهة"
            required
          />
        </div>
        
        <button 
          type="submit" 
          className="btn route-btn"
          disabled={loading}
        >
          {!userLocation ? "تحديد الموقع والبحث" : "بحث عن طرق حكومية وذكية"}
        </button>
      </form>
      
      {loading && (
        <div className="loading">
          <div className="spinner"></div>
          <p>جاري البحث عن أفضل الطرق...</p>
        </div>
      )}
      
      {error && (
        <div className="error-message">
          <p>{error}</p>
        </div>
      )}
      
      {destinationCoords && (
        <div className="destination-info">
          <h3>الوجهة</h3>
          <p>{destinationCoords.displayName}</p>
        </div>
      )}
      
      {showMap && stations[0] && stations[1] && (
        <div className="map-container">
          <iframe
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${Math.min(stations[0].longitude, stations[1].longitude) - 0.01},${Math.min(stations[0].latitude, stations[1].latitude) - 0.01},${Math.max(stations[0].longitude, stations[1].longitude) + 0.01},${Math.max(stations[0].latitude, stations[1].latitude) + 0.01}&layer=mapnik&marker=${stations[0].latitude},${stations[0].longitude}`}
            width="100%"
            height="200"
            frameBorder="0"
            title="Route Map"
            loading="lazy"
          ></iframe>
        </div>
      )}
      
      {routeOptions && routeOptions.length > 0 && (
        <div className="route-options enhanced-options">
          <h3>خيارات النقل الحكومي المتاحة</h3>
          <div className="options-list">
            {routeOptions.map((option, index) => (
              <div className={`route-option-card modern-card gov-card`} key={index}>
                <div className="option-icon">{option.icon}</div>
                <div className="option-details">
                  <div className="option-name">{option.name}</div>
                  <div className="option-metrics">
                    <span>⏱️ {option.time} دقيقة</span>
                    <span>💰 {option.cost} ريال</span>
                  </div>
                  <div className="gov-label">🚏 {option.label}</div>
                </div>
                <button className="btn select-option-btn" onClick={() => navigateWithOption(option)}>
                  اختيار
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default RouteRecommendation;