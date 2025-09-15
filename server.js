const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // allow connections from any origin
    methods: ['GET', 'POST']
  }
});

// Serve frontend files
app.use(express.static('public'));

// Setup images storage
const imagesFile = path.join(__dirname, 'images.json');
const imagesFolder = path.join(__dirname, 'shared_images');

if (!fs.existsSync(imagesFolder)) fs.mkdirSync(imagesFolder);
if (!fs.existsSync(imagesFile)) fs.writeFileSync(imagesFile, '[]');

// Handle socket connections
io.on('connection', (socket) => {
  console.log('A user connected');

  socket.on('message', (msg) => {
    socket.broadcast.emit('message', msg);
  });

  socket.on('image', (base64) => {
    const filename = `image_${Date.now()}.png`;
    const filepath = path.join(imagesFolder, filename);

    const data = base64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(data, 'base64');
    fs.writeFileSync(filepath, buffer);

    const images = JSON.parse(fs.readFileSync(imagesFile));
    images.push({ filename, timestamp: Date.now() });
    fs.writeFileSync(imagesFile, JSON.stringify(images, null, 2));

    socket.broadcast.emit('image', base64);
  });

  socket.on('disconnect', () => {
    console.log('A user disconnected');
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
