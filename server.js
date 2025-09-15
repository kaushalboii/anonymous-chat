// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const imagesFile = path.join(__dirname, 'images.json');
const imagesFolder = path.join(__dirname, 'shared_images');

if (!fs.existsSync(imagesFolder)) fs.mkdirSync(imagesFolder);
if (!fs.existsSync(imagesFile)) fs.writeFileSync(imagesFile, '[]');

// Queue for waiting users
let waitingUser = null;

// Map to store pairs
const pairs = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Pairing logic
  if (waitingUser) {
    const partner = waitingUser;
    waitingUser = null;

    pairs.set(socket.id, partner);
    pairs.set(partner.id, socket);

    socket.emit('paired');
    partner.emit('paired');
  } else {
    waitingUser = socket;
    socket.emit('waiting');
  }

  // Message handler
  socket.on('message', (msg) => {
    const partner = pairs.get(socket.id);
    if (partner) partner.emit('message', msg);
  });

  // Image handler
  socket.on('image', (base64) => {
    // Save locally
    const filename = `image_${Date.now()}.png`;
    const filepath = path.join(imagesFolder, filename);
    const data = base64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(data, 'base64');
    fs.writeFileSync(filepath, buffer);

    const images = JSON.parse(fs.readFileSync(imagesFile));
    images.push({ filename, timestamp: Date.now() });
    fs.writeFileSync(imagesFile, JSON.stringify(images, null, 2));

    // Send to partner
    const partner = pairs.get(socket.id);
    if (partner) partner.emit('image', base64);
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    const partner = pairs.get(socket.id);

    if (partner) {
      partner.emit('partner_left');
      pairs.delete(partner.id);
      waitingUser = partner;
      partner.emit('waiting');
    }

    pairs.delete(socket.id);

    if (waitingUser === socket) waitingUser = null;
  });
});

server.listen(process.env.PORT || 3000, () => {
  console.log('Server running...');
});
