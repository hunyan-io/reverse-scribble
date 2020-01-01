const Board = require('./board.js');

const gameElement = document.getElementById('game');
gameElement.remove();

class Game {
    constructor(socket, stats) {
        const [state, round, maxRound, word, playerList, args] = stats;
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
        this.roundBox = document.getElementById('roundBox');
        this.wordContent.textContent = word;
        this.roundBox.textContent = 'Round '+round+' of '+maxRound;
        this.overlay = document.getElementById('overlay');
        this.overlayContent = document.getElementById('overlayContent');
        this.settings = {
            thickness: document.getElementById('thickness'),
            color: document.getElementById('colorPalette'),
            mode: 0
        }
        this.round = round;
        this.maxRound = maxRound;
        this.players = {};
        this.board = null;
        this.boards = [];
        this.displayBy = 2;
        document.getElementById('undo').addEventListener('click', () => {
            if (this.board) this.board.undo();
        }, false);
        document.getElementById('redo').addEventListener('click', () => {
            if (this.board) this.board.redo();
        }, false);
        document.getElementById('clear').addEventListener('click', () => {
            if (this.board) {
                this.board.redoList = this.board.redoList.concat(this.board.actions.reverse());
                this.board.actions = [];
                this.board.clear();
            }
        });
        this.settings.thickness.addEventListener('change', () => {
            if (this.board) {
                this.board.thickness = this.settings.thickness.value;
                this.board.resetBrush();
            }
        }, false);
        this.settings.color.addEventListener('change', () => {
            if (this.board) {
                this.board.color = this.settings.color.value;
                this.board.resetBrush();
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
            const player = this.players[nickname];
            delete this.players[nickname];
            player.score = 0;
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
                this.boards = args[1].map(info => info && new Board().decompress(info));
                this.roundWinners(args[0]);
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
                board.display.className = board.display.className.replace(/col\-\d+/, 'col-'+(12/this.displayBy));
                board.resize();
            }
        }
    }
    setMode(n) {
        this.settings.mode = n;
        if (this.board) {
            this.board.mode = n;
            this.board.resetBrush();
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
        this.roundBox.textContent = 'Round '+this.round+' of '+this.maxRound;
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
        this.boardSpace.className = 'row no-gutters justify-content-center';
        this.boardSpace.style.overflowY = 'auto';
        this.board = null;
        this.boards = boards.map(info => new Board().decompress(info));
        this.timeBox.textContent = maxTime;
        var id = 0;
        for (const board of this.boards) {
            const boardId = id++;
            board.display = this.boardModel.cloneNode(true);
            board.display.className = 'bg-light mb-auto rounded border col-'+(12/this.displayBy);
            board.display.style.setProperty('border-width', '3px', 'important');
            this.boardSpace.appendChild(board.display);
            const container = document.getElementById('boardDisplay');
            container.removeAttribute('id');
            board.attach(container);
            const zoomBtn = document.getElementById('zoomBtn');
            zoomBtn.removeAttribute('id');
            const voteBtn = document.getElementById('voteBtn');
            voteBtn.removeAttribute('id');
            let voting = false;
            voteBtn.addEventListener('click', () => {
                voting = !voting;
                voteBtn.className = voteBtn.className.replace(voting ? 'btn-primary' : 'btn-danger', voting ? 'btn-danger' : 'btn-primary');
                voteBtn.textContent = voting ? 'Unvote' : 'Vote';
                board.display.className = 'bg-light mb-auto rounded border' + (voting ? ' border-primary col-' : ' col-')+(12/this.displayBy);
                board.display.style.setProperty('border-width', voting ? '8px' : '3px', 'important');
                this.socket.emit(voting ? 'vote' : 'unvote', boardId);
            }, false);
            zoomBtn.addEventListener('click', () => {
                this.overlayContent.innerHTML = `
                    <div class="col-12 col-md-11 col-lg-8">
                        <button type="button" id="closeZoom" class="btn btn-secondary btn-block">
                            Close
                        </button>
                        <div id="zoomSpace" class="w-100"></div>
                    </div>
                `;
                document.getElementById('closeZoom').addEventListener('click', () => {
                    this.overlayContent.innerHTML = '';
                    this.overlay.className = this.overlay.className.replace('d-flex', 'd-none');
                }, false);
                this.overlay.className = this.overlay.className.replace('d-none', 'd-flex');
                board.clone().attach(document.getElementById('zoomSpace'));
            }, false);
        }
    }
    roundWinners(winners) {
        this.overlayContent.innerHTML = `
            <div class="container-fluid">
                <div class="row">
                    <div class="col display-3">Vote Results (Round ${this.round} of ${this.maxRound})</div>
                </div>
                <div class="row justify-content-center">
                    <div class="col-4">
                        ${ winners[1].length ?
                        `<br>
                        <p class="h1">${winners[1].pop()} VOTES</p>
                        <div class="row justify-content-center">
                            ${winners[1].map(([nickname, boardId]) => 
                            `<div class="col-12 col-lg-6 position-relative">
                                <div id="board-${boardId}" class="position-absolute w-100 h-100" style:"top:0px;left:0px"></div>
                                <div class="position-absolute w-100 text-center" style="z-index:1;left:0px;top:0px">
                                    <h4 style="color:black;text-shadow:2px 0 0 #fff, -2px 0 0 #fff, 0 2px 0 #fff, 0 -2px 0 #fff, 1px 1px #fff, -1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff;">${nickname}</h4>
                                </div>
                            </div>`
                            ).join(`
                            `)}
                        </div>`
                            : ''
                        }
                    </div>
                    <div class="col-4">
                        <p class="h1">${winners[0].pop()} VOTES</p>
                        <div class="row justify-content-center">
                            ${winners[0].map(([nickname, boardId]) => 
                            `<div class="col-12 col-lg-6 position-relative">
                                <div id="board-${boardId}" class="position-absolute w-100 h-100" style="top:0px;left:0px"></div>
                                <div class="position-absolute w-100 text-center" style="z-index:1;left:0px;top:0px">
                                    <h4 style="color:black;text-shadow:2px 0 0 #fff, -2px 0 0 #fff, 0 2px 0 #fff, 0 -2px 0 #fff, 1px 1px #fff, -1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff;">${nickname}</h4>
                                </div>
                            </div>`
                            ).join(`
                            `)}
                        </div>
                    </div>
                    <div class="col-4">
                        ${ winners[2].length ?
                        `<br>
                        <br>
                        <p class="h1">${winners[2].pop()} VOTES</p>
                        <div class="row justify-content-center">
                            ${winners[2].map(([nickname, boardId]) => 
                            `<div class="col-12 col-lg-6 position-relative">
                                <div id="board-${boardId}" class="position-absolute w-100 h-100" style:"top:0px;left:0px"></div>
                                <div class="position-absolute w-100 text-center" style="z-index:1;left:0px;top:0px">
                                    <h4 style="color:black;text-shadow:2px 0 0 #fff, -2px 0 0 #fff, 0 2px 0 #fff, 0 -2px 0 #fff, 1px 1px #fff, -1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff;">${nickname}</h4>
                                </div>
                            </div>`
                            ).join(`
                            `)}
                        </div>`
                            : ''
                        }
                    </div>
                </div>
            </div>
        `;
        this.overlay.className = this.overlay.className.replace('d-none', 'd-flex');
        for (const [winner, boardId] of winners[0]) {
            const element = document.getElementById('board-'+boardId);
            const board = this.boards[boardId].clone();
            board.workspace = element.parentElement;
            board.canvas.className = 'rounded border';
            board.attach(element);
            this.players[winner].score += 3;
        }
        for (const [winner, boardId] of winners[1]) {
            const element = document.getElementById('board-'+boardId);
            const board = this.boards[boardId].clone();
            board.workspace = element.parentElement;
            board.canvas.className = 'rounded border';
            board.attach(element);
            this.players[winner].score += 2;
        }
        for (const [winner, boardId] of winners[2]) {
            const element = document.getElementById('board-'+boardId);
            const board = this.boards[boardId].clone();
            board.workspace = element.parentElement;
            board.canvas.className = 'rounded border';
            board.attach(element);
            this.players[winner].score += 1;
        }
    }
    endGame(winners) {
        this.overlayContent.innerHTML = '';
        setTimeout(() => {
            this.overlayContent.innerHTML = `
                <div class="container-fluid">
                    <div class="row">
                        <div class="col display-2 text-white">Winners</div>
                    </div>
                    <div class="row justify-content-center">
                        <div class="col-3">
                            ${ winners[1].length ?
                            `<br>
                            <p class="h1 text-success">#2 (${this.players[winners[1][0]].score} pts)</p>
                            <p class="h3">
                                ${winners[1].join('<br>')}
                            </p>`
                                : ''
                            }
                        </div>
                        <div class="col-3">
                            <p class="h1 text-primary">#1 (${this.players[winners[0][0]].score} pts)</p>
                            <p class="h3">
                                ${winners[0].join('<br>')}
                            </p>
                        </div>
                        <div class="col-3">
                            ${ winners[2].length ?
                            `<br>
                            <br>
                            <p class="h1 text-danger">#3 (${this.players[winners[2][0]].score} pts)</p>
                            <p class="h3">
                                ${winners[2].join('<br>')}
                            </p>`
                                : ''
                            }
                        </div>
                    </div>
                    <div class="row justify-content-center">
                        <div class="col-9">
                            <button type="button" id="closeOverlay" class="btn btn-warning btn-block">
                                Leave
                            </button>
                        </div>
                    </div>
                </div>
            `;
            document.getElementById('closeOverlay').addEventListener('click', () => {
                this.overlayContent.innerHTML = '';
                this.overlay.className = this.overlay.className.replace('d-flex', 'd-none');
                this.remove();
                this.constructor.onEnd();
            }, false);
        }, 3000);
        this.overlay.className = this.overlay.className.replace('d-none', 'd-flex');
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