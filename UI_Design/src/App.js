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
  const [openAuthDialog, setOpenAuthDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [authToken, setAuthToken] = useState(null);
  const [connectionError, setConnectionError] = useState(null);

  // Memoize the executePendingAction function to avoid recreating it on every render
  const executePendingAction = useCallback(() => {
    if (!pendingAction) return;
    
    const { type, value } = pendingAction;
    
    if (type === 'velocity') {
      sendVelocityCommand(value);
    } else if (type === 'gate') {
      sendGateCommand(value);
    }
    
    setPendingAction(null);
  }, [pendingAction]); // pendingAction is a dependency

  // Memoize the sendVelocityCommand function
  const sendVelocityCommand = useCallback((value) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      if (!isAuthenticated) {
        setPendingAction({ type: 'velocity', value });
        setOpenAuthDialog(true);
        return;
      }
      
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
  }, [ws, isAuthenticated, setOpenAuthDialog, setStatus]);

  // Memoize the sendGateCommand function
  const sendGateCommand = useCallback((action) => {
    if (!isAuthenticated) {
      setPendingAction({ type: 'gate', value: action });
      setOpenAuthDialog(true);
      return;
    }
    
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
      fetch('https://192.168.56.2:8001', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          action: action, 
          token: authToken 
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
  }, [isAuthenticated, ws, authToken, setStatus, setOpenAuthDialog]);

  useEffect(() => {
    // Connect to the secure WebSocket server
    console.log("Connecting to WebSocket server...");
    
    // Using wss:// for secure WebSocket connection
    const socket = new WebSocket("wss://192.168.56.2:8000");
    setWs(socket);
    
    socket.onopen = () => {
      console.log("WebSocket connection established successfully");
      setStatus("Connected to server. Please authenticate to control the train.");
      setConnectionError(null);
    };
    
    socket.onmessage = (event) => {
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
              setOpenAuthDialog(false);
              
              // Create a simple token
              setAuthToken(btoa(`${username}:${Date.now()}`));
              
              // Execute pending action if there was one
              if (pendingAction) {
                executePendingAction();
              }
            } else {
              setAuthError(data.message);
            }
            break;
          
          case 'command_response':
            setStatus(data.message);
            break;
            
          case 'gate_response':
            setStatus(data.message);
            break;
            
          case 'error':
            setStatus(`Error: ${data.message}`);
            
            // If authentication required, open auth dialog
            if (data.message === 'Authentication required') {
              setOpenAuthDialog(true);
            }
            break;
            
          default:
            setStatus(`Unknown message type: ${data.type}`);
        }
      } catch (error) {
        console.error("Error parsing message:", error);
        setStatus(`Received: ${event.data}`);
      }
    };
    
    socket.onclose = () => {
      console.log("WebSocket connection closed");
      setStatus("Disconnected from server");
      setIsAuthenticated(false);
    };
    
    socket.onerror = (error) => {
      console.error("WebSocket error:", error);
      setConnectionError("Connection failed. Make sure the server is running and SSL certificates are accepted.");
      setStatus("Connection error. See browser console for details.");
    };
    
    return () => {
      console.log("Closing WebSocket connection...");
      socket.close();
    };
  }, [executePendingAction, username, pendingAction]); // Added missing dependencies

  useEffect(() => {
    if (velocity !== 0 && isAuthenticated) {
      sendVelocityCommand(velocity);
    }
  }, [velocity, isAuthenticated, sendVelocityCommand]); // Added missing dependencies

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
    }
  };

  const handleCloseAuthDialog = () => {
    setOpenAuthDialog(false);
    setPendingAction(null);
    setAuthError("");
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setAuthToken(null);
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
              To accept the SSL certificate, visit <a href="https://192.168.56.2:8000" target="_blank" rel="noopener noreferrer">https://localhost:8000</a> and <a href="https://localhost:8001" target="_blank" rel="noopener noreferrer">https://localhost:8001</a> directly in your browser.
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
              onClick={() => setOpenAuthDialog(true)}
              disabled={connectionError}
            >
              Login
            </button>
          )}
        </div>
        
        <p className="status">{status}</p>
        
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
            className="button button-green"
            onClick={() => isAuthenticated ? setVelocity(100) : setOpenAuthDialog(true)}
            disabled={!isAuthenticated}
          >
            Start Train
          </button>
          
          <button 
            className="button button-red"
            onClick={() => isAuthenticated ? setVelocity(0) : setOpenAuthDialog(true)}
            disabled={!isAuthenticated}
          >
            Stop Train
          </button>
           
          <button 
            className="button button-green"
            onClick={() => sendGateCommand("Open")}
            disabled={!isAuthenticated}
          >
            Open Gate
          </button>
          
          <button 
            className="button button-red"
            onClick={() => sendGateCommand("Close")}
            disabled={!isAuthenticated}
          >
            Close Gate
          </button>
        </div>
      </div>
      
      {/* Authentication Dialog */}
      <Dialog open={openAuthDialog} onClose={handleCloseAuthDialog}>
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