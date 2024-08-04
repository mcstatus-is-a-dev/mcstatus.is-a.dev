// statusPageTemplate.js
function serveStatusPage(res, serverIp, edition) {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <title>mcstatus</title>
      <link rel="icon" href="https://mcstatus.is-a.dev/icon_static.png" type="image/png">
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
            <img src="https://mcstatus.is-a.dev/icon.gif" width="25" height="25" alt="IDK">
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

            if (status.error) {
              resultDiv.innerHTML = '<p>Server is Offline</p>';
              return;
            }

            if (edition === 'java') {
              let playerList = '';
              if (status.players && status.players.list && status.players.list.length > 0) {
                playerList = '<div class="player-list"><h3>Online Players:</h3><ul>';
                status.players.list.forEach(player => {
                  playerList += \`<li>\${player.name}</li>\`;
                });
                playerList += '</ul></div>';
              }

              resultDiv.innerHTML = \`
                <img src="/api/png/\${serverIp}" alt="Server Favicon" width="64" height="64" onerror="this.src='/icon.gif'">
                <div class="server-details">
                  <p><strong>Version:</strong> \${status.version ? status.version.name : 'Unknown'}</p>
                  <p><strong>Players:</strong> \${status.players ? \`\${status.players.online}/\${status.players.max}\` : 'Unknown'}</p>
                  <p><strong>Description:</strong></p>
                  <div class="motd">\${status.description || 'No description available'}</div>
                  <p><strong>Latency(Central Europe):</strong> \${status.latency !== undefined ? \`\${status.latency} ms\` : 'Unknown'}</p>
                  \${playerList}
                </div>
              \`;
            } else { // Bedrock
              resultDiv.innerHTML = \`
                <div class="server-details">
                  <p><strong>MOTD:</strong> \${status.motd || 'Unknown'}</p>
                  <p><strong>Version:</strong> \${status.version || 'Unknown'}</p>
                  <p><strong>Players:</strong> \${status.playersOnline !== undefined && status.playersMax !== undefined ? \`\${status.playersOnline}/\${status.playersMax}\` : 'Unknown'}</p>
                  <p><strong>Gamemode:</strong> \${status.gamemode || 'Unknown'}</p>
                  <p><strong>Level Name:</strong> \${status.levelName || 'Unknown'}</p>
                  <p><strong>Protocol:</strong> \${status.protocol || 'Unknown'}</p>
                  <p><strong>Latency(Central Europe):</strong> \${status.latency !== undefined ? \`\${status.latency} ms\` : 'Unknown'}</p>
                </div>
              \`;
            }
          } catch (error) {
            console.error('Error fetching server status:', error);
            resultDiv.innerHTML = '<p>Server is Offline</p>';
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

module.exports = serveStatusPage;
