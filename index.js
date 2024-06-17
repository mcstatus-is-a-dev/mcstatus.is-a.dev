const express = require('express');
const mc = require('minecraft-protocol');
const app = express();
const port = process.env.PORT || 443; // Use port 443 by default, or environment variable if set

app.use(express.static('public')); // Serve static files from the 'public' directory
app.use(express.json()); // Parse JSON request bodies

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
  const port = serverPort ? parseInt(serverPort, 10) : 25565; // Default Minecraft server port

  mc.ping({
    host: serverHost,
    port: port
  }, (err, response) => {
    if (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to ping server' });
    } else {
      // Extract the server description
      let description;
      if (response.description && typeof response.description === 'object' && response.description.extra) {
        // Handle BungeeCord server descriptions
        description = response.description.extra.map(component => component.text || '').join('');
      } else if (typeof response.description === 'string') {
        // Handle regular Minecraft server descriptions
        description = response.description;
      } else {
        // Fallback for unknown response formats
        description = 'Unknown description format';
      }

      // Create a new object with the server info
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
    <html>
    <head>
      <title>mcstatus.is-a.dev</title>
      <link rel="icon" href="/favicon.png" type="image/png">
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          background-color: #0d1117;
          color: #c9d1d9;
          font-family: Arial, sans-serif;
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          margin: 0;
          text-align: center;
        }
        .container {
          text-align: center;
        }
        .server-info {
          margin-top: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .server-info img {
          margin-right: 20px;
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
      <div class="container">
        <form id="serverForm" onsubmit="navigateToServer(event)">
          <input type="text" id="serverIp" value="${serverIp}" required>
          <button type="submit">Get Status</button>
        </form>
        <div id="result" class="server-info"></div>
      </div>
      <script>
        async function getStatus() {
          const serverIp = "${serverIp}";
          const resultDiv = document.getElementById('result');
          resultDiv.innerHTML = '';

          try {
            const statusResponse = await fetch('/api/status/' + serverIp);
            const status = await statusResponse.json();

            const faviconResponse = await fetch('/api/png/' + serverIp);
            const faviconUrl = faviconResponse.status === 200 ? '/api/png/' + serverIp : '/favicon.png';

            resultDiv.innerHTML = \`
              <img src="\${faviconUrl}" alt="Server Favicon" width="64" height="64">
              <div>
                <p><strong>Version:</strong> \${status.version.name}</p>
                <p><strong>Players:</strong> \${status.players.online}/\${status.players.max}</p>
                <p><strong>Description:</strong> \${status.description}</p>
                <p><strong>Latency(From Frankfurt):</strong> \${status.latency} ms</p>
              </div>
              <div class="footer" onclick="window.location.href='https://github.com/EducatedSuddenBucket'">Made By EducatedSuddenBucket</div>
            \`;
          } catch (error) {
            resultDiv.textContent = 'Failed to fetch server status';
          }
        }

        async function navigateToServer(event) {
          event.preventDefault();
          const serverIp = document.getElementById('serverIp').value;
          window.location.href = \`/${serverIp}\`;
        }

        // Automatically fetch status when the page loads
        getStatus();
      </script>
    </body>
    </html>
  `);
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
