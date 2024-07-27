const express = require('express');
const mc = require('minecraft-protocol');
const bedrockPing = require('bedrock-protocol').ping;
const app = express();
const port = process.env.PORT || 3000;

app.use(express.static('public'));
app.use(express.json());

function extractText(obj) {
  let text = '';
  if (typeof obj === 'string') {
    return obj;
  }
  if (obj.text) {
    text += obj.text;
  }
  if (obj.extra) {
    for (let item of obj.extra) {
      text += extractText(item);
    }
  }
  return text;
}

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
      res.status(500).json({ error: 'offline or no favicon' });
    } else {
      if (response.favicon) {
        const faviconData = response.favicon.split(',')[1];
        const faviconBuffer = Buffer.from(faviconData, 'base64');

        res.set('Content-Type', 'image/png');
        res.send(faviconBuffer);
      } else {
        res.status(404).json({ error: 'offline or no favicon' });
      }
    }
  });
});

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
      let description = '';
      if (typeof response.description === 'string') {
        description = response.description;
      } else if (response.description) {
        description = extractText(response.description);
      }

      const serverInfo = {
        version: response.version,
        players: {
          max: response.players.max,
          online: response.players.online,
          list: response.players.sample || []
        },
        description: description,
        latency: response.latency,
        favicon: response.favicon
      };

      res.json(serverInfo);
    }
  });
});

app.get('/api/status/bedrock/:serverAddress', (req, res) => {
  const [serverHost, serverPort] = req.params.serverAddress.split(':');
  const port = serverPort ? parseInt(serverPort, 10) : 19132;

  const options = {
    host: serverHost,
    port: port,
    timeout: 5000
  };

  bedrockPing(options)
    .then((response) => {
      const serverInfo = {
        motd: response.motd,
        levelName: response.levelName,
        playersOnline: response.playersOnline,
        playersMax: response.playersMax,
        gamemode: response.gamemode,
        serverId: response.serverId,
        gamemodeId: response.gamemodeId,
        portV4: response.portV4,
        portV6: response.portV6,
        protocol: response.protocol,
        version: response.version
      };

      res.json(serverInfo);
    })
    .catch((error) => {
      console.error('Ping failed:', error);
      res.status(500).json({ error: 'offline' });
    });
});

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

app.get('/:serverIp', (req, res) => {
  const serverIp = req.params.serverIp;
  serveStatusPage(res, serverIp, 'java');
});

app.get('/bedrock/:serverIp', (req, res) => {
  const serverIp = req.params.serverIp;
  serveStatusPage(res, serverIp, 'bedrock');
});

