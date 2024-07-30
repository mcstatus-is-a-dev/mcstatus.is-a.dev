const express = require('express');
const mc = require('minecraft-protocol');
const bedrockPing = require('bedrock-protocol').ping;
const serveStatusPage = require('./statusPageTemplate');
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

app.get('/api/docs', (req, res) => {
  res.sendFile(__dirname + '/public/api-docs.html');
});


app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
