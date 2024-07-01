const express = require('express');
const mc = require('minecraft-protocol');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.static('public'));
app.use(express.json());

// Endpoint to fetch Minecraft server favicon
app.get('/api/png/:serverip', (req, res) => {
  const serverip = req.params.serverip;
  let [serverHost, serverPort] = serverip.split(':');
  serverPort = serverPort ? parseInt(serverPort) : 25565;

  mc.ping({
    host: serverHost,
    port: serverPort
  }, (err, response) => {
    if (err) {
      console.error(err);
      res.status(500).send('Error fetching server favicon');
    } else {
      if (response.favicon) {
        const faviconData = response.favicon.split(',')[1];
        const faviconBuffer = Buffer.from(faviconData, 'base64');

        res.set('Content-Type', 'image/png');
        res.send(faviconBuffer);
      } else {
        res.status(404).send('Server favicon not found');
      }
    }
  });
});

// Endpoint to fetch Minecraft server status
app.get('/api/status/:serverAddress', (req, res) => {
  const [serverHost, serverPort] = req.params.serverAddress.split(':');
  const port = serverPort ? parseInt(serverPort, 10) : 25565;

  mc.ping({
    host: serverHost,
    port: port
  }, (err, response) => {
    if (err) {
      console.error(err);
      res.status(500).json({ error: 'offline' });
    } else {
      let description;
      if (response.description && typeof response.description === 'object' && response.description.extra) {
        description = response.description.extra.map(component => component.text || '').join('');
      } else if (typeof response.description === 'string') {
        description = response.description;
      } else {
        description = 'Unknown description format';
      }

      const serverInfo = {
        version: response.version,
        players: response.players,
        description: description,
        latency: response.latency
      };

      res.json(serverInfo);
    }
  });
});

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// Serve the server status page with pre-filled input
app.get('/:serverIp', (req, res) => {
  const serverIp = req.params.serverIp;
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <title>mcstatus.is-a.dev</title>
      <link rel="icon" href="/favicon.png" type="image/png">
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: 'Courier New', Courier, monospace;
          margin: 0;
          padding: 0;
          background-color: #0d1117;
          color: white;
          display: flex;
          flex-direction: column;
          min-height: 100vh;
          overflow-x: hidden;
        }
        .top-nav {
          display: flex;
          justify-content: center;
          padding: 20px;
          background-color: rgba(0, 0, 0, 0.5);
        }
        .top-nav a {
          color: white;
          text-decoration: none;
          margin: 0 15px;
          font-size: 18px;
          padding: 10px;
          border-radius: 8px;
          transition: background-color 0.3s, border-color 0.3s;
        }
        .top-nav a:hover, .top-nav a.active {
          background-color: #1f2937;
        }
        .main-content {
          flex-grow: 1;
          padding: 20px;
          overflow-y: auto;
          background-color: rgba(0, 0, 0, 0.5);
        }
        input[type="text"] {
          padding: 10px;
          font-size: 16px;
          margin: 20px 0;
          width: 300px;
          background-color: #161b22;
          color: #c9d1d9;
          border: 1px solid #30363d;
          border-radius: 5px;
        }
        button {
          padding: 10px 20px;
          font-size: 16px;
          background-color: #238636;
          color: #ffffff;
          border: none;
          border-radius: 5px;
          cursor: pointer;
        }
        .server-info {
          margin-top: 20px;
          display: flex;
          align-items: center;
          justify-content: flex-start;
        }
        .server-info img {
          margin-right: 20px;
        }
        .footer {
          position: absolute;
          bottom: 10px;
          right: 10px;
          color: #2196F3;
          font-weight: bold;
          cursor: pointer;
        }
      </style>
    </head>
    <body>
      <div class="top-nav">
        <a href="/" class="active">Home</a>
        <a href="/api/docs">API</a>
      </div>
      <div class="main-content">
        <form id="serverForm" onsubmit="navigateToServer(event)">
          <input type="text" id="serverIp" value="${serverIp}" required>
          <button type="submit">Get Status</button>
        </form>
        <div id="result" class="server-info"></div>
        <div class="footer" onclick="window.location.href='https://github.com/EducatedSuddenBucket'">Made By EducatedSuddenBucket</div>
      </div>
      <script>
        function navigateToServer(event) {
          event.preventDefault();
          const serverIp = document.getElementById('serverIp').value;
          window.location.href = '/' + serverIp;
        }

        async function getStatus() {
          const serverIp = "${serverIp}";
          const resultDiv = document.getElementById('result');
          resultDiv.innerHTML = '';

          try {
            const statusResponse = await fetch('/api/status/' + serverIp);
            const status = await statusResponse.json();

            const faviconResponse = await fetch('/api/png/' + serverIp);
            const faviconUrl = faviconResponse.status === 200 ? '/api/png/' + serverIp : '/favicon.png';

            if (status.error === 'offline') {
              resultDiv.innerHTML = '<p>Server is Offline</p>';
            } else {
              resultDiv.innerHTML = \`
                <img src="\${faviconUrl}" alt="Server Favicon" width="64" height="64">
                <div>
                  <p><strong>Version:</strong> \${status.version.name}</p>
                  <p><strong>Players:</strong> \${status.players.online}/\${status.players.max}</p>
                  <p><strong>Description:</strong> \${status.description}</p>
                  <p><strong>Latency(From Frankfurt):</strong> \${status.latency} ms</p>
                </div>
              \`;
            }
          } catch (error) {
            resultDiv.innerHTML = '<p>Failed to fetch server status</p>';
          }
        }

        // Automatically fetch status when the page loads
        getStatus();
      </script>
    </body>
    </html>
  `);
});

// Serve the API docs page
app.get('/api/docs', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <title>mcstatus.is-a.dev - API Docs</title>
      <link rel="icon" href="/favicon.png" type="image/png">
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: 'Courier New', Courier, monospace;
          margin: 0;
          padding: 0;
          background-color: #0d1117;
          color: white;
          display: flex;
          flex-direction: column;
          min-height: 100vh;
          overflow-x: hidden;
        }
        .top-nav {
          display: flex;
          justify-content: center;
          padding: 20px;
          background-color: rgba(0, 0, 0, 0.5);
        }
        .top-nav a {
          color: white;
          text-decoration: none;
          margin: 0 15px;
          font-size: 18px;
          padding: 10px;
          border-radius: 8px;
          transition: background-color 0.3s, border-color 0.3s;
        }
        .top-nav a:hover, .top-nav a.active {
          background-color: #1f2937;
        }
        .main-content {
          flex-grow: 1;
          padding: 20px;
          overflow-y: auto;
          background-color: rgba(0, 0, 0, 0.5);
        }
        .api-section {
          margin-top: 20px;
        }
        pre {
          background-color: #161b22;
          color: #c9d1d9;
          padding: 10px;
          border-radius: 5px;
          overflow-x: auto;
        }
        .footer {
          position: absolute;
          bottom: 10px;
          right: 10px;
          color: #2196F3;
          font-weight: bold;
          cursor: pointer;
        }
      </style>
    </head>
    <body>
      <div class="top-nav">
        <a href="/">Home</a>
        <a href="/api/docs" class="active">API</a>
      </div>
      <div class="main-content">
        <h1>API Documentation</h1>
        <div class="api-section">
          <h2>Server Status</h2>
          <p>Endpoint: <code>/api/status/:serverAddress</code></p>
          <p>Method: GET</p>
          <p>Response (Online):</p>
          <pre>{
  "version": {
    "name": "1.16.5",
    "protocol": 754
  },
  "players": {
    "max": 20,
    "online": 5,
    "sample": []
  },
  "description": "A Minecraft Server",
  "latency": 123
}</pre>
          <p>Response (Offline):</p>
          <pre>{
  "error": "offline"
}</pre>
        </div>
        <div class="api-section">
          <h2>Server Icon</h2>
          <p>Endpoint: <code>/api/png/:serverAddress</code></p>
          <p>Method: GET</p>
          <p>Response: Image (PNG)</p>
        </div>
        <div class="footer" onclick="window.location.href='https://github.com/EducatedSuddenBucket'">Made By EducatedSuddenBucket</div>
      </div>
    </body>
    </html>
  `);
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
