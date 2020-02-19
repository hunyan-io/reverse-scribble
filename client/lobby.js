const defaultSet = {
    rounds: '3',
    time: '2',
    language: 'en',
    customWords: ''
}

class Lobby {
    constructor(socket) {
        this.element = document.getElementById('lobby');
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
        this.lobbyLink = document.getElementById('lobbyLink');        
        this.playerModel.removeAttribute('id');
        this.playerModel.remove();
        this.hidden = true;
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
        this.element.remove();
        this.element.style.display = 'block';
    }
    start(id, playerList) {
        document.body.appendChild(this.element);
        const url = `${window.location.protocol}//${window.location.hostname}${(window.location.port && window.location.port != 80) ? ':'+window.location.port : ''}${window.location.pathname}?id=${id}`;
        this.lobbyLink.setAttribute('href', url);
        this.lobbyLink.textContent = url;
        this.hidden = false;
        this.playerList.innerHTML = '';
        for (const [setting, value] of Object.entries(defaultSet)) {
            this.settings[setting].value = value;
            this.settings[setting].disabled = true;
        }
        this.settings.exclusive.checked = false;
        this.settings.exclusive.disabled = true;
        this.startBtn.disabled = true;
        this.players = {};
        this.socket.on('playerJoin', player => {
            this.addPlayer(player);
        });
        this.socket.on('playerLeave', (nickname, isOwner) => {
            this.players[nickname].remove();
            delete this.players[nickname];
            if (isOwner) {
                this.enableSettings();
            }
        });
        for (const player of playerList) {
            this.addPlayer(player);
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
        this.socket.removeAllListeners('playerJoin');
        this.socket.removeAllListeners('playerLeave');
        this.hidden = true;
    }
    addPlayer(player) {
        var node;
        node = this.playerModel.cloneNode(true);
        this.playerList.appendChild(node);
        const playerImage = document.getElementById('playerImage');
        playerImage.removeAttribute('id');
        if (player.avatar) {
            playerImage.src = player.avatar;
        }
        const playerName = document.getElementById('playerName');
        playerName.removeAttribute('id');
        playerName.innerHTML = player.nickname;
        this.players[player.nickname] = node;
    }
}

module.exports = Lobby;