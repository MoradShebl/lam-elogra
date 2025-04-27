import { useState, useEffect, Suspense } from "react";
import React from "react";

// ErrorBoundary component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch() {
    // You can log error info here if needed
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="error-message" style={{margin: '30px 0', padding: '20px', borderRadius: '8px', background: '#fff0f0', color: '#b71c1c', textAlign: 'center'}}>
          <h3>حدث خطأ غير متوقع</h3>
          <p>{this.state.error?.message || "يرجى إعادة المحاولة لاحقًا."}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

const getArrivalTime = (minutes) => {
  const now = new Date();
  now.setMinutes(now.getMinutes() + minutes);
  return now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
};

const RECENT_KEY = 'recentDestinations';

const DEFAULT_EMPTY_MESSAGE = "لم يتم العثور على خيارات نقل متاحة لهذه الوجهة.<br/>جرب وجهة أخرى أو تحقق من اتصالك بالإنترنت.";

const RouteRecommendation = ({ emptyMessage = DEFAULT_EMPTY_MESSAGE }) => {
  const [userLocation, setUserLocation] = useState(null);
  const [destination, setDestination] = useState("");
  const [destinationCoords, setDestinationCoords] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [routeOptions, setRouteOptions] = useState([]);
  const [stations, setStations] = useState([]);
  const [showMap, setShowMap] = useState(false);
  const [recentDestinations, setRecentDestinations] = useState([]);
  const [selectedOption, setSelectedOption] = useState(null);

  // Load cached location on mount
  useEffect(() => {
    const cachedLocation = localStorage.getItem('userLocation');
    
    if (cachedLocation) {
      setUserLocation(JSON.parse(cachedLocation));
    }
  }, []);

  useEffect(() => {
    const cached = localStorage.getItem(RECENT_KEY);
    if (cached) setRecentDestinations(JSON.parse(cached));
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
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(destination)}`
      );
      if (!response.ok) throw new Error("فشل البحث عن الوجهة");
      const data = await response.json();
      if (data && data.length > 0) {
        const location = data[0];
        setDestinationCoords({
          latitude: parseFloat(location.lat),
          longitude: parseFloat(location.lon),
          displayName: location.display_name
        });
        // Save to recent
        let updated = [destination, ...recentDestinations.filter(d => d !== destination)];
        if (updated.length > 5) updated = updated.slice(0, 5);
        setRecentDestinations(updated);
        localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
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
        if (!res.ok) throw new Error("فشل جلب محطات النقل ");
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

  const handleRecentClick = (dest) => {
    setDestination(dest);
    setTimeout(() => searchDestination(), 0);
  };

  const handleClear = () => {
    setDestination("");
    setDestinationCoords(null);
    setRouteOptions([]);
    setStations([]);
    setShowMap(false);
    setError(null);
    setSelectedOption(null);
  };

  // Retry handler for empty state
  const handleRetry = () => {
    if (destination) searchDestination();
  };

  return (
    <ErrorBoundary>
      <Suspense fallback={<div className="loading"><div className="spinner"></div><p>جاري التحميل...</p></div>}>
        <div className="route-recommendation-container-polished">
          <h2 style={{marginBottom: 24, fontSize: 22, color: 'var(--second)', borderBottom: '2px solid var(--third)', paddingBottom: 8}}>مخطط الرحلة</h2>
          {recentDestinations.length > 0 && (
            <div className="recent-destinations-list">
              {recentDestinations.map((dest, i) => (
                <span className="recent-destination-pill" key={i} onClick={() => handleRecentClick(dest)}>{dest}</span>
              ))}
            </div>
          )}
          <form onSubmit={handleSubmit} className="destination-form" style={{marginBottom: 24}}>
            <div className="input-group" style={{marginBottom: 18}}>
              <input
                type="text"
                className="card-input"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="أدخل الوجهة"
                required
                style={{fontSize: 16, padding: '10px 12px', borderRadius: 7, border: '1px solid var(--second)'}}
              />
            </div>
            <button type="submit" className="btn route-btn" disabled={loading} style={{marginTop: 0, width: '100%', fontWeight: 600, fontSize: 16}}>
              {!userLocation ? "تحديد الموقع والبحث" : "بحث عن طرق النقل"}
            </button>
            <button type="button" className="clear-btn-polished" onClick={handleClear}>مسح الكل</button>
          </form>
          {loading && (
            <div className="loading" style={{margin: '30px 0'}}>
              <div className="spinner"></div>
              <p>جاري البحث عن أفضل الطرق...</p>
            </div>
          )}
          {error && (
            <div className="error-message" style={{margin: '30px 0', padding: '20px', borderRadius: '8px', background: '#fff0f0', color: '#b71c1c', textAlign: 'center'}}>
              <p>{error}</p>
            </div>
          )}
          {destinationCoords && (
            <div className="destination-info" style={{marginBottom: 18}}>
              <h3 style={{fontSize: 16, margin: 0, color: 'var(--second)'}}>الوجهة</h3>
              <p style={{fontSize: 14, margin: 0}}>{destinationCoords.displayName}</p>
            </div>
          )}
          {/* Show friendly message if no options found */}
          {destinationCoords && !loading && !error && routeOptions && routeOptions.length === 0 && (
            <div className="empty-state" style={{margin: '30px 0', padding: '24px', borderRadius: '10px', background: '#f8f8fa', color: '#888', textAlign: 'center', boxShadow: '0 2px 8px var(--shadow)'}}>
              <div className="empty-state-text" style={{fontSize: 16, marginBottom: 16}} dangerouslySetInnerHTML={{__html: emptyMessage}} />
              <button className="btn route-btn" style={{marginTop: 10, fontWeight: 600, fontSize: 15, background: 'var(--info)', color: '#fff', borderRadius: 8}} onClick={handleRetry} aria-label="إعادة المحاولة">
                إعادة المحاولة
              </button>
            </div>
          )}
          {showMap && stations[0] && stations[1] && (
            <div className="map-container" style={{marginBottom: 18}}>
              <iframe
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${Math.min(stations[0].longitude, stations[1].longitude) - 0.01},${Math.min(stations[0].latitude, stations[1].latitude) - 0.01},${Math.max(stations[0].longitude, stations[1].longitude) + 0.01},${Math.max(stations[0].latitude, stations[1].latitude) + 0.01}&layer=mapnik&marker=${stations[0].latitude},${stations[0].longitude}`}
                width="100%"
                height="200"
                frameBorder="0"
                title="Route Map"
                loading="lazy"
                style={{borderRadius: 8, border: '1px solid var(--third)'}}
              ></iframe>
            </div>
          )}
          {routeOptions && routeOptions.length > 0 && (
            <div className="route-options enhanced-options" style={{marginTop: 10}}>
              <h3 style={{fontSize: 18, marginBottom: 18, color: 'var(--second)'}}>خيارات النقل المتاحة</h3>
              <div className="options-list" style={{display: 'flex', flexDirection: 'column', gap: 18}}>
                {routeOptions.map((option, index) => (
                  <div
                    className={`route-option-card-polished${selectedOption === index ? ' selected' : ''}`}
                    key={index}
                    onClick={() => setSelectedOption(index)}
                    tabIndex={0}
                    style={{outline: selectedOption === index ? '2px solid var(--info)' : 'none', cursor: 'pointer'}}
                  >
                    <div className="option-details" style={{textAlign: 'right'}}>
                      <div className="option-name" style={{fontWeight: 700, fontSize: 16, marginBottom: 4}}>{option.name}</div>
                      <div className="option-metrics" style={{display: 'flex', flexDirection: 'row', gap: 18, fontSize: 14, marginBottom: 6}}>
                        <span>الوقت المتوقع: {option.time} دقيقة</span>
                        <span>التكلفة التقريبية: {option.cost} جنيه</span>
                      </div>
                      <div className="arrival-time-label">وقت الوصول المتوقع: {getArrivalTime(option.time)}</div>
                      <div className="gov-label" style={{fontSize: 13, color: 'var(--info)', fontWeight: 500}}>{option.label}</div>
                    </div>
                    <button
                      className="select-option-btn-polished"
                      style={{width: '100%', marginTop: 8, fontWeight: 600, fontSize: 15}}
                      onClick={() => { setSelectedOption(index); navigateWithOption(option); }}
                    >
                      اختيار
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Suspense>
    </ErrorBoundary>
  );
};

export default RouteRecommendation;