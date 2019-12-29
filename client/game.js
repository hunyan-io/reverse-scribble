const Board = require('./board.js');

const gameElement = document.getElementById('game');
gameElement.remove();

class Game {
    constructor(socket, stats) {
        const [state, round, word, playerList, args] = stats;
        this.socket = socket;
        this.element = gameElement.cloneNode(true);
        document.body.appendChild(this.element);
        this.toolBox = document.getElementById('toolBox');
        this.displayBox = document.getElementById('displayBox');
        this.chatBox = document.getElementById('chatBox');
        this.chatInput = document.getElementById('chatInput');
        this.scoreList = document.getElementById('scoreList');
        this.scoreItem = document.getElementById('scoreItem');
        this.scoreItem.removeAttribute('id');
        this.scoreItem.remove();
        this.boardSpace = document.getElementById('boardSpace');
        this.boardModel = document.getElementById('boardModel');
        this.boardModel.removeAttribute('id');
        this.boardModel.remove();
        this.timeBox = document.getElementById('timeBox');
        this.wordContent = document.getElementById('wordContent');
        this.wordContent.textContent = word;
        this.overlay = document.getElementById('overlay');
        this.overlayContent = document.getElementById('overlayContent');
        this.settings = {
            thickness: document.getElementById('thickness'),
            color: document.getElementById('colorPalette'),
            mode: 0
        }
        this.round = round;
        this.players = {};
        this.board = null;
        this.boards = [];
        this.displayBy = 2;
        document.getElementById('undo').addEventListener('click', () => {
            if (this.board) this.board.undo();
        }, false);
        document.getElementById('clear').addEventListener('click', () => {
            if (this.board) {
                this.board.actions = [];
                this.board.clear();
            }
        });
        this.settings.thickness.addEventListener('change', () => {
            if (this.board) {
                this.board.thickness = this.settings.thickness.value;
            }
        }, false);
        this.settings.color.addEventListener('change', () => {
            if (this.board) {
                this.board.color = this.settings.color.value;
            }
        }, false);
        document.getElementById('displayBy2').addEventListener('click', () => this.setDisplay(2), false);
        document.getElementById('displayBy3').addEventListener('click', () => this.setDisplay(3), false);
        document.getElementById('displayBy4').addEventListener('click', () => this.setDisplay(4), false);
        document.getElementById('pen').addEventListener('click', () => this.setMode(0), false);
        document.getElementById('eraser').addEventListener('click', () => this.setMode(1), false);
        document.getElementById('fill').addEventListener('click', () => this.setMode(2), false);
        socket.on('playerJoin', nickname => {
            this.addPlayer(nickname, 0);
        });
        socket.on('playerLeave', nickname => {
            this.players[nickname].node.remove();
            delete this.players[nickname];
        });
        var whiteDiv = false;
        socket.on('message', (nickname, message) => {
            const scrolled = this.chatBox.scrollTop && this.chatBox.scrollTop != this.chatBox.scrollHeight - this.chatBox.clientHeight;
            const element = document.createElement('div');
            whiteDiv = !whiteDiv;
            element.className = 'px-2 bg-' + (whiteDiv ? 'white' : 'light');
            element.innerHTML = '<strong>'+nickname+':</strong> '+message;
            this.chatBox.appendChild(element);
            if (!scrolled) {
                this.chatBox.scrollTop = this.chatBox.scrollHeight - this.chatBox.clientHeight;
            }
        });
        this.chatInput.addEventListener('keypress', e => {
            if (e.keyCode == 13) {
                const value = this.chatInput.value.trim();
                if (value) {
                    socket.emit('message', value);
                    this.chatInput.value = '';
                }
            }
        }, false);
        for (const [nickname, score] of playerList) {
            this.addPlayer(nickname, score);
        }
        switch (state) {
            case 'round':
                this.round--;
                this.newRound(word, args);
                break;
            case 'submit':
                this.round--;
                this.newRound(word, 0);
                this.waitForSubmit();
                break;
            case 'vote':
                this.round--;
                this.newRound(word, 0);
                this.waitForSubmit();
                this.newVote(args[0], args[1]);
                break;
            case 'win':
                this.roundWinners(args);
                break;
        }
        socket.on('newRound', (word, maxTime) => this.newRound(word, maxTime));
        socket.on('endGame', winners => this.endGame(winners));
        socket.on('timeTick', () => {
            this.timeBox.textContent -= 1;
        });
        socket.on('endRound', () => {
            socket.emit('submit', this.board.compress());
            this.waitForSubmit();
        });
        socket.on('newVote', (boards, maxTime) => this.newVote(boards, maxTime));
        socket.on('winners', winners => {
            this.roundWinners(winners);
        });
    }
    setDisplay(n) {
        this.displayBy = n;
        if (this.boards) {
            for (const board of this.boards) {
                board.display.className = 'col-'+(12/this.displayBy);
                board.resize();
            }
        }
    }
    setMode(n) {
        this.settings.mode = n;
        if (this.board) {
            this.board.mode = n;
        }
    }
    addPlayer(nickname, score) {
        const scoreList = this.scoreList,
              scoreItem = this.scoreItem,
              players = this.players;
        players[nickname] = {
            nickname: nickname,
            _score: 0,
            set score(value) { 
                this._score = value
                scoreList.innerHTML = '';
                for (const player of Object.values(players).sort((b, a) => a.score - b.score)) {
                    const node = scoreItem.cloneNode();
                    node.innerHTML = `<strong>${player.nickname}</strong><br><small>${player.score} pts</small>`;
                    scoreList.appendChild(node);
                    player.node = node;
                }
                scoreList.innerHTML += '<div class="list-group-item"></div>';
            },
            get score() {
                return this._score;
            }
        }
        players[nickname].score = score;
    }
    newRound(word, maxTime) {
        this.round++;
        this.overlay.className = this.overlay.className.replace('d-flex', 'd-none');
        this.wordContent.textContent = word;
        this.timeBox.textContent = maxTime;
        this.toolBox.className = this.toolBox.className.replace('d-none', 'd-inline-flex');
        this.displayBox.className = this.displayBox.className.replace('d-flex', 'd-none');
        this.boardSpace.innerHTML = '';
        this.boardSpace.className = '';
        this.boardSpace.style.overflowY = 'visible';
        this.boards = [];
        this.board = new Board(this.settings);
        this.board.attach(this.boardSpace, true);
        this.board.record();
    }
    waitForSubmit() {
        this.board.stop();
        this.overlayContent.innerHTML = '<div class="col display-2">Submitting...</div>';
        this.overlay.className = this.overlay.className.replace('d-none', 'd-flex');
    }
    newVote(boards, maxTime) {
        this.overlay.className = this.overlay.className.replace('d-flex', 'd-none');;
        this.toolBox.className = this.toolBox.className.replace('d-inline-flex', 'd-none');
        this.displayBox.className = this.displayBox.className.replace('d-none', 'd-flex');
        this.boardSpace.innerHTML = '';
        this.boardSpace.className = 'row justify-content-center';
        this.boardSpace.style.overflowY = 'auto';
        this.board = null;
        this.boards = boards.map(info => new Board().decompress(info));
        this.timeBox.textContent = maxTime;
        var id = 0;
        for (const board of this.boards) {
            const boardId = id++;
            board.display = this.boardModel.cloneNode(true);
            board.display.className = 'col-'+(12/this.displayBy);
            this.boardSpace.appendChild(board.display);
            const container = document.getElementById('boardDisplay');
            container.removeAttribute('id');
            board.attach(container, true);
            board.play();
            const zoomBtn = document.getElementById('zoomBtn');
            zoomBtn.removeAttribute('id');
            const voteBtn = document.getElementById('voteBtn');
            voteBtn.removeAttribute('id');
            voteBtn.addEventListener('click', () => {
                voteBtn.disabled = true;
                this.socket.emit('vote', boardId);
            }, false);
        }
    }
    roundWinners(winners) {
        this.overlayContent.innerHTML = `
            <div class="container-fluid">
                <div class="row">
                    <div class="col display-2">Vote Results</div>
                </div>
                <div class="row justify-content-center">
                    <div class="col-3">
                        ${ winners[1].length ?
                        `<br>
                        <p class="h1">${winners[1].pop()} VOTES</p>
                        <p class="h3">
                            ${winners[1].join('<br>')}
                        </p>`
                            : ''
                        }
                    </div>
                    <div class="col-3">
                        <p class="h1">${winners[0].pop()} VOTES</p>
                        <p class="h3">
                            ${winners[0].join('<br>')}
                        </p>
                    </div>
                    <div class="col-3">
                        ${ winners[2].length ?
                        `<br>
                        <br>
                        <p class="h1">${winners[2].pop()} VOTES</p>
                        <p class="h3">
                            ${winners[2].join('<br>')}
                        </p>`
                            : ''
                        }
                    </div>
                </div>
            </div>
        `;
        for (const winner of winners[0]) {
            this.players[winner].score += 3;
        }
        for (const winner of winners[1]) {
            this.players[winner].score += 2;
        }
        for (const winner of winners[2]) {
            this.players[winner].score += 1;
        }
        this.overlay.className = this.overlay.className.replace('d-none', 'd-flex');;
    }
    endGame(winners) {
        this.overlayContent.innerHTML = `
            <div class="container-fluid">
                <div class="row">
                    <div class="col display-2">Winners</div>
                </div>
                <div class="row justify-content-center">
                    <div class="col-3">
                        ${ winners[1].length ?
                        `<br>
                        <p class="h1">#2 (${this.players[winners[1][0]].score} pts)</p>
                        <p class="h3">
                            ${winners[1].join('<br>')}
                        </p>`
                            : ''
                        }
                    </div>
                    <div class="col-3">
                        <p class="h1">#1 (${this.players[winners[0][0]].score} pts)</p>
                        <p class="h3">
                            ${winners[0].join('<br>')}
                        </p>
                    </div>
                    <div class="col-3">
                        ${ winners[2].length ?
                        `<br>
                        <br>
                        <p class="h1">#3 (${this.players[winners[2][0]].score} pts)</p>
                        <p class="h3">
                            ${winners[2].join('<br>')}
                        </p>`
                            : ''
                        }
                    </div>
                </div>
            </div>
        `;
        this.overlay.className = this.overlay.className.replace('d-none', 'd-flex');;
        setTimeout(() => {
            this.remove();
            this.constructor.onEnd();
        }, 10000);
    }
    remove() {
        this.element.remove();
        this.overlay.className = this.overlay.className.replace('d-flex', 'd-none');
        this.socket.removeAllListeners('message');
        this.socket.removeAllListeners('playerJoin');
        this.socket.removeAllListeners('playerLeave');
        this.socket.removeAllListeners('timeTick');
        this.socket.removeAllListeners('endRound');
        this.socket.removeAllListeners('newVote');
        this.socket.removeAllListeners('winners');
        this.socket.removeAllListeners('newRound');
        this.socket.removeAllListeners('endGame');
    }
}

module.exports = Game;