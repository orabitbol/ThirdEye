const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
    }
});

app.use(express.static(path.join(__dirname, 'public')));

let reusableInterval;
io.on('connection', socket => {

    if (reusableInterval != null) {
        clearInterval(reusableInterval);
    }
    reusableInterval = setInterval(() => pingTheClient(socket), 1000);

    socket.on("save-path", (positionsArray) => {
        const fileName = 'path_' + Date.now();

        fs.writeFile(__dirname + `/paths/${fileName}`, JSON.stringify(positionsArray), function(err) {
            if(err) {
                return console.log(err);
            }
        });
        console.log(`New path ${fileName}`);
    });

    socket.on('disconnect', () => {
        clearInterval(reusableInterval);
    });
});

const pingTheClient = (socket) => {
    socket.emit("ping", "ping");
};

const PORT = 8000 || process.env.PORT;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
