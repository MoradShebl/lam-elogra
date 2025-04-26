import { useState, useEffect } from "react";

const RouteRecommendation = () => {
  const [userLocation, setUserLocation] = useState(null);
  const [destination, setDestination] = useState("");
  const [destinationCoords, setDestinationCoords] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [routeOptions, setRouteOptions] = useState(null);
  const [recommendation, setRecommendation] = useState(null);

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
    
    try {
      // Simulate API response - in a real app you would use actual API
      // Note: Free APIs like OpenRouteService require API keys and have usage limits
      
      const distance = calculateDistance(
        start.latitude, start.longitude, 
        end.latitude, end.longitude
      );
      
      // Generate simulated route options based on distance
      const options = generateRouteOptions(distance);
      setRouteOptions(options);
      
      // Generate AI recommendation based on options
      const bestOption = recommendBestOption(options);
      setRecommendation(bestOption);
      
    } catch (err) {
      console.error("Error getting route options:", err);
      setError("تعذر الحصول على خيارات المسار. يرجى المحاولة مرة أخرى لاحقًا.");
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

  // Generate route options based on distance
  const generateRouteOptions = (distance) => {
    // Simulate different transportation options
    const options = [
      {
        mode: "walking",
        icon: "🚶",
        name: "المشي",
        time: Math.round(distance * 12), // minutes (5 km/h)
        cost: 0,
        calories: Math.round(distance * 65), // kcal
        sustainable: true,
        suitable: distance < 5 // Walking suitable for distances less than 5km
      },
      {
        mode: "bicycle",
        icon: "🚲",
        name: "دراجة",
        time: Math.round(distance * 4), // minutes (15 km/h)
        cost: distance < 10 ? 5 : 10, // SAR (rental cost)
        calories: Math.round(distance * 40), // kcal
        sustainable: true,
        suitable: distance < 15 // Biking suitable for distances less than 15km
      },
      {
        mode: "bus",
        icon: "🚌",
        name: "حافلة",
        time: Math.round(distance * 3 + 15), // minutes (20 km/h plus waiting time)
        cost: 3 + Math.round(distance * 0.5), // SAR (base + per km)
        calories: 0,
        sustainable: true,
        suitable: distance > 2 && distance < 30
      },
      {
        mode: "taxi",
        icon: "🚕",
        name: "سيارة أجرة",
        time: Math.round(distance * 1.5 + 5), // minutes (40 km/h plus waiting time)
        cost: 10 + Math.round(distance * 2), // SAR (base + per km)
        calories: 0,
        sustainable: false,
        suitable: true // Generally suitable for all distances
      },
      {
        mode: "uber",
        icon: "🚗",
        name: "أوبر",
        time: Math.round(distance * 1.5 + 8), // minutes (40 km/h plus waiting time)
        cost: 8 + Math.round(distance * 1.8), // SAR (base + per km)
        calories: 0,
        sustainable: false,
        suitable: true // Generally suitable for all distances
      },
      {
        mode: "train",
        icon: "🚆",
        name: "قطار",
        time: Math.round(distance * 1.2 + 20), // minutes (50 km/h plus waiting time)
        cost: 5 + Math.round(distance * 0.3), // SAR (base + per km)
        calories: 0,
        sustainable: true,
        suitable: distance > 5 && distance < 100 // Suitable for medium to long distances
      }
    ];
    
    // Filter to only include suitable options
    return options.filter(option => option.suitable);
  };

  // AI recommendation algorithm
  const recommendBestOption = (options) => {
    if (!options || options.length === 0) return null;
    
    // Apply weighting to different factors
    const weightedOptions = options.map(option => {
      // Calculate weighted score based on time, cost, sustainability
      const timeScore = 1 - (option.time / Math.max(...options.map(o => o.time)));
      const costScore = 1 - (option.cost / Math.max(...options.map(o => o.cost || 1)));
      const sustainabilityScore = option.sustainable ? 1 : 0;
      
      // Weighted score (customize weights based on preferences)
      const score = (timeScore * 0.4) + (costScore * 0.4) + (sustainabilityScore * 0.2);
      
      return {
        ...option,
        score
      };
    });
    
    // Sort by score and return the best option
    weightedOptions.sort((a, b) => b.score - a.score);
    return weightedOptions[0];
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
    
    switch(option.mode) {
      case "walking":
        url = `https://www.google.com/maps/dir/?api=1&origin=${userLocation.latitude},${userLocation.longitude}&destination=${destinationCoords.latitude},${destinationCoords.longitude}&travelmode=walking`;
        break;
      case "bicycle":
        url = `https://www.google.com/maps/dir/?api=1&origin=${userLocation.latitude},${userLocation.longitude}&destination=${destinationCoords.latitude},${destinationCoords.longitude}&travelmode=bicycling`;
        break;
      case "bus":
      case "train":
        url = `https://www.google.com/maps/dir/?api=1&origin=${userLocation.latitude},${userLocation.longitude}&destination=${destinationCoords.latitude},${destinationCoords.longitude}&travelmode=transit`;
        break;
      case "uber":
        url = `https://m.uber.com/ul/?action=setPickup&pickup[latitude]=${userLocation.latitude}&pickup[longitude]=${userLocation.longitude}&dropoff[latitude]=${destinationCoords.latitude}&dropoff[longitude]=${destinationCoords.longitude}`;
        break;
      case "taxi":
      default:
        url = `https://www.google.com/maps/dir/?api=1&origin=${userLocation.latitude},${userLocation.longitude}&destination=${destinationCoords.latitude},${destinationCoords.longitude}&travelmode=driving`;
        break;
    }
    
    window.open(url, "_blank");
  };

  return (
    <div className="route-recommendation-container">
      <h2>مخطط الرحلة</h2>
      
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
          {!userLocation ? "تحديد الموقع والبحث" : "البحث عن طرق"}
        </button>
      </form>
      
      {loading && (
        <div className="loading">
          <div className="spinner"></div>
          <p>جاري البحث...</p>
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
      
      {routeOptions && routeOptions.length > 0 && (
        <div className="route-options">
          <h3>خيارات التنقل</h3>
          
          {recommendation && (
            <div className="recommended-option">
              <div className="recommended-badge">الخيار الأفضل</div>
              <div className="route-option-card recommended">
                <div className="option-icon">{recommendation.icon}</div>
                <div className="option-details">
                  <div className="option-name">{recommendation.name}</div>
                  <div className="option-metrics">
                    <span>⏱️ {recommendation.time} دقيقة</span>
                    <span>💰 {recommendation.cost} جنيه</span>
                  </div>
                  {recommendation.sustainable && (
                    <div className="eco-friendly">♻️ صديق للبيئة</div>
                  )}
                </div>
                <button 
                  className="btn navigate-now-btn"
                  onClick={() => navigateWithOption(recommendation)}
                >
                  اذهب الآن
                </button>
              </div>
            </div>
          )}
          
          <div className="all-options">
            <h4>جميع الخيارات</h4>
            {routeOptions.map((option, index) => (
              <div className="route-option-card" key={index}>
                <div className="option-icon">{option.icon}</div>
                <div className="option-details">
                  <div className="option-name">{option.name}</div>
                  <div className="option-metrics">
                    <span>⏱️ {option.time} دقيقة</span>
                    <span>💰 {option.cost} جنيه</span>
                    {option.calories > 0 && (
                      <span>🔥 {option.calories} سعرة حرارية</span>
                    )}
                  </div>
                </div>
                <button 
                  className="btn select-option-btn"
                  onClick={() => navigateWithOption(option)}
                >
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