import { useState, useEffect } from "react";

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
  const [selectedStation, setSelectedStation] = useState(null);
  const [lastSearchTimestamp, setLastSearchTimestamp] = useState(null);
  const [searchRadius, setSearchRadius] = useState(RADIUS_STEPS[0]);

  useEffect(() => {
    const cachedLocation = localStorage.getItem('userLocation');
    const cachedStations = localStorage.getItem('nearbyStations');
    const cachedTimestamp = localStorage.getItem('lastSearchTimestamp');
    if (cachedLocation && cachedStations && cachedTimestamp) {
      const now = new Date().getTime();
      if (now - parseInt(cachedTimestamp) < 3600000) {
        setLocation(JSON.parse(cachedLocation));
        setStations(JSON.parse(cachedStations));
        setLastSearchTimestamp(cachedTimestamp);
      }
    }
  }, []);

  const findNearbyStations = async (radiusIndex = 0) => {
    setLoading(true);
    setError(null);
    setStations([]);
    setSelectedStation(null);
    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        });
      });
      const { latitude, longitude } = position.coords;
      const newLocation = { latitude, longitude };
      setLocation(newLocation);
      localStorage.setItem('userLocation', JSON.stringify(newLocation));
      let allStations = [];
      for (const query of STATION_QUERIES) {
        const url = `https://overpass-api.de/api/interpreter?data=[out:json];node(around:${RADIUS_STEPS[radiusIndex]},${latitude},${longitude})${query};out;`;
        const response = await fetch(url);
        if (!response.ok) continue;
        const data = await response.json();
        if (data && data.elements && data.elements.length > 0) {
          allStations = allStations.concat(data.elements.map(element => ({
            id: element.id,
            name: element.tags.name || 'محطة بدون اسم',
            latitude: element.lat,
            longitude: element.lon,
            distance: calculateDistance(latitude, longitude, element.lat, element.lon),
            type: getStationType(element.tags)
          })));
        }
      }
      // Remove duplicates by id
      const uniqueStations = Object.values(allStations.reduce((acc, s) => {
        acc[s.id] = s;
        return acc;
      }, {}));
      uniqueStations.sort((a, b) => a.distance - b.distance);
      if (uniqueStations.length === 0 && radiusIndex < RADIUS_STEPS.length - 1) {
        // Try next radius
        setSearchRadius(RADIUS_STEPS[radiusIndex + 1]);
        return findNearbyStations(radiusIndex + 1);
      }
      if (uniqueStations.length === 0) {
        setError('لم يتم العثور على محطات قريبة. جرب موقعاً آخر أو تحقق من اتصالك بالإنترنت.');
        setStations([]);
        return;
      }
      setStations(uniqueStations.slice(0, 5));
      setSelectedStation(uniqueStations[0]);
      const now = new Date().getTime();
      localStorage.setItem('nearbyStations', JSON.stringify(uniqueStations.slice(0, 5)));
      localStorage.setItem('lastSearchTimestamp', now.toString());
      setLastSearchTimestamp(now.toString());
    } catch (err) {
      setError('تعذر الحصول على المحطات القريبة. يرجى المحاولة مرة أخرى.');
      setStations([]);
    } finally {
      setLoading(false);
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

  // Navigation options
  const navigateToStation = (station) => {
    if (station) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${station.latitude},${station.longitude}&travelmode=walking`;
      window.open(url, "_blank");
    }
  };

  // Format timestamp to readable time
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return null;
    const date = new Date(parseInt(timestamp));
    return date.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
  };

  // Map markers for all stations
  const getMapMarkers = () => {
    if (!stations.length) return '';
    return stations.map(s => `marker=${s.latitude},${s.longitude}`).join('&');
  };

  return (
    <div className="station-container">
      <h2>أقرب المحطات</h2>
      {!loading && (
        <button
          className={`btn station-btn ${stations.length ? 'refresh-btn' : ''}`}
          onClick={() => findNearbyStations()}
        >
          {stations.length ? 'تحديث الموقع' : 'البحث عن أقرب المحطات'}
        </button>
      )}
      {lastSearchTimestamp && stations.length > 0 && (
        <div className="last-update">
          آخر تحديث: {formatTimestamp(lastSearchTimestamp)}
        </div>
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
      {stations.length > 0 && (
        <>
          <div className="station-info" style={{marginTop: 10}}>
            {stations.map((station, idx) => (
              <div
                className={`station-card${selectedStation && selectedStation.id === station.id ? ' selected' : ''}`}
                key={station.id}
                style={{marginBottom: 12, border: selectedStation && selectedStation.id === station.id ? '2px solid var(--info)' : '1px solid var(--third)', cursor: 'pointer', background: selectedStation && selectedStation.id === station.id ? 'var(--third)' : 'var(--card-bg)'}}
                onClick={() => setSelectedStation(station)}
                tabIndex={0}
              >
                <div style={{display: 'flex', justifyContent: 'space-between'}}>
                  <span style={{fontWeight: 600}}>{station.name}</span>
                  <span style={{color: 'var(--info)', fontWeight: 500}}>{station.type}</span>
                </div>
                <div style={{display: 'flex', justifyContent: 'space-between', fontSize: 14, marginTop: 4}}>
                  <span>المسافة: {formatDistance(station.distance)}</span>
                  {selectedStation && selectedStation.id === station.id && <span style={{color: 'var(--success)'}}>المحدد</span>}
                </div>
                <button
                  className="btn navigate-btn"
                  style={{marginTop: 8, width: '100%'}}
                  onClick={e => { e.stopPropagation(); navigateToStation(station); }}
                >
                  الاتجاهات
                </button>
              </div>
            ))}
          </div>
          {/* Embedded Map with all markers */}
          <div className="map-container" style={{marginTop: 10}}>
            <iframe
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${stations.reduce((acc, s) => ([
                Math.min(acc[0], s.longitude),
                Math.min(acc[1], s.latitude),
                Math.max(acc[2], s.longitude),
                Math.max(acc[3], s.latitude)
              ]), [stations[0].longitude - 0.01, stations[0].latitude - 0.01, stations[0].longitude + 0.01, stations[0].latitude + 0.01])}&layer=mapnik&${getMapMarkers()}`}
              width="100%"
              height="200"
              frameBorder="0"
              title="Stations Map"
              loading="lazy"
              style={{borderRadius: 8, border: '1px solid var(--third)'}}
            ></iframe>
          </div>
        </>
      )}
    </div>
  );
};

export default NearbyStation;