function serveStatusPage(res, serverIp, edition) {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <title>mcstatus.is-a.dev</title>
  <link rel="icon" href="icon_static.png" type="image/png">
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
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background-color: rgba(0, 0, 0, 0.5);
        }
        .input-group {
          display: flex;
          align-items: center;
          margin: 20px 0;
        }
        .input-group img {
          margin-right: 10px;
        }
        input[type="text"] {
          padding: 10px;
          font-size: 16px;
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
          margin-left: 10px;
        }
        .server-info {
          margin-top: 20px;
          display: flex;
          align-items: flex-start;
          justify-content: flex-start;
          width: 100%;
          max-width: 600px;
        }
        .server-info img {
          margin-right: 20px;
        }
        .server-details {
          flex-grow: 1;
        }
        .footer {
          position: absolute;
          bottom: 10px;
          right: 10px;
          color: #2196F3;
          font-weight: bold;
          cursor: pointer;
        }
        .motd {
          font-family: 'Minecraft', monospace;
          white-space: pre-wrap;
        }
        .player-list {
          margin-top: 10px;
          max-height: 200px;
          overflow-y: auto;
        }
        .edition-switch {
          margin-top: 10px;
        }
        .edition-switch label {
          margin-right: 10px;
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
          <div class="input-group">
            <img src="icon.gif" width="25" height="25" alt="Minecraft Compass">
            <input type="text" id="serverIp" value="${serverIp}" required>
            <button type="submit">Get Status</button>
          </div>
        </form>
        <div class="edition-switch">
          <label>
            <input type="radio" name="edition" value="java" ${edition === 'java' ? 'checked' : ''}> Java
          </label>
          <label>
            <input type="radio" name="edition" value="bedrock" ${edition === 'bedrock' ? 'checked' : ''}> Bedrock
          </label>
        </div>
        <div id="result" class="server-info"></div>
        <div class="footer" onclick="window.location.href='https://github.com/EducatedSuddenBucket'">Made By EducatedSuddenBucket</div>
      </div>
      <script>
        function navigateToServer(event) {
          event.preventDefault();
          const serverIp = document.getElementById('serverIp').value;
          const edition = document.querySelector('input[name="edition"]:checked').value;
          window.location.href = edition === 'bedrock' ? '/bedrock/' + serverIp : '/' + serverIp;
        }

        async function getStatus() {
          const serverIp = "${serverIp}";
          const edition = "${edition}";
          const resultDiv = document.getElementById('result');
          resultDiv.innerHTML = '';

          try {
            const statusResponse = await fetch(edition === 'bedrock' ? '/api/status/bedrock/' + serverIp : '/api/status/' + serverIp);
            const status = await statusResponse.json();

            if (status.error === 'offline') {
              resultDiv.innerHTML = '<p>Server is Offline</p>';
            } else if (edition === 'java') {
              let playerList = '';
              if (status.players.list && status.players.list.length > 0) {
                playerList = '<div class="player-list"><h3>Online Players:</h3><ul>';
                status.players.list.forEach(player => {
                  playerList += \`<li>\${player.name}</li>\`;
                });
                playerList += '</ul></div>';
              }

              resultDiv.innerHTML = \`
                <img src="/api/png/\${serverIp}" alt="Server Favicon" width="64" height="64" onerror="this.src='/favicon.png'">
                <div class="server-details">
                  <p><strong>Version:</strong> \${status.version.name}</p>
                  <p><strong>Players:</strong> \${status.players.online}/\${status.players.max}</p>
                  <p><strong>Description:</strong></p>
                  <div class="motd">\${status.description}</div>
                  <p><strong>Latency:</strong> \${status.latency} ms</p>
                  \${playerList}
                </div>
              \`;
            } else { // Bedrock
              resultDiv.innerHTML = \`
                <div class="server-details">
                  <p><strong>MOTD:</strong> \${status.motd}</p>
                  <p><strong>Version:</strong> \${status.version}</p>
                  <p><strong>Players:</strong> \${status.playersOnline}/\${status.playersMax}</p>
                  <p><strong>Gamemode:</strong> \${status.gamemode}</p>
                  <p><strong>Level Name:</strong> \${status.levelName}</p>
                  <p><strong>Protocol:</strong> \${status.protocol}</p>
                </div>
              \`;
            }
          } catch (error) {
            resultDiv.innerHTML = '<p>Failed to fetch server status</p>';
          }
        }

        // Automatically fetch status when the page loads
        getStatus();

        // Add event listener to update status when edition is changed
        document.querySelectorAll('input[name="edition"]').forEach(radio => {
          radio.addEventListener('change', () => {
            navigateToServer(new Event('submit'));
          });
        });
      </script>
    </body>
    </html>
  `);
}

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
    "list": [
      {
        "name": "EducatedSuddenBucket",
        "id": "uuid1"
      },
      {
        "name": "SomeoneElseInTheServer",
        "id": "uuid2"
      }
    ]
  },
  "description": "A Minecraft Server",
  "latency": 123,
  "favicon": "data:image/png;base64,..."
}</pre>
          <p>Response (Offline):</p>
          <pre>{
  "error": "offline"
}</pre>
        </div>
        <div class="api-section">
          <h2>Server Icon(Java Only)</h2>
          <p>Endpoint: <code>/api/png/:serverAddress</code></p>
          <p>Method: GET</p>
          <p>Response: Image (PNG)</p>
          <p>Response (Error):</p>
          <pre>{
 "error": "offline or no favicon"
}</pre>
        </div>
        <div class="api-section">
          <h2>Bedrock Server Status</h2>
          <p>Endpoint: <code>/api/status/bedrock/:serverAddress</code></p>
          <p>Method: GET</p>
          <p>Response (Online):</p>
          <pre>{
  "motd": "Dedicated Server",
  "levelName": "Bedrock level",
  "playersOnline": 0,
  "playersMax": 10,
  "gamemode": "Survival",
  "serverId": "13460148391903423507",
  "gamemodeId": 1,
  "portV4": 19132,
  "portV6": 19133,
  "protocol": "686",
  "version": "1.21.3"
}</pre>
          <p>Response (Offline):</p>
          <pre>{
  "error": "offline"
}</pre>
        </div>
      </div>
    </body>
    </html>
  `);
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
