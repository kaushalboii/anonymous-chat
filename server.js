const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: { origin: '*' } // allow cross-origin if needed
});

app.use(express.static('public'));

const imagesFile = path.join(__dirname, 'images.json');
const imagesFolder = path.join(__dirname, 'shared_images');

if (!fs.existsSync(imagesFolder)) fs.mkdirSync(imagesFolder);
if (!fs.existsSync(imagesFile)) fs.writeFileSync(imagesFile, '[]');

// Store waiting users
let waitingUser = null;

// Track active pairs: { socketId: partnerSocketId }
const pairs = {};

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // If there is no waiting user, set this user as waiting
  if (!waitingUser) {
    waitingUser = socket;
    socket.emit('waiting');
  } else {
    // Pair current socket with waiting user
    const partner = waitingUser;
    waitingUser = null;

    pairs[socket.id] = partner.id;
    pairs[partner.id] = socket.id;

    socket.emit('paired');
    partner.emit('paired');
  }

  // Handle messages
  socket.on('message', (msg) => {
    const partnerId = pairs[socket.id];
    if (partnerId) io.to(partnerId).emit('message', msg);
  });

  // Handle images
  socket.on('image', (base64) => {
    const partnerId = pairs[socket.id];

    // Save locally
    const filename = `image_${Date.now()}.png`;
    const filepath = path.join(imagesFolder, filename);
    const data = base64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(data, 'base64');
    fs.writeFileSync(filepath, buffer);

    const images = JSON.parse(fs.readFileSync(imagesFile));
    images.push({ filename, timestamp: Date.now() });
    fs.writeFileSync(imagesFile, JSON.stringify(images, null, 2));

    if (partnerId) io.to(partnerId).emit('image', base64);
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);

    const partnerId = pairs[socket.id];
    if (partnerId) {
      io.to(partnerId).emit('partner_left');
      delete pairs[partnerId];
    }

    if (waitingUser && waitingUser.id === socket.id) {
      waitingUser = null;
    }
    delete pairs[socket.id];
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
