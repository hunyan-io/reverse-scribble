var room_id;
for (const parameter of window.location.search.substr(1).split("&")) {
    const pair = parameter.split('=');
    if (pair[0] == 'id') {
        room_id = decodeURIComponent(pair[1]);
        break;
    }
}

class Home {
    constructor(socket) {
        this.element = document.getElementById('home');
        this.socket = socket;
        this.hidden = false;
        const playBtn = document.getElementById('play-btn');
        const roomBtn = document.getElementById('room-btn');
        const nickname = document.getElementById('nickname');
        socket.on('nameTaken', () => {
            this.alert('Nickname Taken', 'Your nickname is already taken!');
        });
        socket.on('noRoom', () => {
            this.alert('Error', 'No ongoing games found. Please create a new room!');
        });
        playBtn.addEventListener('click', ()=>{
            if (!nickname.value) {
                return this.alert('Invalid Nickname','Please enter a new nickname!');
            }
            socket.emit('play', room_id, nickname.value);
        }, false);
        roomBtn.addEventListener('click', ()=>{
            if (!nickname.value) {
                return this.alert('Invalid Nickname', 'Please enter a new nickname!');
            }
            socket.emit('create', nickname.value);
        }, false);
    }
    start() {
        document.body.appendChild(this.element);
        this.hidden = false;
    }
    remove() {
        this.element.remove();
        this.hidden = true;
    }
    alert(title, body) {
        $('#modalTitle').html(title);
        $('#modalBody').html(body);
        $('#modal').modal();
    }
}

module.exports = Home;