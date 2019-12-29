const Home = require('./home.js'),
      Lobby = require('./lobby.js'),
      Game = require('./game.js');

const io = require('socket.io-client'),
      socket = io();

var home = new Home(socket);
var lobby;
var game;

socket.on('disconnect', () => {
    if (!home) {
        if (lobby || game) (lobby || game).remove();
        lobby = null;
        game = null;
        home = new Home(socket);
        home.alert('Disconnected', 'You have been disconnected.');
    }
});

socket.on('lobbyJoin', playerList => {
    if (home) home.remove();
    home = null;
    lobby = new Lobby(socket, playerList);
});

socket.on('gameJoin', (...args) => {
    if (home || lobby) (home || lobby).remove();
    home = null;
    lobby = null;
    game = new Game(socket, args);
});

Game.onEnd = () => {
    game = null;
    home = new Home(socket);
}