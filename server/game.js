const words = require('./words.json');

function shuffle(a) {
    var j, x, i;
    for (i = a.length - 1; i > 0; i--) {
        j = Math.floor(Math.random() * (i + 1));
        x = a[i];
        a[i] = a[j];
        a[j] = x;
    }
    return a;
}

class Game {
    constructor(lobby) {
        lobby.remove();
        this.home = lobby.home;
        this.id = lobby.id;
        this.players = new Set();
        this.settings = lobby.settings;
        this.wordList = this.settings.exclusive ? this.settings.customWords : words.concat(this.settings.customWords);
        this.words = Array.from(this.wordList);
        this.word = null;
        this.round = 0;
        this.time = 0;
        this.state = null;
        this.maxTime = this.settings.time*60;
        this.votingPlayers = null;
        this.winners = null;
        this.home.addGame(this);
        for (const player of lobby.players) {
            this.addPlayer(player);
        }
        lobby = null;
        this.newRound();
    }
    newRound() {
        this.state = 'round';
        this.round++;
        if (this.round > this.settings.rounds) {
            const sortedPlayers = Array.from(this.players).sort((b, a) => a.score - b.score);
            const winners = [[], [], []];
            var length1 = 0, length2 = 0;
            for (const player of sortedPlayers) {
                if (player.score == sortedPlayers[0].score) {
                    winners[0].push(player.nickname);
                    length1++;
                    length2++;
                } else if (player.score == sortedPlayers[length1].score) {
                    winners[1].push(player.nickname);
                    length2++;
                } else if (player.score == sortedPlayers[length2].score) {
                    winners[2].push(player.nickname);
                } else {
                    break;
                }
            }
            if (winners[0].length) winners[0].push(sortedPlayers[0].score);
            if (winners[1].length) winners[1].push(sortedPlayers[length1].score);
            if (winners[2].length) winners[2].push(sortedPlayers[length2].score);
            this.constructor.io.to(this.id).emit('endGame', winners);
            return this.remove();
        }
        if (!this.words.length) {
            this.words = Array.from(this.wordList);
        }
        const random = Math.floor(Math.random() * this.words.length);
        this.word = this.words[random];
        this.words.splice(random, 1);
        this.constructor.io.to(this.id).emit('newRound', this.word, this.maxTime);
        this.time = 0;
        var timer;
        timer = setInterval(() => {
            this.time++;
            if (this.time >= this.maxTime) {
                clearInterval(timer);
                this.state = 'submit';
                for (const player of this.players) {
                    player.socket.on('submit', board => {
                        player.socket.removeAllListeners('submit');
                        player.board = Array.isArray(board) && board;
                    });
                }
                this.constructor.io.to(this.id).emit('endRound');
                setTimeout(() => {
                    this.newVote();
                }, 4000);
            } else {
                this.constructor.io.to(this.id).emit('timeTick');
            }
        }, 1000);
    }
    newVote() {
        this.state = 'vote';
        this.votingPlayers = shuffle(Array.from(this.players).filter(p => p.board));
        this.votingPlayers.forEach((player, index) => player.boardId = index);
        const boardList = this.votingPlayers.map(player => player.board);
        const maxTime = this.votingPlayers.length + 15;
        for (const player of this.players) {
            player.votes = 0;
            player.votedOn = [];
            player.socket.removeAllListeners('submit');
            player.socket.on('vote', id => {
                if (this.votingPlayers[id] && this.votingPlayers[id] !== player && !player.votedOn[id]) {
                    player.votedOn[id] = true;
                    this.votingPlayers[id].votes++;
                }
            });
            player.socket.on('unvote', id => {
                if (this.votingPlayers[id] && this.votingPlayers[id] !== player && player.votedOn[id]) {
                    player.votedOn[id] = false;
                    this.votingPlayers[id].votes--;
                }
            });
            const id = this.votingPlayers.indexOf(player);
            if (id >= 0) boardList[id] = null;
            player.socket.emit('newVote', boardList, maxTime);
            if (id >= 0) boardList[id] = player.board;
        }
        this.time = 0;
        var timer;
        timer = setInterval(() => {
            this.time++;
            if (this.time >= maxTime) {
                clearInterval(timer);
                this.state = 'win';
                for (const player of this.players) {
                    player.socket.removeAllListeners('vote');
                    player.socket.removeAllListeners('unvote');
                }
                const sortedPlayers = this.votingPlayers.sort((b, a) => a.votes - b.votes);
                this.winners = [[], [], []];
                var length1 = 0, length2 = 0;
                for (const player of sortedPlayers) {
                    if (player.votes == sortedPlayers[0].votes) {
                        this.winners[0].push([player.nickname, player.boardId]);
                        player.score += 3;
                        length1++;
                        length2++;
                    } else if (player.votes == sortedPlayers[length1].votes) {
                        this.winners[1].push([player.nickname, player.boardId]);
                        player.score += 2;
                        length2++;
                    } else if (player.votes == sortedPlayers[length2].votes) {
                        this.winners[2].push([player.nickname, player.boardId]);
                        player.score += 1;
                    } else {
                        break;
                    }
                }
                if (this.winners[0].length) this.winners[0].push(sortedPlayers[0].votes);
                if (this.winners[1].length) this.winners[1].push(sortedPlayers[length1].votes);
                if (this.winners[2].length) this.winners[2].push(sortedPlayers[length2].votes);
                this.constructor.io.to(this.id).emit('winners', this.winners);
                setTimeout(() => {
                    this.newRound();
                }, 5000);
            } else {
                this.constructor.io.to(this.id).emit('timeTick');
            }
        }, 1000);
    }
    addPlayer(player) {
        for (const entry of this.players) {
            if (entry.nickname === player.nickname) {
                return player.socket.emit('nameTaken');
            }
        }
        player.socket.on('message', message => {
            if (typeof message != 'string' || !message.length || message.length > 250) return;
            this.constructor.io.to(this.id).emit('message', player.nickname, message);
        });
        this.players.add(player);
        player.socket.join(this.id);
        player.socket.broadcast.to(this.id).emit('playerJoin', player.nickname, player.avatar);
        player.lobby = this;
        player.score = 0;
        var args;
        switch (this.state) {
            case 'round':
                args = this.maxTime-this.time;
                break;
            case 'submit':
                args = null;
                break;
            case 'vote':
                args = [this.votingPlayers.map(entry => entry.board), this.votingPlayers.length+15-this.time];
                player.votes = 0;
                player.votedOn = [];
                player.socket.on('vote', id => {
                    if (this.votingPlayers[id] && !player.votedOn[id]) {
                        player.votedOn[id] = true;
                        this.votingPlayers[id].votes++;
                    }
                });
                player.socket.on('unvote', id => {
                    if (this.votingPlayers[id] && player.votedOn[id]) {
                        player.votedOn[id] = false;
                        this.votingPlayers[id].votes--;
                    }
                });
                break;
            case 'win':
                const winnerBoards = [];
                for (let i=0; i<3; i++) {
                    for (const [winner, boardId] of this.winners[i]) {
                        winnerBoards[boardId] = this.votingPlayers.find(p => p.boardId == boardId);
                    }
                }
                args = [this.winners, winnerBoards];
                break;
        }
        player.socket.emit('gameJoin', this.state, this.round, this.settings.rounds, this.word, Array.from(this.players).map(entry => [entry.nickname, entry.score, entry.avatar]), args);
    }
    remove() {
        for (const player of this.players) {
            this.removePlayer(player);
        }
    }
    removePlayer(player) {
        player.socket.removeAllListeners('submit');
        player.socket.removeAllListeners('vote');
        player.socket.removeAllListeners('unvote');
        player.socket.removeAllListeners('message');
        this.players.delete(player);
        player.lobby = null;
        player.socket.leave(this.id);
        if (!this.players.size) {
            return this.home.removeGame(this);
        }
        this.constructor.io.to(this.id).emit('playerLeave', player.nickname);
    }
    get locked() {
        return this.players.size > 20 || (this.round >= this.settings.rounds && this.state != 'round');
    }
}

module.exports = Game;