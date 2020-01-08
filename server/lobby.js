const Game = require('./game.js');

const languages = ['en'];
const defaults = {
    rounds: 3,
    time: 2,
    language: 'en',
    customWords: [],
    exclusive: false
}

function generateId() {
    return Buffer.from(new Date().getTime().toString()).toString('base64');
}

class Lobby {
    constructor(home, owner) {
        this.home = home;
        this.id = generateId();
        this.players = new Set();
        this.settings = {
            rounds: defaults.rounds,
            time: defaults.time,
            language: defaults.language,
            customWords: [],
            exclusive: defaults.exclusive
        }
        this.addPlayer(owner);
        this.setOwner(owner);
        home.addLobby(this);
    }
    setOwner(player) {
        if (this.owner) {
            this.owner.socket.removeAllListeners('settingChange');
            this.owner.socket.removeAllListeners('startGame');
        }
        this.owner = player;
        player.socket.on('settingChange', (setting, value) => {
            switch (setting) {
                case 'rounds':
                    if (!isNaN(value) && value >= 2 && value <= 10) {
                        this.settings.rounds = value;
                        player.socket.broadcast.to(this.id).emit('settingChange', setting, value);
                    }
                    break;
                case 'time':
                    if (!isNaN(value) && value >= 1 && value <= 10) {
                        this.settings.time = value;
                        player.socket.broadcast.to(this.id).emit('settingChange', setting, value);
                    }
                    break;
                case 'language':
                    if (languages.includes(value)) {
                        this.settings.language = value;
                        player.socket.broadcast.to(this.id).emit('settingChange', setting, value);
                    }
                    break;
                case 'customWords':
                    if (Array.isArray(value)) {
                        value.map(word => typeof word == 'string' && word.trim().replace(/\s+/g, ' ')).filter(word => word);
                        if (value.length && value.length < 4) return;
                        for (const word of value) {
                            if (word.length > 40) return;
                        }
                        this.settings.customWords = value;
                        player.socket.broadcast.to(this.id).emit('settingChange', setting, value.join(', '));
                    }
                    break;
                case 'exclusive':
                    this.settings.exclusive = !!value;
                    player.socket.broadcast.to(this.id).emit('settingChange', setting, this.settings.exclusive);
                    break;
            }
        });
        player.socket.on('startGame', () => {
            new Game(this);
        });
    }
    addPlayer(player) {
        for (const entry of this.players) {
            if (entry.nickname === player.nickname) {
                return player.socket.emit('nameTaken');
            }
        }
        this.players.add(player);
        player.socket.join(this.id);
        player.socket.broadcast.to(this.id).emit('playerJoin', {nickname:player.nickname, avatar:player.avatar});
        player.socket.emit('lobbyJoin', Array.from(this.players).map(entry => ({nickname:entry.nickname,avatar:entry.avatar})));
        player.lobby = this;
        for (const [setting, value] of Object.entries(this.settings)) {
            if (setting == 'customWords') {
                if (value.length) {
                    player.socket.emit('settingChange', setting, value.join(', '));
                }
            } else {
                if (value != defaults[setting]) {
                    player.socket.emit('settingChange', setting, value);
                }
            }
        }
    }
    remove() {
        if (this.owner) {
            this.owner.socket.removeAllListeners('settingChange');
            this.owner.socket.removeAllListeners('startGame');
        }
        this.home.removeLobby(this);
        for (const player of this.players) {
            delete player.lobby;
        }
    }
    removePlayer(player) {
        this.players.delete(player);
        player.lobby = null;
        player.socket.leave(this.id);
        if (!this.players.size) {
            return this.remove();
        }
        if (this.owner == player) {
            const playerList = Array.from(this.players);
            this.setOwner(playerList[Math.floor(Math.random() * playerList.length)]);
            this.owner.socket.broadcast.to(this.id).emit('playerLeave', player.nickname);
            this.owner.socket.emit('playerLeave', player.nickname, true);
        } else {
            this.constructor.io.to(this.id).emit('playerLeave', player.nickname);
        }
    }
    get locked() {
        return this.players.size > 20;
    }
}

module.exports = Lobby;