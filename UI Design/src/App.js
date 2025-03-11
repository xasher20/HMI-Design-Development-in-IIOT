import React, { useState, useEffect } from "react";
import "./App.css"; // Import the CSS file
const TrainControl = () => {
 const [ws, setWs] = useState(null);
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
 const sendCommand = (command) => {
  if (ws) {
   ws.send(command);
   setStatus(`Sent command: ${command}`);
  }
 };
 return (
  <div className="outer">
   <div className="inner">
    <h1 className="title">Foxgold Train Control</h1>
    <p className="status">{status}</p>
    <div className="button-container">
     <button
      className="button button-green"
      onClick={() => sendCommand("start_train")}
     >
      Start Train
     </button>
     <button
      className="button button-red"
      onClick={() => sendCommand("stop_train")}
     >
      Stop Train
     </button>
    </div>
   </div>
  </div>
 );
};
export default TrainControl;