const Home = require('./home.js'),
      Lobby = require('./lobby.js'),
      Game = require('./game.js');

const io = require('socket.io-client'),
      socket = io();

var home = new Home(socket);
var lobby = new Lobby(socket);
var game = new Game(socket);

socket.on('disconnect', () => {
    if (home.hidden) {
        if (!lobby.hidden || !game.hidden) (lobby.hidden ? game : lobby).remove();
        home.start();
        home.alert('Disconnected', 'You have been disconnected.');
    }
});

socket.on('lobbyJoin', (id, playerList) => {
    if (!home.hidden) home.remove();
    lobby.start(id, playerList);
});

socket.on('gameJoin', (...args) => {
    if (!home.hidden || !lobby.hidden) (home.hidden ? lobby : home).remove();
    game.start(args);
});

Game.onEnd = () => {
    home.start();
}