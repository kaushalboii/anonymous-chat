const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: { origin: '*' } // allow CORS for testing
});

app.use(express.static('public'));

const imagesFile = path.join(__dirname, 'images.json');
const imagesFolder = path.join(__dirname, 'shared_images');

if (!fs.existsSync(imagesFolder)) fs.mkdirSync(imagesFolder);
if (!fs.existsSync(imagesFile)) fs.writeFileSync(imagesFile, '[]');

// Queue to store waiting sockets
let waitingUser = null;

// Map to store paired sockets
const pairs = new Map();

io.on('connection', socket => {
  console.log('User connected:', socket.id);

  // Pair the user or wait
  if (waitingUser) {
    // Pair them
    pairs.set(socket.id, waitingUser);
    pairs.set(waitingUser.id, socket);

    socket.emit('paired');
    waitingUser.emit('paired');

    waitingUser = null;
  } else {
    waitingUser = socket;
    socket.emit('waiting');
  }

  // Handle text messages
  socket.on('message', msg => {
    const partner = pairs.get(socket.id);
    if (partner) partner.emit('message', msg);
  });

  // Handle images
  socket.on('image', base64 => {
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

    const partner = pairs.get(socket.id);
    if (partner) partner.emit('image', base64);
  });

  // Handle disconnects
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);

    const partner = pairs.get(socket.id);
    if (partner) {
      partner.emit('partner_left');
      pairs.delete(partner.id);
      pairs.delete(socket.id);
    }

    if (waitingUser && waitingUser.id === socket.id) {
      waitingUser = null;
    }
  });
});

server.listen(process.env.PORT || 3000, () => {
  console.log('Server running...');
});
