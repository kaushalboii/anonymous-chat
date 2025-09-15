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

io.on('connection', (socket) => {
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

  socket.on('message', (msg) => {
    socket.broadcast.emit('message', msg);
  });
});

server.listen(process.env.PORT || 3000, () => {
  console.log('Server running...');
});
