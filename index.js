const express = require('express');
const net = require('net');
const dns = require('dns');
const dgram = require('dgram');
const https = require('https');
const http = require('http');
const serveStatusPage = require('./statusPageTemplate');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.static('public'));
app.use(express.json());

// Java Edition Pinger
function createVarInt(value) {
  const bytes = [];
  while (true) {
    if ((value & 0xffffff80) === 0) {
      bytes.push(value);
      return Buffer.from(bytes);
    }
    bytes.push(value & 0x7f | 0x80);
    value >>>= 7;
  }
}

function createPacket(id, data) {
  const idBuffer = createVarInt(id);
  const lengthBuffer = createVarInt(idBuffer.length + data.length);
  return Buffer.concat([lengthBuffer, idBuffer, data]);
}

function readVarInt(buffer, offset) {
  let value = 0;
  let size = 0;
  let byte;
  do {
    byte = buffer[offset++];
    value |= (byte & 0x7f) << (size++ * 7);
    if (size > 5) {
      throw new Error('VarInt is too big');
    }
  } while (byte & 0x80);
  return [value, offset];
}

function connectToJavaServer(host, port) {
  return new Promise((resolve, reject) => {
    const client = new net.Socket();
    let buffer = Buffer.alloc(0);
    let serverInfo;
    let pingStartTime;

    client.connect(port, host, () => {
      const hostBuffer = Buffer.from(host, 'utf8');
      const portBuffer = Buffer.alloc(2);
      portBuffer.writeUInt16BE(port, 0);
      const handshakeData = Buffer.concat([
        createVarInt(47),
        createVarInt(hostBuffer.length),
        hostBuffer,
        portBuffer,
        createVarInt(1)
      ]);
      const handshakePacket = createPacket(0x00, handshakeData);
      client.write(handshakePacket);
      const statusRequestPacket = createPacket(0x00, Buffer.alloc(0));
      client.write(statusRequestPacket);
    });

    client.on('data', (data) => {
      buffer = Buffer.concat([buffer, data]);
      try {
        let offset = 0;
        let [length, newOffset] = readVarInt(buffer, offset);
        offset = newOffset;
        if (buffer.length >= offset + length) {
          let [packetId, newOffset] = readVarInt(buffer, offset);
          offset = newOffset;
          if (packetId === 0x00) {
            let [jsonLength, newOffset] = readVarInt(buffer, offset);
            offset = newOffset;
            const jsonResponse = buffer.slice(offset, offset + jsonLength).toString('utf8');
            serverInfo = JSON.parse(jsonResponse);
            const pingPacket = createPacket(0x01, Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]));
            pingStartTime = process.hrtime.bigint();
            client.write(pingPacket);
            buffer = buffer.slice(offset + jsonLength);
          } else if (packetId === 0x01) {
            const latency = Number(process.hrtime.bigint() - pingStartTime) / 1e6;
            serverInfo.latency = Math.round(latency);
            resolve(serverInfo);
            client.destroy();
          }
        }
      } catch (e) {
        reject(e);
      }
    });

    client.on('error', (err) => {
      reject(err);
    });

    client.on('close', () => {
      console.log('Connection closed');
    });
  });
}

// Bedrock Edition Pinger
function createBedrockPacket() {
  const packetId = Buffer.from([0x01]);
  const timeBuffer = Buffer.alloc(8);
  timeBuffer.writeBigUInt64BE(BigInt(Date.now()), 0);
  const magic = Buffer.from('00ffff00fefefefefdfdfdfd12345678', 'hex');
  const clientGUID = Buffer.alloc(8);
  clientGUID.writeBigUInt64BE(BigInt(Math.floor(Math.random() * 1e15)), 0);
  return Buffer.concat([packetId, timeBuffer, magic, clientGUID]);
}

function readBedrockResponse(buffer) {
  const packetId = buffer.readUInt8(0);
  if (packetId !== 0x1c) {
    throw new Error('Invalid packet ID');
  }
  const offset = 35;
  const serverInfoStr = buffer.slice(offset).toString('utf8');
  const serverInfoParts = serverInfoStr.split(';');
  return {
    edition: serverInfoParts[0],
    motd: serverInfoParts[1],
    protocol: parseInt(serverInfoParts[2], 10),
    version: serverInfoParts[3],
    playersOnline: parseInt(serverInfoParts[4], 10),
    playersMax: parseInt(serverInfoParts[5], 10),
    serverId: serverInfoParts[6],
    worldname: serverInfoParts[7],
    gameMode: serverInfoParts[8],
    nintendoLimited: serverInfoParts[9],
    portIPv4: serverInfoParts[10],
    portIPv6: serverInfoParts[11]
  };
}

