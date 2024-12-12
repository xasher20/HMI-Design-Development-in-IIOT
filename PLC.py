Python 3.13.1 (tags/v3.13.1:0671451, Dec  3 2024, 19:06:28) [MSC v.1942 64 bit (AMD64)] on win32
Type "help", "copyright", "credits" or "license()" for more information.
>>> from pymodbus.client import ModbusTcpClient  # Updated import
... # PLC's IP address and port
... PLC_IP = '192.168.56.1'  # Replace with your PLC's IP
... PLC_PORT = 502  # Default Modbus TCP port
... # Create Modbus client
... client = ModbusTcpClient(PLC_IP, port=PLC_PORT)
... # Modbus address for output Y1
... output_address = 8197  # Y0 is 8192, Y1 is 8193
... # Connect to the PLC
... if client.connect():  # Ensure the connection is established
...     # Set Y1 (turn it ON)
...     result = client.write_coil(output_address, False)  # True = ON, False = OFF
...     if not result.isError():
...         print("Output Y1 has been set to ON")
...     else:
...         print("Failed to set output Y1")
...     client.close()
... else:
