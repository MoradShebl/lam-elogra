import { useState, useEffect } from "react";
import Chairs from "./Components/Chairs.jsx";
import NearbyStation from "./Components/NearbyStation.jsx";

const App = () => {
  const [activeView, setActiveView] = useState("menu");
  const [fare, setFare] = useState(0);
  const [rowPos, setRowPos] = useState("notLast");
  const [passengersAtRow, setpassengersAtRow] = useState("");
  const [passenger, setpassenger] = useState([]);
  const [isDisabled, setIsDisabled] = useState(false);
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem("theme");
    return saved || "light";
  });
  const [appHistory, setAppHistory] = useState(() => {
    const saved = localStorage.getItem("appHistory");
    return saved ? JSON.parse(saved) : [];
  });

  // Apply theme from localStorage on mount
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Record app usage history
  useEffect(() => {
    if (activeView !== "menu") {
      const historyItem = {
        view: activeView,
        timestamp: new Date().toISOString(),
      };

      const updatedHistory = [historyItem, ...appHistory].slice(0, 10);
      setAppHistory(updatedHistory);
      localStorage.setItem("appHistory", JSON.stringify(updatedHistory));
    }
  }, [activeView]);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
  };

  const onFareChange = (e) => {
    setFare(e.target.value);
  };

  const onRowChange = (e) => {
    setRowPos(e.target.value);
  };

  const passengerChange = (e) => {
    setpassengersAtRow(e.target.value);
  };

  const AddPassengerInformation = (e) => {
    e.preventDefault();
    const passengerInformation = {
      fare: fare,
      rowPos: rowPos,
      passengersAtRow: passengersAtRow,
    };
    setpassenger(passengerInformation);
    setIsDisabled(true);

    // Vibrate on submit if supported
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }
  };

  const resetFareCalculator = () => {
    setFare(0);
    setRowPos("notLast");
    setpassengersAtRow("");
    setpassenger([]);
    setIsDisabled(false);
  };

  const goToMainMenu = () => {
    setActiveView("menu");
    resetFareCalculator();
  };

  const showRecentActivity = () => {
    if (appHistory.length === 0) return null;

    return (
      <div className="recent-activity">
        <h3>النشاطات الأخيرة</h3>
        <ul>
          {appHistory.slice(0, 3).map((item, index) => (
            <li key={index} onClick={() => setActiveView(item.view)}>
              {item.view === "fare" ? "حساب الأجرة" : "البحث عن محطة"} -
              {new Date(item.timestamp).toLocaleTimeString("ar-SA", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </li>
          ))}
        </ul>
      </div>
    );
  };

  const renderMainMenu = () => (
    <div className="main-menu">
      <div className="app-header">
        <h1>أجرة السيارة</h1>
        <button className="theme-toggle" onClick={toggleTheme}>
          {theme === "light" ? "🌙" : "☀️"}
        </button>
      </div>

      <div className="menu-buttons">
        <button
          className="menu-btn fare-btn"
          onClick={() => setActiveView("fare")}
        >
          حساب الأجرة
        </button>
        <button
          className="menu-btn station-btn"
          onClick={() => setActiveView("station")}
        >
          أقرب محطة
        </button>
      </div>

      {showRecentActivity()}
    </div>
  );

  const renderFareCalculator = () => (
    <>
      <div className="view-header">
        <button className="back-btn" onClick={goToMainMenu}>
          العودة للقائمة الرئيسية
        </button>
        <h2>حساب الأجرة</h2>
      </div>

      <form className="card" onSubmit={AddPassengerInformation}>
        <div className="maincntnt">
          <h2>سعر الأجرة</h2>
          <div className="input-group">
            <input
              type="number"
              step="0.1"
              className="card-input"
              value={fare}
              onChange={onFareChange}
              required
              max={1000}
              min={1}
              disabled={isDisabled}
            />
          </div>

          <h2>الصف</h2>
          <select
            className="card-input"
            value={rowPos}
            onChange={onRowChange}
            required
            disabled={isDisabled}
          >
            <option value="notLast">ليس الأخير</option>
            <option value="last">الأخير</option>
          </select>

          <h2>عدد الركاب في الصف</h2>
          <div className="input-group">
            <input
              type="number"
              className="card-input"
              value={passengersAtRow}
              onChange={passengerChange}
              required
              max={5}
              min={1}
              disabled={isDisabled}
            />
            <span className="input-hint">راكب</span>
          </div>
        </div>

        {!isDisabled ? (
          <button type="submit" className="btn calculate-btn">
            حساب
          </button>
        ) : (
          <>
            <Chairs passengerInformation={passenger} />
            <div className="action-buttons">
              <button className="btn reset-btn" onClick={resetFareCalculator}>
                حساب جديد
              </button>
              <button
                className="btn share-btn"
                onClick={() => {
                  if (navigator.share) {
                    navigator.share({
                      title: "حساب أجرة سيارة",
                      text: `سعر الأجرة: ${fare} ريال، عدد الركاب: ${passengersAtRow}`,
                    });
                  }
                }}
              >
                مشاركة
              </button>
            </div>
          </>
        )}
      </form>
    </>
  );

  return (
    <div className={`container ${theme}`}>
      <div className="content">
        {activeView === "menu" && renderMainMenu()}
        {activeView === "fare" && renderFareCalculator()}
        {activeView === "station" && (
          <>
            <div className="view-header">
              <button className="back-btn" onClick={goToMainMenu}>
                العودة للقائمة الرئيسية
              </button>
              <h2>أقرب محطة</h2>
            </div>
            <NearbyStation />
          </>
        )}
      </div>
    </div>
  );
};

export default App;
