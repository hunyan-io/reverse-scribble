const lobbyElement = document.getElementById('lobby');
lobbyElement.remove();

class Lobby {
    constructor(socket, playerList) {
        this.element = lobbyElement.cloneNode(true);
        document.body.appendChild(this.element);
        this.socket = socket;
        this.settings = {};
        this.settings.rounds = document.getElementById('rounds');
        this.settings.time = document.getElementById('time');
        this.settings.language = document.getElementById('language');
        this.settings.customWords = document.getElementById('customWords');
        this.settings.exclusive = document.getElementById('exclusive');
        this.startBtn = document.getElementById('startGame');
        this.playerList = document.getElementById('playerList');
        this.playerModel = document.getElementById('playerModel');
        this.playerModel.removeAttribute('id');
        this.playerModel.remove();
        this.players = {};
        const wordsError = document.getElementById('wordsError');
        socket.on('settingChange', (setting, value) => {
            switch (setting) {
                case 'exclusive':
                    this.settings.exclusive.checked = value;
                    break;
                default:
                    this.settings[setting].value = value;
            }
        });
        socket.on('playerJoin', nickname => {
            this.addPlayer(nickname);
        });
        socket.on('playerLeave', (nickname, isOwner) => {
            this.players[nickname].remove();
            delete this.players[nickname];
            if (isOwner) {
                this.enableSettings();
            }
        });
        for (const setting of Object.keys(this.settings)) {
            switch (setting) {
                case 'exclusive':
                    this.settings.exclusive.addEventListener('click', () => {
                        socket.emit('settingChange', setting, this.settings.exclusive.checked);
                    }, false);
                    break;
                case 'customWords':
                    this.settings[setting].addEventListener('change', () => {
                        const customWords = this.settings.customWords.value.split(',').map(word => word.trim().replace(/\s+/g, ' ')).filter(word => word);
                        if (customWords.length && customWords.length < 4) {
                            wordsError.innerHTML = 'Please enter more than 4 words separated by a comma.';
                            wordsError.style.display = 'block';
                            return;
                        }
                        for (const word of customWords) {
                            if (word.length > 40) {
                                wordsError.innerHTML = 'Please enter a minimum of 40 characters per word.'
                                wordsError.style.display = 'block';
                                return;
                            }
                        }
                        wordsError.style.display = 'none';
                        socket.emit('settingChange', setting, customWords);
                    }, false);
                    break;
                default:
                    this.settings[setting].addEventListener('change', () => {
                        socket.emit('settingChange', setting, this.settings[setting].value);
                    }, false);
            }
        }
        for (const nickname of playerList) {
            this.addPlayer(nickname);
        }
        if (playerList.length == 1) {
            this.enableSettings();
        }
    }
    enableSettings() {
        for (const setting of Object.values(this.settings)) {
            setting.disabled = false;
        }
        this.startBtn.disabled = false;
        this.startBtn.addEventListener('click', () => {
            this.socket.emit('startGame');
        }, false);
    }
    remove() {
        this.element.remove();
        this.socket.removeAllListeners('startGame');
        this.socket.removeAllListeners('settingChange');
        this.socket.removeAllListeners('playerJoin');
        this.socket.removeAllListeners('playerLeave');
    }
    addPlayer(nickname) {
        var node;
        node = this.playerModel.cloneNode(true);
        this.playerList.appendChild(node);
        document.getElementById('playerImage').removeAttribute('id');
        const playerName = document.getElementById('playerName');
        playerName.removeAttribute('id');
        playerName.innerHTML = nickname;
        this.players[nickname] = node;
    }
}

module.exports = Lobby;