import React, { useState, useEffect } from "react";

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
    <div className="p-4">
      <h1 className="text-xl font-bold">Train Control Panel</h1>
      <p className="mb-4">Status: {status}</p>
      <button onClick={() => sendCommand("start_train")} className="bg-green-500 text-white p-2 rounded m-2">
        Start Train
      </button>
      <button onClick={() => sendCommand("stop_train")} className="bg-red-500 text-white p-2 rounded m-2">
        Stop Train
      </button>
    </div>
  );
};

export default TrainControl;