function pingBedrockServer(host, port) {
  return new Promise((resolve, reject) => {
    const client = dgram.createSocket('udp4');
    const pingPacket = createBedrockPacket();
    const timeout = setTimeout(() => {
      client.close();
      reject(new Error('Ping timeout'));
    }, 5000);

    client.on('message', (msg) => {
      clearTimeout(timeout);
      try {
        const serverInfo = readBedrockResponse(msg);
        const responseTime = BigInt(Date.now()) - BigInt(msg.readBigUInt64BE(1));
        serverInfo.latency = Number(responseTime);
        resolve(serverInfo);
      } catch (error) {
        reject(error);
      } finally {
        client.close();
      }
    });

    client.send(pingPacket, 0, pingPacket.length, port, host, (err) => {
      if (err) {
        clearTimeout(timeout);
        client.close();
        reject(err);
      }
    });
  });
}

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

function resolveSrv(host) {
  return new Promise((resolve, reject) => {
    dns.resolveSrv(`_minecraft._tcp.${host}`, (err, addresses) => {
      if (err) {
        if (err.code === 'ENODATA' || err.code === 'ENOTFOUND') {
          resolve(null);
        } else {
          reject(err);
        }
      } else {
        resolve(addresses[0]);
      }
    });
  });
}

async function resolveAndConnect(host, port, isJava = true) {
  try {
    const srvRecord = await resolveSrv(host);
    if (srvRecord) {
      console.log(`SRV record found: ${srvRecord.name}:${srvRecord.port}`);
      host = srvRecord.name;
      port = srvRecord.port;
    }

    if (isJava) {
      return await connectToJavaServer(host, port);
    } else {
      return await pingBedrockServer(host, port);
    }
  } catch (error) {
    console.error('Error resolving or connecting:', error);
    throw error;
  }
}

function fetchImage(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    protocol.get(url, (response) => {
      if (response.statusCode === 200) {
        let data = [];
        response.on('data', (chunk) => {
          data.push(chunk);
        });
        response.on('end', () => {
          resolve(Buffer.concat(data));
        });
      } else {
        reject(new Error(`HTTP Status Code: ${response.statusCode}`));
      }
    }).on('error', (err) => {
      reject(err);
    });
  });
}

app.get('/api/png/:serverip', async (req, res) => {
  const serverip = req.params.serverip;
  let [serverHost, serverPort] = serverip.split(':');
  serverPort = serverPort ? parseInt(serverPort) : 25565;

  try {
    const response = await resolveAndConnect(serverHost, serverPort);
    if (response.favicon) {
      if (response.favicon.startsWith('data:image/png;base64,')) {
        const faviconData = response.favicon.split(',')[1];
        const faviconBuffer = Buffer.from(faviconData, 'base64');
        res.set('Content-Type', 'image/png');
        res.send(faviconBuffer);
      } else if (response.favicon.startsWith('http://') || response.favicon.startsWith('https://')) {
        try {
          const imageBuffer = await fetchImage(response.favicon);
          res.set('Content-Type', 'image/png');
          res.send(imageBuffer);
        } catch (err) {
          console.error('Error fetching image:', err);
          res.status(500).json({ error: 'Failed to fetch favicon' });
        }
      } else {
        res.status(400).json({ error: 'Invalid favicon format' });
      }
    } else {
      res.status(404).json({ error: 'No favicon available' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server offline or no favicon' });
  }
});

app.get('/api/status/:serverAddress', async (req, res) => {
  const [serverHost, serverPort] = req.params.serverAddress.split(':');
  const port = serverPort ? parseInt(serverPort, 10) : 25565;

  try {
    const response = await resolveAndConnect(serverHost, port);
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
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server offline' });
  }
});

app.get('/api/status/bedrock/:serverAddress', async (req, res) => {
  const [serverHost, serverPort] = req.params.serverAddress.split(':');
  const port = serverPort ? parseInt(serverPort, 10) : 19132;

  try {
    const response = await resolveAndConnect(serverHost, port, false);
    const serverInfo = {
      motd: response.motd,
      levelName: response.worldname,
      playersOnline: response.playersOnline,
      playersMax: response.playersMax,
      gamemode: response.gameMode,
      serverId: response.serverId,
      protocol: response.protocol,
      version: response.version,
      latency: response.latency
    };

    res.json(serverInfo);
  } catch (error) {
    console.error('Ping failed:', error);
    res.status(500).json({ error: 'Server offline' });
  }
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
