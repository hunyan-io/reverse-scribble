const Board = require('./board.js');

class Game {
    constructor(socket) {
        this.socket = socket;
        this.element = document.getElementById('game');
        this.hidden = true;
        this.toolBox = document.getElementById('toolBox');
        this.displayBox = document.getElementById('displayBox');
        this.chatBox = document.getElementById('chatBox');
        this.chatInput = document.getElementById('chatInput');
        this.scoreList = document.getElementById('scoreList');
        this.boardSpace = document.getElementById('boardSpace');
        this.boardModel = document.getElementById('boardModel');
        this.boardModel.removeAttribute('id');
        this.boardModel.remove();
        this.timeBox = document.getElementById('timeBox');
        this.wordContent = document.getElementById('wordContent');
        this.roundBox = document.getElementById('roundBox');
        this.overlay = document.getElementById('overlay');
        this.overlayContent = document.getElementById('overlayContent');
        this.settings = {
            thickness: document.getElementById('thickness'),
            color: document.getElementById('colorPalette'),
            mode: 0
        }
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
        var whiteDiv = false;
        var lastMessage = {};
        socket.on('message', (nickname, message) => {
            const scrolled = this.chatBox.scrollTop && this.chatBox.scrollTop != this.chatBox.scrollHeight - this.chatBox.clientHeight;
            var element;
            if (nickname == lastMessage.sender) {
                element = lastMessage;
            } else {
                whiteDiv = !whiteDiv;
                element = document.createElement('div');
                element.className = 'py-1 px-2 bg-' + (whiteDiv ? 'white' : 'light');
                element.innerHTML = `
                  <div class="row no-gutters">  
                    <div class="col-2 p-0">
                      <div class="position-relative w-100" style="height:0;padding-bottom:100%">
                        <img class="position-absolute img-thumbnail w-100 h-100 rounded-circle" src="${this.players[nickname].avatar}" style="top:0;left:0">
                      </div>
                    </div>
                    <div class="col-10 pl-2">
                      <div class="d-flex flex-column w-100 h-100">
                        <strong>${nickname}</strong>
                      </div>
                    </div>
                  </div>  
                `;
            }
            const text = document.createElement('span');
            text.style.fontSize = '.8rem';
            text.textContent = message;
            element.querySelector('.flex-column').appendChild(text);
            lastMessage = element;
            lastMessage.sender = nickname;
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
        this.element.remove();
        this.element.style.display = 'block';
    }
    start(stats) {
        const [state, round, maxRound, word, playerList, args] = stats;
        document.body.appendChild(this.element);
        this.hidden = false;
        this.chatBox.innerHTML = '';
        this.wordContent.textContent = word;
        this.roundBox.textContent = 'Round '+round+' of '+maxRound;
        this.round = round;
        this.maxRound = maxRound;
        this.players = {};
        this.board = null;
        this.boards = [];
        this.socket.on('playerJoin', (nickname, avatar) => {
            this.addPlayer(nickname, 0, avatar);
        });
        this.socket.on('playerLeave', nickname => {
            const player = this.players[nickname];
            delete this.players[nickname];
            player.score = 0;
        });
        for (const [nickname, score, avatar] of playerList) {
            this.addPlayer(nickname, score, avatar);
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
                this.round--;
                this.newRound(word, 0);
                this.waitForSubmit();
                this.newVote(args[1], 0);
                this.roundWinners(args[0]);
                break;
        }
        this.setMode(this.settings.mode);
    }
    setDisplay(n) {
        this.displayBy = n;
        if (this.boards) {
            for (const board of this.boards) {
                if (!board) continue;
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
    addPlayer(nickname, score, avatar) {
        const scoreList = this.scoreList,
              players = this.players;
        avatar = avatar ? 'https://i.imgur.com/'+avatar : 'img/placeholder.png';
        const node = document.createElement('div');
        node.className = "list-group-item p-1";
        node.innerHTML = `
          <div class="row no-gutters">  
            <div class="col-4 p-1">
              <div class="position-relative w-100" style="height:0;padding-bottom:100%">
                <img class="position-absolute img-thumbnail w-100 h-100 rounded-circle" src="${avatar}" style="top:0;left:0">
              </div>
            </div>
            <div class="col-8 pl-2">
              <div class="d-flex flex-column w-100 h-100 justify-content-center">
                <strong>${nickname}</strong>
                <small id="playerScore"></small>
              </div>
            </div>
          </div>  
        `;
        node.score = node.querySelector('#playerScore');
        node.score.removeAttribute('id');
        players[nickname] = {
            avatar: avatar,
            node: node,
            _score: 0,
            set score(value) { 
                this._score = value
                this.node.score.textContent = value + ' pts';
                scoreList.innerHTML = '';
                for (const player of Object.values(players).sort((b, a) => a.score - b.score)) {                    
                    scoreList.appendChild(player.node);
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
    addBoard(board, id) {
        if (!board) return;
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
        if (id !== undefined) {
            voteBtn.addEventListener('click', () => {
                voting = !voting;
                voteBtn.className = voteBtn.className.replace(voting ? 'btn-primary' : 'btn-danger', voting ? 'btn-danger' : 'btn-primary');
                voteBtn.textContent = voting ? 'Unvote' : 'Vote';
                board.display.className = 'bg-light mb-auto rounded border' + (voting ? ' border-primary col-' : ' col-')+(12/this.displayBy);
                board.display.style.setProperty('border-width', voting ? '8px' : '3px', 'important');
                this.socket.emit(voting ? 'vote' : 'unvote', id);
            }, false);
        } else {
            voteBtn.disabled = true;
        }
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
    newVote(boards, maxTime) {
        this.overlay.className = this.overlay.className.replace('d-flex', 'd-none');;
        this.toolBox.className = this.toolBox.className.replace('d-inline-flex', 'd-none');
        this.displayBox.className = this.displayBox.className.replace('d-none', 'd-flex');
        this.boardSpace.innerHTML = '';
        this.boardSpace.className = 'row no-gutters justify-content-center';
        this.boardSpace.style.overflowY = 'auto';
        let selfBoard;
        if (this.board) {
            selfBoard = this.board.clone();
            this.board = null;
        }
        this.boards = boards.map(info => info && new Board().decompress(info));
        this.timeBox.textContent = maxTime;
        this.addBoard(selfBoard);
        var id = 0;
        for (const board of this.boards) {
            if (!board) {
                if (selfBoard) {
                    this.boards[this.boards.indexOf(board)] = selfBoard;
                }
                continue;
            }
            this.addBoard(board, id++);
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
                    <div class="row justify-content-center mt-4">
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
        }, 1000);
        this.overlay.className = this.overlay.className.replace('d-none', 'd-flex');
    }
    remove() {
        this.element.remove();
        this.overlay.className = this.overlay.className.replace('d-flex', 'd-none');
        this.socket.removeAllListeners('playerJoin');
        this.socket.removeAllListeners('playerLeave');
        this.hidden = true;
    }
}

module.exports = Game;