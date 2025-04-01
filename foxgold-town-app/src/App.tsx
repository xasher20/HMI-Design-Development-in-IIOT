import React from 'react';
import logo from './logo.svg';
import './App.css';
import background from './img/background.jpg';
import TrainControlPanel from './components/TrainControlPanel';
import HeaderMenu from './components/HeaderMenu';
import {Box, Typography, Divider} from '@mui/material';

const appStyle = {
  backgroundImage: `url(${background})`,
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat',
  height: '100vh',
  width: '100vw',
  overflow: 'hidden', // Prevent scrolling

};

function App() {
  return (
    <div className="App" style={appStyle}>
      <HeaderMenu />
      

      <Box display="flex" height="100vh" p={6} gap={6}>
      {/* Left Section - Controls */}
      <Box 
        flex={1} 
        bgcolor="lightgray" 
        display="flex" 
        justifyContent="left" 
        flexDirection="column"
        p={2}
        borderRadius={2}
        alignItems="flex-start"
      >
        <Typography variant="h5">Controls</Typography>
        <Box p={2} display="flex" flexDirection="column" gap={2} bgcolor={"darkgray"}>
          <TrainControlPanel />
        </Box>
      </Box>

      {/* Right Section - Status */}
      <Box 
        flex={1} 
        bgcolor="whitesmoke" 
        display="flex" 
        justifyContent="left" 
        flexDirection="column"
        p={2}
        borderRadius={2}
        alignItems="flex-start"
      >
        <Typography variant="h5">Status</Typography>
      </Box>
    </Box>
    </div>
  );
}

export default App;
