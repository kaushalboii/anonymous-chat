const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO with CORS enabled
const io = new Server(server, {
  cors: {
    origin: '*', // Allow all origins
    methods: ['GET', 'POST']
  }
});

// Serve your frontend files
app.use(express.static('public'));

// Setup local storage for images
const imagesFile = path.join(__dirname, 'images.json');
const imagesFolder = path.join(__dirname, 'shared_images');

if (!fs.existsSync(imagesFolder)) fs.mkdirSync(imagesFolder);
if (!fs.existsSync(imagesFile)) fs.writeFileSync(imagesFile, '[]');

// Socket.IO events
io.on('connection', (socket) => {
  console.log('A user connected');

  // Send waiting status
  socket.emit('waiting');

  // Handle messages
  socket.on('message', (msg) => {
    socket.broadcast.emit('message', msg);
  });

  // Handle images
  socket.on('image', (base64) => {
    try {
      const filename = `image_${Date.now()}.png`;
      const filepath = path.join(imagesFolder, filename);

      // Convert base64 to buffer and save
      const data = base64.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(data, 'base64');
      fs.writeFileSync(filepath, buffer);

      // Save image info to JSON
      const images = JSON.parse(fs.readFileSync(imagesFile));
      images.push({ filename, timestamp: Date.now() });
      fs.writeFileSync(imagesFile, JSON.stringify(images, null, 2));

      // Broadcast image to partner
      socket.broadcast.emit('image', base64);
    } catch (err) {
      console.error('Error saving image:', err);
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('A user disconnected');
    socket.broadcast.emit('partner_left');
  });
});

// Start server on Render-friendly port
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
