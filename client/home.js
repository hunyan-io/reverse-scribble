var room_id;
for (const parameter of window.location.search.substr(1).split("&")) {
    const pair = parameter.split('=');
    if (pair[0] == 'id') {
        room_id = pair[1];
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
        nickname.value = localStorage.getItem('nickname');
        const avatar = {
            input: document.getElementById('avatarInput'),
            image: document.getElementById('avatarImg'),
            field: document.getElementById('avatarField'),
            status: document.getElementById('avatarStatus'),
            overlay: document.getElementById('avatarOverlay'),
            uploading: false,
            url: localStorage.getItem('avatar')
        }
        if (avatar.url) {
            avatar.image.src = avatar.url;
        }
        socket.on('nameTaken', () => {
            this.alert('Nickname Taken', 'Your nickname is already taken!');
        });
        socket.on('noRoom', () => {
            this.alert('Error', 'No ongoing games found. Please create a new room!');
        });
        playBtn.addEventListener('click', () => {
            if (!nickname.value) {
                return this.alert('Invalid Nickname','Please enter a new nickname!');
            }
            localStorage.setItem('nickname', nickname.value);
            socket.emit('play', room_id, nickname.value, avatar.url);
        }, false);
        roomBtn.addEventListener('click', () => {
            if (!nickname.value) {
                return this.alert('Invalid Nickname', 'Please enter a new nickname!');
            }
            socket.emit('create', nickname.value, avatar.url);
        }, false);
        avatar.field.addEventListener('click', e => {
            if (avatar.uploading) {
                e.preventDefault();
            }
        }, false);
        avatar.field.addEventListener('mouseover', e => {
            if (!avatar.uploading && e.target == avatar.image) {
                avatar.overlay.style.display = 'flex';
            }
        }, false);
        avatar.field.addEventListener('mouseout', e => {
            if (e.target == avatar.overlay) {
                avatar.overlay.style.display = 'none';
            }
        }, false);
        avatar.input.addEventListener('change', () => {
            const file = avatar.input.files[0];
            if (!file || !file.type.match(/^image\/.*$/)) return;
            avatar.uploading = true;
            avatar.status.style.display = 'block';
            avatar.field.style.cursor = 'auto';
            const body = new FormData();
            body.append('file', file);
            body.append('upload_preset', 'xxwrwhyd')
            const data = fetch('https://api.cloudinary.com/v1_1/reverse-scribble/image/upload', {
                method: 'POST',
                body: body
            })
            .then(data => data.json())
            .then(data => {
                if (data.secure_url) {
                    avatar.url = data.secure_url;
                    localStorage.setItem('avatar', avatar.url);
                    const promise = new Promise((res, rej) => {
                        const timer = setTimeout(rej, 20000);
                        avatar.image.onload = () => {
                            clearTimeout(timer);
                            res();
                        }
                    });
                    avatar.image.src = avatar.url;
                    return promise;
                } else {
                    throw new Error();
                }
            })
            .catch((e) => {
                this.alert('Error', 'There was an error uploading your avatar.');
            })
            .finally(() => {
                avatar.uploading = false;
                avatar.status.style.display = 'none';
                avatar.field.style.cursor = 'pointer';
            });
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