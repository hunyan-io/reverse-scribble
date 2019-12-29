require('dotenv').config();

const Home = require('./home.js'),
      Lobby = require('./lobby.js'),
      Game = require('./game.js'),
      server = require('./webserver.js'),
      io = require('socket.io')(server);

Lobby.io = Game.io = io;

const home = new Home();

io.on('connection', socket => {
    const player = {
        socket: socket
    };
    home.listen(player);
    
    socket.on('disconnect', () => {
        if (player.lobby) {
            player.lobby.removePlayer(player);
        }
    });
});