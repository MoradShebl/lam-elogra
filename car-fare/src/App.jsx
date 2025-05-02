import { useState } from "react";
import Chairs from "./Components/Chairs.jsx";

const App = () => {
  const [fare, setFare] = useState(0);
  const [rowPos, setRowPos] = useState("notLast");
  const [passengersAtRow, setpassengersAtRow] = useState();
  const [passenger, setpassenger] = useState([]);
  const [submit, setSubmit] = useState(true);
  const [isDisabled, setIsDisabled] = useState(false);

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
    setSubmit(false);
    const passengerInformation = {
      fare: fare,
      rowPos: rowPos,
      passengersAtRow: passengersAtRow,
    };
    setpassenger(passengerInformation);
    setIsDisabled(true);
  };

  return (
    <>
      <div className="container">
        <div className="content">
          <form className="card" onSubmit={AddPassengerInformation}>
            <div className="maincntnt">
              <h2>سعر الأجرة</h2>
              <input
                type="number"
                className="card-input"
                onChange={onFareChange}
                required
                max={1000}
                min={1}
                disabled={isDisabled}
              />

              <h2>الصف</h2>
              <select className="card-input" onChange={onRowChange} required >
                <option value="notLast">ليس الأخير</option>
                <option value="last">الأخير</option>
              </select>

              <h2>عدد الركاب في الصف</h2>
              <input
                type="number"
                className="card-input"
                onChange={passengerChange}
                required
                max={5}
                min={1}
                disabled={isDisabled}
              />
            </div>
            {submit === true ? (
              <button type="submit" className="btn">
                حساب
              </button>
            ) : (
              <>
                <Chairs passengerInformation={passenger} />
              </>
            )}
          </form>
        </div>
      </div>
    </>
  );
};
export default App;
