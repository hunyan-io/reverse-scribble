const Lobby = require('./lobby.js');

const entityMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;'
};

function escapeHTML(string) {
    return string.replace(/[&<>"'`=\/]/g, s => entityMap[s]);
}

class Home {
    constructor() {
        this.lobbies = {};
        this.games = {};
        this.ongoing = new Set();
    }
    addLobby(lobby) {
        this.lobbies[lobby.id] = lobby;
        this.ongoing.add(lobby.id);
    }
    removeLobby(lobby) {
        delete this.lobbies[lobby.id];
        this.ongoing.delete(lobby.id);
    }
    addGame(game) {
        this.games[game.id] = game;
        this.ongoing.add(game.id);
    }
    removeGame(game) {
        delete this.games[game.id];
        this.ongoing.delete(game.id);
    }
    listen(player) {
        player.socket.on('play', (id, nickname, avatar) => {
            if (player.lobby) return;
            nickname = typeof nickname == 'string' && nickname.trim();
            if (!nickname || nickname.length > 20) return;
            if (typeof avatar == 'string' && avatar.indexOf('https://res.cloudinary.com/reverse-scribble/image/upload/') == 0) {
                player.avatar = avatar;
            }
            player.nickname = escapeHTML(nickname);
            if (!id || !(this.lobbies[id] || this.games[id])) {
                const iterator = this.ongoing.values();
                do {
                    id = iterator.next().value;
                } while (id && (this.lobbies[id] || this.games[id]).locked)
            }
            if (id) {
                (this.lobbies[id] || this.games[id]).addPlayer(player);
            } else {
                player.socket.emit('noRoom');
            }
        });
        player.socket.on('create', (nickname, avatar) => {
            if (player.lobby) return;
            nickname = typeof nickname == 'string' && nickname.trim();
            if (!nickname || nickname.length > 20) return;
            if (typeof avatar == 'string' && avatar.indexOf('https://res.cloudinary.com/reverse-scribble/image/upload/') == 0) {
                player.avatar = avatar;
            }
            player.nickname = escapeHTML(nickname);
            new Lobby(this, player);
        });
    }
}

module.exports = Home;