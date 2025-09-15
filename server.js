const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

app.use(express.static('public'));

const imagesFile = path.join(__dirname, 'images.json');
const imagesFolder = path.join(__dirname, 'shared_images');

if (!fs.existsSync(imagesFolder)) fs.mkdirSync(imagesFolder);
if (!fs.existsSync(imagesFile)) fs.writeFileSync(imagesFile, '[]');

// Store a user waiting for a partner
let waitingUser = null;

io.on('connection', (socket) => {
  // Pair users
  if (waitingUser) {
    const partner = waitingUser;
    waitingUser = null;

    socket.partner = partner;
    partner.partner = socket;

    socket.emit('paired');
    partner.emit('paired');
  } else {
    waitingUser = socket;
    socket.emit('waiting');
  }

  // Handle messages
  socket.on('message', (msg) => {
    if (socket.partner) socket.partner.emit('message', msg);
  });

  // Handle images
  socket.on('image', (base64) => {
    if (!socket.partner) return;

    // Save image locally
    const filename = `image_${Date.now()}.png`;
    const filepath = path.join(imagesFolder, filename);
    const data = base64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(data, 'base64');
    fs.writeFileSync(filepath, buffer);

    // Save to JSON
    const images = JSON.parse(fs.readFileSync(imagesFile));
    images.push({ filename, timestamp: Date.now() });
    fs.writeFileSync(imagesFile, JSON.stringify(images, null, 2));

    // Send to partner
    socket.partner.emit('image', base64);
  });

  socket.on('disconnect', () => {
    if (socket.partner) {
      socket.partner.emit('partner_left');
      socket.partner.partner = null;
    }
    if (waitingUser === socket) waitingUser = null;
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
