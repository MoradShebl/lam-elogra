  import { useState, useEffect } from "react";

  const Chairs = (props) => {
    const rowPos = props.passengerInformation.rowPos;
    const fare = Number(props.passengerInformation.fare);
    const passengersAtRow = props.passengerInformation.passengersAtRow;
    const [selectedPassenger, setSelectedPassenger] = useState(null);
    const [totalBalance, setTotalBalance] = useState(0);
    const [backRowSelected, setBackRowSelected] = useState(false);
    const [backRowData, setBackRowData] = useState({
      paid: "",
      taken: "",
      remaining: 0,
      passengers: "",
    });
    const [passengersData, setPassengersData] = useState(
      Array(parseInt(passengersAtRow))
        .fill()
        .map(() => ({
          paid: "",
          taken: "",
          remaining: 0,
        }))
    );

    useEffect(() => {
      // Calculate total balance including all passengers and back row
      const regularPassengersBalance = passengersData.reduce((sum, passenger) => {
        const paid = Number(passenger.paid) || 0;
        const taken = Number(passenger.taken) || 0;
        return sum + (paid - taken);
      }, 0);

      // Calculate back row balance
      const backRowPaid = Number(backRowData.paid) || 0;
      const backRowTaken = Number(backRowData.taken) || 0;
      const backRowBalance =
        backRowPaid - backRowTaken;

      setTotalBalance(regularPassengersBalance + backRowBalance);
    }, [passengersData, backRowData, backRowSelected, fare]);

    const handleCheckboxChange = (index) => {
      if (selectedPassenger === index) {
        setSelectedPassenger(null);
      } else {
        setSelectedPassenger(index);
        setBackRowSelected(false);
      }
    };

    const handleBackRowCheckboxChange = () => {
      setBackRowSelected(!backRowSelected);
      setSelectedPassenger(null);
    };

    const handleBackRowChange = (field, value) => {
      setBackRowData((prev) => {
        const newData = { ...prev, [field]: value };

        // Calculate remaining amount for back row
        const paid = field === "paid" ? Number(value) : Number(prev.paid) || 0;
        const taken = field === "taken" ? Number(value) : Number(prev.taken) || 0;
        const passengers =
          field === "passengers" ? Number(value) : Number(prev.passengers) || 0;

        newData.remaining = paid - taken - passengers * fare;
        return newData;
      });
    };

    const handlePaidAmountChange = (value) => {
      if (selectedPassenger === null) return;

      const paid = Number(value) || 0;
      const taken = Number(passengersData[selectedPassenger].taken) || 0;

      setPassengersData((prev) => {
        const newData = [...prev];
        newData[selectedPassenger] = {
          ...newData[selectedPassenger],
          paid: value,
          remaining: paid - taken - (value ? fare : 0),
        };
        return newData;
      });
    };

    const handleTakenAmountChange = (value) => {
      if (selectedPassenger === null) return;

      const paid = Number(passengersData[selectedPassenger].paid) || 0;
      const taken = Number(value) || 0;

      setPassengersData((prev) => {
        const newData = [...prev];
        newData[selectedPassenger] = {
          ...newData[selectedPassenger],
          taken: value,
          remaining: paid - taken - (paid ? fare : 0),
        };
        return newData;
      });
    };

    const checkboxes = Array.from({ length: passengersAtRow }, (_, index) => (
      <li key={index} className="check-box">
        <input
          type="checkbox"
          id={`passenger-${index + 1}`}
          checked={selectedPassenger === index}
          onChange={() => handleCheckboxChange(index)}
        />
      </li>
    ));

    // Calculate total passengers (regular + back row)
    const totalPassengers = parseInt(passengersAtRow) + (parseInt(backRowData.passengers) || 0);
    
    // Calculate total remaining value from all passengers
    const totalRemainingValue = passengersData.reduce((sum, passenger) => {
      return sum + (Number(passenger.remaining) || 0);
    }, 0) + (Number(backRowData.remaining) || 0);

    return (
      <div className="chairs-container">
        <div className="balance">
          <span>:المال المتبقي</span>
          <span className="balance-amount">{totalBalance}</span>
        </div>
        <div className="checkboxes-container">
          <ul className="checkboxes">{checkboxes}</ul>
          {rowPos === "notLast" && (
            <div className="back-row">
              <div className="back-row-checkbox">
                <input
                  type="checkbox"
                  id="backRow"
                  checked={backRowSelected}
                  onChange={handleBackRowCheckboxChange}
                />
              </div>
              {backRowSelected && (
                <div className="amounts-display">
                  <div>
                    <span>:عدد الدافعين</span>
                    <input
                      type="number"
                      value={backRowData.passengers}
                      onChange={(e) =>
                        handleBackRowChange("passengers", e.target.value)
                      }
                      min="1"
                      max="5"
                    />
                  </div>
                  <div>
                    <span>:المبلغ اللذي دفعه</span>
                    <input
                      type="number"
                      value={backRowData.paid}
                      onChange={(e) =>
                        handleBackRowChange("paid", e.target.value)
                      }
                    />
                  </div>
                  <div>
                    <span>:المبلغ اللذي أخذه</span>
                    <input
                      type="number"
                      value={backRowData.taken}
                      onChange={(e) =>
                        handleBackRowChange("taken", e.target.value)
                      }
                    />
                  </div>
                  <div>
                    <span>:الباقي</span>
                    <span className="amount">{backRowData.remaining}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        {selectedPassenger !== null && (
          <div className="amounts-display">
            <div>
              <span>:المبلغ اللذي دفعه</span>
              <input
                type="number"
                value={passengersData[selectedPassenger].paid}
                onChange={(e) => handlePaidAmountChange(e.target.value)}
              />
            </div>
            <div>
              <span>:المبلغ اللذي أخذه</span>
              <input
                type="number"
                value={passengersData[selectedPassenger].taken}
                onChange={(e) => handleTakenAmountChange(e.target.value)}
              />
            </div>
            <div>
              <span>:الباقي</span>
              <span className="amount">
                {passengersData[selectedPassenger].remaining}
              </span>
            </div>
          </div>
        )}
        <hr />
        <div className="instraction">
          <h2>التعليمات (ان لم يكن للباقي مال)</h2>
          <span>{`اعطي اللذي أمامك ${totalBalance} لعدد أفراد ${totalPassengers} وخذ منه باقي ${totalRemainingValue}`}</span>
        </div>
      </div>
    );
  };

  export default Chairs;