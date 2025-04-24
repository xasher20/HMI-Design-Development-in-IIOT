#!/usr/bin/env python3
import json
import asyncio
import ssl
import websockets
import logging
import os
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler
import threading
from urllib.parse import parse_qs
import base64
import subprocess
import serial
from pymodbus.client import ModbusTcpClient

client=ModbusTcpClient('192.168.56.4', port=502)
# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("server.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("train_control")

# Load user credentials from file
def load_credentials():
    try:
        with open('users.json', 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        logger.error("users.json file not found. Creating default admin user.")
        # Create a default user if file doesn't exist
        default_users = {
            "admin": {"password": "admin123"}
        }
        with open('users.json', 'w') as f:
            json.dump(default_users, f, indent=2)
        return default_users

# Store authenticated clients
authenticated_clients = {}

# Command log function
def log_command(username, command_type, value):
    timestamp = datetime.now().isoformat()
    log_entry = f"{timestamp} - {username} - {command_type}: {value}\n"
    
    with open("command_log.txt", "a") as f:
        f.write(log_entry)


#"\xAA\x01\x2C\x13\x88\x12\xAB\x01\xF4\x00\x04\x00\x00\x00\x42\x00\x00\x00\x00\x6A"
def get_voltage(voltage_value):
    # Initialize command with integer bytes, not strings
    command = [
        0xAA,  # Header
        0x01,  # Device number
        0x2C,  # Command (Set/Get)
        0x13,  # High byte of current protection voltage value
        0x88,  # Low byte of current protection voltage value
        0x12,  # High byte of current protection current value
        0xAB,  # Low byte of current protection current value
        0x01,  # High byte of current set voltage value
        0xF4,  # Low byte of current set voltage value
        0x00,  # High byte of current value currently set
        0x04,  # Low byte of current value currently set
        0x00,
        0x00,
        0x00,
        0x42, 
        0x00,
        0x00,
        0x00,
        0x00   # Total 19 bytes before checksum
    ]

    mV = int(voltage_value * 10)
    high_byte = (mV >> 8) & 0xFF
    low_byte = mV & 0xFF

    command[7] = high_byte
    command[8] = low_byte

    checksum = sum(command) % 256
    command.append(checksum)
    
    string_command = ''.join(f'\\x{byte:02X}' for byte in command)
    return string_command

# WebSocket handler - Updated to work with newer websockets library
async def websocket_handler(websocket):
    """Handler for WebSocket connections"""
    # In newer versions, there's no path parameter
    client_ip = websocket.remote_address[0]
    logger.info(f"Client connected from {client_ip}")
    
    # Log origin header for debugging
    if hasattr(websocket, 'request_headers') and "origin" in websocket.request_headers:
        origin = websocket.request_headers["origin"]
        logger.info(f"Connection request from origin: {origin}")
    
    try:
        # Send welcome message
        await websocket.send(json.dumps({
            "type": "status",
            "message": "Connected to server. Please authenticate."
        }))
        
        authenticated = False
        username = None
        
        async for message in websocket:
            try:
                data = json.loads(message)
                logger.info(f"Received message from {client_ip}: {data.get('type', 'unknown type')}")
                
                # Handle authentication
                if data.get('type') == 'auth':
                    users = load_credentials()
                    if data['username'] in users and users[data['username']]['password'] == data['password']:
                        authenticated = True
                        username = data['username']
                        authenticated_clients[websocket] = username
                        
                        await websocket.send(json.dumps({
                            "type": "auth_response",
                            "success": True,
                            "message": f"Welcome, {username}!"
                        }))
                        logger.info(f"User {username} authenticated from {client_ip}")
                    else:
                        await websocket.send(json.dumps({
                            "type": "auth_response",
                            "success": False,
                            "message": "Invalid credentials"
                        }))
                        logger.warning(f"Failed authentication attempt from {client_ip}")
                
                # Handle train control commands
                elif data.get('type') == 'command':
                    if not authenticated:
                        await websocket.send(json.dumps({
                            "type": "error",
                            "message": "Authentication required"
                        }))
                        continue
                    
                    # Process the train velocity command
                    velocity = data['value']
                    setVoltageCommand = get_voltage(int(velocity))
                    # linuxCommand = f"echo -n -e {setVoltageCommand} > /dev/ttyUSB0"
                    # print(linuxCommand)
                    command_bytes = bytes.fromhex(setVoltageCommand.replace('\\x', ''))

                    try:
                        with serial.Serial('/dev/ttyUSB0', 9600, timeout=1) as ser:
                            ser.write(command_bytes)
                    except serial.serialutil.SerialException as e:
                        await websocket.send(json.dumps({
                            "type": "command_response",
                            "success": False,
                            "message": str(e)
                        }))
                        continue

                    # subprocess.run(f"sh -c \"{linuxCommand}\"", shell=True)
                    logger.info(f"User {username} set velocity to {velocity}")
                    log_command(username, "velocity", velocity)
                    
                    # Here you would add code to actually control the train
                    # For example, interfacing with hardware or other systems
                    
                    await websocket.send(json.dumps({
                        "type": "command_response",
                        "success": True,
                        "message": f"Velocity set to: {velocity}"
                    }))
                
                # Handle gate control
                elif data.get('type') == 'gate':
                    if not authenticated:
                        await websocket.send(json.dumps({
                            "type": "error",
                            "message": "Authentication required"
                        }))
                        continue
                    
                    # Process the gate command
                    action = data['action']
                    logger.info(f"User {username} sent gate command: {action}")
                    log_command(username, "gate", action)
                    if action=="Open":
                        print("&&&&")
                        client.write_coil(8195, False)
                    else:
                        print("****")
                        client.write_coil(8195, True)
                    # Here you would add code to actually control the gate
                    # For example, interfacing with hardware or other systems
                    
                    await websocket.send(json.dumps({
                        "type": "gate_response",
                        "success": True,
                        "message": f"Gate {action} command executed"
                    }))
                # Handle fan control
                elif data.get('type') == 'turbine':
                    if not authenticated:
                        await websocket.send(json.dumps({
                            "type": "error",
                            "message": "Authentication required"
                        }))
                        continue
                    
                    # Process the gate command
                    action = data['action']
                    logger.info(f"User {username} sent gate command: {action}")
                    log_command(username, "gate", action)
                    if action=="Start":
                        print("&&&&")
                        client.write_coil(8193, True)
                    else:
                        print("****")
                        client.write_coil(8193, False)
                    # Here you would add code to actually control the gate
                    # For example, interfacing with hardware or other systems
                    
                    await websocket.send(json.dumps({
                        "type": "turbine_response",
                        "success": True,
                        "message": f"Turbine {action} command executed"
                    }))
                else:
                    logger.warning(f"Unknown message type received: {data.get('type', 'undefined')}")
                    await websocket.send(json.dumps({
                        "type": "error",
                        "message": "Unknown command type"
                    }))
                    
            except json.JSONDecodeError:
                logger.error(f"Invalid JSON received from {client_ip}")
                await websocket.send(json.dumps({
                    "type": "error",
                    "message": "Invalid message format"
                }))
                
    except websockets.exceptions.ConnectionClosed:
        logger.info(f"Connection closed from {client_ip}")
    finally:
        if websocket in authenticated_clients:
            del authenticated_clients[websocket]
            logger.info(f"User {username} disconnected")

# HTTP handler for gate control (alternative access method)
class GateControlHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        # Just return a simple message for SSL certificate verification
        self.send_response(200)
        self.send_header('Content-type', 'text/html')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(b"<html><body><h1>Train Control Server</h1><p>The HTTPS server is running properly.</p></body></html>")
    
    def do_POST(self):
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length).decode('utf-8')
        
        # Add CORS headers
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        
        try:
            data = json.loads(post_data)
            
            # Check authentication token
            if 'token' not in data:
                self.wfile.write(json.dumps({
                    "success": False,
                    "message": "Authentication required"
                }).encode())
                return
            
            # Decode token (in production, use proper JWT validation)
            try:
                token_parts = base64.b64decode(data['token']).decode('utf-8').split(':')
                username = token_parts[0]
                
                # In a real system, you'd validate this token properly
                # For demo purposes, we're just checking if the username exists
                users = load_credentials()
                if username not in users:
                    self.wfile.write(json.dumps({
                        "success": False,
                        "message": "Invalid authentication token"
                    }).encode())
                    return
                
            except Exception as e:
                logger.error(f"Token validation error: {str(e)}")
                self.wfile.write(json.dumps({
                    "success": False,
                    "message": "Invalid authentication token"
                }).encode())
                return
            
            # Process gate command
            action = data['action']
            logger.info(f"HTTP: User {username} sent gate command: {action}")
            log_command(username, "gate_http", action)
            
            # Here you would add code to actually control the gate
            
            self.wfile.write(json.dumps({
                "success": True,
                "message": f"Gate {action} command executed"
            }).encode())
            
        except json.JSONDecodeError:
            self.wfile.write(json.dumps({
                "success": False,
                "message": "Invalid JSON format"
            }).encode())
        except KeyError as e:
            self.wfile.write(json.dumps({
                "success": False,
                "message": f"Missing required field: {str(e)}"
            }).encode())
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

