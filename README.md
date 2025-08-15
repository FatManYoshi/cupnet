# CupNet - Advanced Network Monitoring Tool

![Main Interface](docs/image/main.png)

CupNet is a powerful Electron-based desktop application designed for comprehensive network traffic monitoring, debugging, and analysis. It provides advanced features for tracking HTTP/HTTPS requests, WebSocket communications, and capturing browser screenshots with proxy support.

## Features

- **Complete Network Traffic Monitoring**: Track all HTTP/HTTPS requests and responses with detailed information
- **WebSocket Monitoring**: Capture and analyze WebSocket connections, frames, errors, and closures
- **Proxy Support**: Configure and quickly change proxies without session reload
- **Automatic Screenshots**: Capture browser screenshots at regular intervals or based on activity
- **Advanced Log Viewer**: Filter, search, and analyze network logs with a user-friendly interface
- **Copy as cURL**: Generate cURL commands for any request with a single click
- **Activity-Based Monitoring**: Intelligent screenshot capture based on window activity and mouse movement

![Browser Interface](docs/image/browser.png)

## Installation

### Prerequisites

- Node.js (v14.0.0 or higher)
- npm (v6.0.0 or higher)
- Electron (v13.0.0 or higher)

### 1. Install from Release (no build needed)

> Auto-update is **disabled**. Download the latest installers from the **Releases** page and install manually.

#### macOS
1. Download `MacOS_CupNet-2025.8.15.dmg` from **Releases**.
2. Open the `.dmg` and drag **CupNet** to **Applications**.
3. If Gatekeeper warns, right-click the app → **Open**.

#### Windows
1. Download `Windows_CupNet-2025.8.15.exe`.
2. Run the installer; if SmartScreen warns, choose **More info → Run anyway**.

#### Linux (AppImage)
1. Download `Linux_CupNet-2025.8.15.AppImage`.
2. Make it executable and run:
   ```bash
   chmod +x Linux_CupNet-2025.8.15.AppImage
   ./Linux_CupNet-2025.8.15.AppImage
   

### 2. Setup (build needed)

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/cupnet.git
   cd cupnet
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the application:
   ```bash
   npm start
   ```

## Usage

### Basic Navigation

1. **Main Browser Window**: Navigate to any website using the address bar
2. **Log Viewer**: Access detailed logs by clicking the "Logs" button
3. **Proxy Selector**: Configure and select proxies from the "Proxy" menu

### Proxy Configuration

1. Open the Proxy Selector from the main menu
2. Enter proxy details in the format `http://username:password@host:port`
3. Enable "Auto Screenshots" checkbox if you want automatic screenshots every 5 seconds
4. Click "Apply" to use the selected proxy

### Quick Proxy Change

1. Click the "Quick Proxy" button in the main interface
2. Enter the new proxy URL
3. Click "Apply" to change the proxy without reloading the session

### Log Viewer

![Log Viewer Interface](docs/image/log.png)

The Log Viewer provides a comprehensive interface for analyzing network traffic:

- **Filtering**: Filter logs by type (HTTP, WebSocket, Screenshot) or status code
- **Search**: Search for specific URLs or paths
- **Details View**: Click on any log entry to view detailed information
- **Copy as cURL**: Generate and copy cURL commands for any request
- **Screenshot Viewer**: View, save, or copy captured screenshots
- **JSONL File Support**: Open and analyze saved log files in JSONL format

### WebSocket Monitoring

CupNet provides detailed monitoring of WebSocket communications:

- **Connection Tracking**: Monitor WebSocket connections and handshakes
- **Frame Analysis**: View the content of sent and received WebSocket frames
- **Error Logging**: Track and analyze WebSocket errors
- **Connection Statistics**: View duration and frame count for closed connections

## Examples

### Monitoring API Requests

1. Navigate to a website that makes API requests
2. Open the Log Viewer
3. Filter by type "fetch" or "xhr"
4. Click on any request to view headers, payload, and response

### Debugging WebSocket Communications

1. Connect to a website that uses WebSockets
2. Open the Log Viewer
3. Filter by type "websocket" or "websocket_frame"
4. Analyze the WebSocket frames to debug communication issues

### Capturing Activity-Based Screenshots

1. Enable "Auto Screenshots" in the Proxy Selector
2. The application will automatically capture screenshots when:
   - The window is active, OR
   - The mouse has moved in the window within the last 30 seconds

## Architecture

CupNet is built on Electron with a modular architecture:

- **Main Process** (`main.js`): Handles core application functionality, proxy management, and screenshot capture
- **Renderer Process**: Manages the user interface and interaction
- **Chrome DevTools Protocol**: Used for network monitoring and WebSocket tracking
- **ProxyChain**: Provides proxy server functionality with authentication support

## Comparison with Alternatives

After evaluating numerous network monitoring tools, CupNet was developed to address the limitations found in existing solutions. Here's how CupNet compares to similar applications:

### Alternatives Evaluated

- **Charles Proxy**: A powerful tool but with a steep learning curve. Requires significant configuration for proxy settings and doesn't integrate screenshot functionality. WebSocket support is limited compared to CupNet's comprehensive frame analysis.

- **Fiddler**: Offers good HTTP inspection but has limited WebSocket support. The proxy configuration is more complex and requires manual setup for each session. Lacks the activity-based monitoring features of CupNet.

- **Wireshark**: Extremely powerful but overwhelming for many users. Operates at a lower network level, making it difficult to isolate specific application traffic. No built-in proxy support or screenshot capabilities.

- **Browser DevTools**: Native tools in browsers like Chrome and Firefox offer basic network monitoring but lack proxy integration, persistent logging, and the ability to capture screenshots automatically.

### CupNet Advantages

- **Simplified Proxy Integration**: CupNet allows you to capture traffic with or without proxies with minimal configuration. The quick proxy change feature eliminates the need for session reloads.

- **Intuitive Interface**: Designed for ease of use without sacrificing powerful features. The log viewer provides clear organization of different request types.

- **Comprehensive WebSocket Support**: Full lifecycle monitoring of WebSocket connections with detailed frame analysis that many alternatives lack.

- **Intelligent Screenshot Capture**: Activity-based screenshot functionality that optimizes resource usage while ensuring you capture important visual states.

- **All-in-One Solution**: Combines network monitoring, proxy management, and screenshot capabilities in a single application without requiring complex setup or configuration.

CupNet was specifically designed to eliminate the frustrations encountered with other tools, providing a streamlined experience for developers and testers who need to monitor network activity efficiently.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Contact

Project Maintainer - elv1bro
GitHub: [https://github.com/elv1bro/cupnet](https://github.com/elv1bro/cupnet)
