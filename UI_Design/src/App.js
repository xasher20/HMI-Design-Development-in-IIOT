import React, { useState, useEffect, useCallback } from "react";
import Slider from '@mui/material/Slider';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import "./App.css";

const TrainControl = () => {
  const [ws, setWs] = useState(null);

  const [velocity, setVelocity] = useState(0);
  
  const [status, setStatus] = useState("Waiting for connection...");
  
  const [isAuthenticated, setIsAuthenticated] = useState(false);
 
  const [username, setUsername] = useState("");  
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  
  const [loginDialogIsOpen, setLoginDialogIsOpen] = useState(false);

  const [connectionError, setConnectionError] = useState(null);
  const [isGateOpen, setIsGateOpen] = useState(false);
  const [isTurbineOn, setIsTurbineOn] = useState(false);

  // Memoize the sendVelocityCommand function
  const sendVelocityCommand = useCallback((value) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      const command = {
        type: 'command',
        value: value
      };
      
      console.log("Sending command:", command);
      ws.send(JSON.stringify(command));
      setStatus(`Sending command: ${value}`);
    } else {
      setStatus("WebSocket connection not available");
    }
  }, [ws]);

  // Memoize the sendVelocityCommand function
  const sendTurbineCommand = useCallback((value) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      const command = {
        type: 'turbine',
        value: value
      };
      
      console.log("Sending command:", command);
      ws.send(JSON.stringify(command));
      setStatus(`Sending command: ${value}`);
    } else {
      setStatus("WebSocket connection not available");
    }
  }, [ws]);

  // Memoize the sendGateCommand function
  const sendGateCommand = useCallback((action) => {
    
    if (ws && ws.readyState === WebSocket.OPEN) {
      const command = {
        type: 'gate',
        action: action
      };
      
      console.log("Sending gate command:", command);
      ws.send(JSON.stringify(command));
      setStatus(`Sending gate command: ${action}`);
    } else {
      // Fallback to HTTPS endpoint with authentication token
      fetch('https://192.168.65.1:8001', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          action: action, 
          token: btoa(`${username}:${Date.now()}`) 
        })
      })
      .then(response => response.json())
      .then(data => {
        console.log('Success:', data);
        setStatus(`Gate ${action} command sent`);
      })
      .catch(error => {
        console.error('Error:', error);
        setStatus(`Error sending gate command: ${error.message}`);
      });
    }
  }, [ws]);

  //Establish a new websocket connection
  useEffect(() => {
    // Connect to the secure WebSocket server
    console.log("Connecting to WebSocket server...");
    
    // Using wss:// for secure WebSocket connection
    const socket = new WebSocket("wss://192.168.65.1:8000");
    setWs(socket);
    
    const keepAlive = setInterval(() => {
      socket.send(JSON.stringify({type: "keep_alive"}))
    }, 10000);

    return () => {

      console.log("Closing WebSocket connection...");
      clearInterval(keepAlive);
      socket.close();
      setWs(null);
    };
  }, []);

  //Establish websocket callbacks
  useEffect(() => {
    if (!ws) return;

    ws.onopen = () => {
      console.log("WebSocket connection established successfully");
      setStatus("Connected to server. Please authenticate to control the train.");
      setConnectionError(null);
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("Received message:", data);
        
        // Handle different message types
        switch(data.type) {
          case 'status':
            setStatus(data.message);
            break;
          
          case 'auth_response':
            if (data.success) {
              setIsAuthenticated(true);
              setStatus(data.message);
              setAuthError("");
            } else {
              setAuthError(data.message);
            }
            break;
          
          case 'command_response':
            setStatus(data.message);
            break;
            
          case 'gate_response':
            setStatus(data.message);
            setIsGateOpen(data.message.toLowerCase().includes("open"));
            break;
          case 'turbine_response':
            setStatus(data.message);
            setIsGateOpen(data.message.toLowerCase().includes("start"));
            break;  
          case 'error':
            setStatus(`Error: ${data.message}`);
            
            // If authentication required, open auth dialog
            if (data.message === 'Authentication required') {
              setLoginDialogIsOpen(true);
            }
            break;
          case 'keep_alive_response':
              break;
          default:
            setStatus(`Unknown message type: ${data.type}`);
        }
      } catch (error) {
        console.error("Error parsing message:", error);
        setStatus(`Received: ${event.data}`);
      }
    };
    
    ws.onclose = () => {
      console.log("WebSocket connection closed");
      setStatus("Disconnected from server");
      setIsAuthenticated(false);
    };
    
    
    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      setConnectionError("Connection failed. Make sure the server is running and SSL certificates are accepted.");
      setStatus("Connection error. See browser console for details.");
    };
    
  }, [ws]);

  useEffect(() => {
    if (isAuthenticated) {
      sendVelocityCommand(velocity);
    }
  }, [velocity, isAuthenticated, sendVelocityCommand]);

  useEffect(() => {
    if (isAuthenticated === true){
      setLoginDialogIsOpen(false); // Close the login dialog
    }
  }, [isAuthenticated]);

  const handleAuthenticate = () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      const authData = {
        type: 'auth',
        username: username,
        password: password
      };
      
      console.log("Sending auth data:", {...authData, password: "******"});
      ws.send(JSON.stringify(authData));
      setPassword(""); // Clear password for security
    } else {
      console.log("Unable to authenticate - Websocket State: ", ws?.readyState);
    }
  };

  const handleCloseAuthDialog = () => {
    setLoginDialogIsOpen(false);
    setAuthError("");
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setStatus("Logged out. Please authenticate to control the train.");
  };

  return (
    <div className="outer">
      <div className="inner">
        <h1 className="title">Foxgold Train Control</h1>
        
        {/* Connection error message */}
        {connectionError && (
          <Alert severity="error" style={{ marginBottom: '15px' }}>
            {connectionError}
            <div style={{ fontSize: '0.9em', marginTop: '8px' }}>
              To accept the SSL certificate, visit <a href="https://192.168.65.1:8000" target="_blank" rel="noopener noreferrer">https://192.168.65.1:8000</a> and <a href="https://192.168.65.1:8001" target="_blank" rel="noopener noreferrer">https://192.168.65.1:8001</a> directly in your browser.
            </div>
          </Alert>
        )}
        
        {/* Authentication status */}
        <div className="auth-status">
          {isAuthenticated ? (
            <div className="user-info">
              <span>Logged in as: <strong>{username}</strong></span>
              <button 
                className="button button-small"
                onClick={handleLogout}
              >
                Logout
              </button>
            </div>
          ) : (
            <button
              className="button button-green"
              onClick={() => setLoginDialogIsOpen(true)}
              disabled={connectionError}
            >
              Login
            </button>
          )}
        </div>
        
        <p className="status">{status}</p>

        <h2 style={{ marginTop: '20px', marginBottom: '5px' }}>Speed Control</h2>
        <div style={{ display: 'flex', justifyContent: 'space-between', margin: '0 15px' }}>
          <span>2.5V</span>
          <span>10V</span>
        </div>
        <Slider 
          value={velocity}
          onChange={(e, v) => isAuthenticated ? setVelocity(v) : null}
          aria-label="Velocity" 
          valueLabelDisplay="auto"
          min={0}
          max={100}
          disabled={!isAuthenticated}
        />
        
        <div className="button-container">
          <button
            className={`button ${velocity >= 25 ? "button-red" : "button-green"}`}
            onClick={() => {
              if (isAuthenticated) {
                setVelocity(velocity >= 25 ? 0 : 100); // Toggle between Stop and Start
              } else {
                setLoginDialogIsOpen(true);
              }
            }}
            disabled={!isAuthenticated}
          >
            {velocity >= 25 ? "Stop Train" : "Start Train"}
          </button>
           
          <button
            className={`button ${isGateOpen ? "button-red" : "button-green"}`}
            onClick={() => {
              if (isAuthenticated) {
                const nextAction = isGateOpen ? "Close" : "Open";
                sendGateCommand(nextAction);
                setIsGateOpen(!isGateOpen);
              } else {
                setLoginDialogIsOpen(true);
              }
            }}
            disabled={!isAuthenticated}
          >
            {isGateOpen ? "Close Gate" : "Open Gate"}
          </button>

          <button
            className={`button ${isTurbineOn ? "button-red" : "button-green"}`}
            onClick={() => {
              if (isAuthenticated) {
                const nextAction = isTurbineOn ? "Stop" : "Start";
                sendTurbineCommand(nextAction);
                setIsTurbineOn(!isTurbineOn);
              } else {
                setLoginDialogIsOpen(true);
              }
            }}
            disabled={!isAuthenticated}
          >
            {isTurbineOn ? "Start Turbine" : "Stop Turbine"}
          </button>
        </div>
      </div>
      
      {/* Authentication Dialog */}
      <Dialog open={loginDialogIsOpen} onClose={handleCloseAuthDialog}>
        <DialogTitle>Authentication Required</DialogTitle>
        <DialogContent>
          {authError && (
            <Alert severity="error" style={{ marginBottom: '15px' }}>
              {authError}
            </Alert>
          )}
          
          <TextField
            autoFocus
            margin="dense"
            label="Username"
            type="text"
            fullWidth
            variant="outlined"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <TextField
            margin="dense"
            label="Password"
            type="password"
            fullWidth
            variant="outlined"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleAuthenticate();
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseAuthDialog}>Cancel</Button>
          <Button onClick={handleAuthenticate} color="primary">
            Login
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default TrainControl;