# Create and configure SSL context for secure WebSocket
def create_ssl_context():
    ssl_context = ssl.create_default_context(ssl.Purpose.CLIENT_AUTH)
    
    cert_path = 'cert/server.crt'
    key_path = 'cert/server.key'
    
    # Check if certificates exist, create self-signed if not
    if not (os.path.exists(cert_path) and os.path.exists(key_path)):
        logger.info("SSL certificates not found. Creating self-signed certificates...")
        os.makedirs('cert', exist_ok=True)
        
        # Create self-signed certificate with broader compatibility
        os.system(f'openssl req -x509 -newkey rsa:4096 -keyout {key_path} -out {cert_path} -days 365 -nodes -subj "/CN=localhost" -addext "subjectAltName = DNS:localhost,IP:127.0.0.1"')
        
        if not (os.path.exists(cert_path) and os.path.exists(key_path)):
            logger.error("Failed to create SSL certificates. Please create them manually.")
            return None
    
    ssl_context.load_cert_chain(cert_path, key_path)
    return ssl_context

# Start HTTP server for gate control
def run_http_server():
    server = HTTPServer(('0.0.0.0', 8001), GateControlHandler)
    
    # Set up SSL for HTTPS
    ssl_context = create_ssl_context()
    if ssl_context:
        server.socket = ssl_context.wrap_socket(server.socket, server_side=True)
        logger.info("Starting secure HTTPS server on port 8001")
    else:
        logger.warning("Starting unsecure HTTP server on port 8001")
    
    server.serve_forever()

# Get websockets version to determine which API to use
def get_websockets_version():
    try:
        return websockets.__version__
    except AttributeError:
        # If __version__ is not available, assume it's a newer version
        return "10.0.0"  # Arbitrary high version

# Main function
async def main():
    # Ensure command log file exists
    if not os.path.exists("command_log.txt"):
        with open("command_log.txt", "w") as f:
            f.write("# Command Log\n")
            
    # Start HTTP server in a separate thread
    http_thread = threading.Thread(target=run_http_server, daemon=True)
    http_thread.start()
    
    # Set up SSL for WebSocket server
    ssl_context = create_ssl_context()
    if not ssl_context:
        logger.error("Failed to create SSL context. Exiting.")
        return    
    # Determine how to start the server based on websockets version
    ws_version = get_websockets_version()
    logger.info(f"Using websockets library version: {ws_version}")
    
    # Start WebSocket server with SSL
    server = await websockets.serve(
        websocket_handler, 
        "0.0.0.0", 
        8000, 
        ssl=ssl_context,
        ping_interval=30,
        ping_timeout=10
    )
    
    logger.info("WebSocket server started on wss://0.0.0.0:8000")
    await asyncio.Future()  # Run forever

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Server shutdown by user")
