import React, { useState, useEffect } from "react";
import Slider from '@mui/material/Slider';
import "./App.css"; // Import the CSS file
const TrainControl = () => {
 const [ws, setWs] = useState(null);
 const [velocity, setVelocity] = useState(0);

 const [status, setStatus] = useState("Waiting for connection...");

 useEffect(() => {
  // Connect to the WebSocket server on the ONLOGIC HMI server
  const socket = new WebSocket("ws://192.168.65.1:8000");
  setWs(socket);
  
  socket.onmessage = (event) => {
   setStatus(event.data);
  };
  socket.onclose = () => {
   setStatus("Disconnected from server");
  };
  return () => {
   socket.close();
  };
 }, []);

 useEffect(() => {
  sendCommand(velocity);
 }, [velocity])


 const sendCommand = (command) => {
  if (ws) {
   ws.send(command);
   setStatus(`Sent command: ${command}`);
  }
 };
 
 const contolGate = (action) => {
  fetch('http://192.168.65.1:8001', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({ action: action, testField : 25 })
  })
  .then(response => response.json()) // Parse JSON response
  .then(data => console.log('Success:', data))
  .catch(error => console.error('Error:', error));
 }
 
 return (
  <div className="outer">
   <div className="inner">
    <h1 className="title">Foxgold Train Control</h1>
    <p className="status">{status}</p>
    <Slider value={velocity}
    onChange={(e,v) => setVelocity(v)}
     aria-label="Default" 
     valueLabelDisplay="auto"
     min={-100}
     max={100} />

    <div className="button-container">
     <button
      className="button button-green"
      onClick={() => setVelocity(100)}
     >
      Start Train
     </button>
     <button
      className="button button-red"
      onClick={() => setVelocity(0)}
     >
      Stop Train
     </button>

     <button
      className="button button-red"
      onClick={() => contolGate("Open")}
     >
      Open Gate
     </button>
     <button
      className="button button-red"
      onClick={() => contolGate("Close")}
     >
      Close Gate
     </button>
    </div>
   </div>
  </div>
 );
};
export default TrainControl;