const modes = {
    draw: 0,
    erase: 1,
    fill: 2
}

function isNumber(x) {
    return typeof x == 'number';
}

function getPixelPos(canvas, x, y) {
    return (y * canvas.width + x) * 4;
};

function matchStartColor(data, pos, startColor) {
    return  (data[pos]   === startColor.r &&
            data[pos+1] === startColor.g &&
            data[pos+2] === startColor.b &&
            data[pos+3] === startColor.a);
};

function colorPixel(data, pos, color) {
    data[pos] = color.r;
    data[pos+1] = color.g;
    data[pos+2] = color.b;
    data[pos+3] = color.a;
};

function hexToRgb(color) {
    var int = parseInt(color.slice(1), 16);
    return {
        r: (int >> 16) & 255,
        g: (int >> 8) & 255,
        b: int & 255,
        a: 255
    }
}

const brushImages = {
    bucket: new Image(),
    eraser: new Image()
}
brushImages.bucket.src = 'img/fill.gif';
brushImages.eraser.src = 'img/eraser.gif';
const brushCanvas = document.createElement('canvas');
const brushCtx = brushCanvas.getContext('2d');
function setBrush(thickness, color, mode) {
    thickness = parseInt(thickness);
    brushCanvas.width = thickness+(mode==0 ? 0 : 25);
    brushCanvas.height = thickness+(mode==0 ? 0 : 25);
    brushCtx.clearRect(0, 0, brushCanvas.width, brushCanvas.height);
    brushCtx.beginPath();
    const r = thickness/2;
    brushCtx.arc(r, r, r, 0, Math.PI*2);
    brushCtx.fillStyle = color;
    brushCtx.fill();
    brushCtx.strokeStyle = '#ffffff';
    brushCtx.lineWidth = 3;
    brushCtx.stroke();
    brushCtx.strokeStyle = '#000000';
    brushCtx.lineWidth = 1;
    brushCtx.stroke();
    if (mode != 0) {
        brushCtx.drawImage(mode==1 ? brushImages.eraser : brushImages.bucket, thickness, thickness, 25, 25);
    }
    return 'url('+brushCanvas.toDataURL()+') '+r+' '+r+', auto';
}

class Board {
    constructor(settings) {
        this.canvas = document.createElement('canvas');
        this.canvas.width = 800;
        this.canvas.height = 600;
        this.ratio = this.canvas.height/this.canvas.width;
        this.canvas.style.width = '100%';
        this.resize = this.resize.bind(this);
        window.addEventListener('resize', this.resize, false);
        this.observer = new MutationObserver((mutations, observer) => {
            if (mutations.some(m => Array.from(m.removedNodes).includes(this.canvas))) {
                window.removeEventListener('resize', this.resize, false);
                this.observer.disconnect();
            }
        });
        this.ctx = this.canvas.getContext('2d');
        this.clear();
        this.color = '#010101';
        this.thickness = 10;
        this.mode = 0;
        this.actions = [];
        this.lastAction = null;
        this.workspace = null;
        this.checkpoint = [];
        this.redoList = [];
        this.onMouseDown = this.onMouseDown.bind(this);
        this.onMouseMove = this.onMouseMove.bind(this);
        this.onMouseUp = this.onMouseUp.bind(this);
        this.onTouchStart = this.onTouchStart.bind(this);
        this.onTouchMove = this.onTouchMove.bind(this);
        this.onTouchEnd = this.onTouchEnd.bind(this);
        if (settings) {
            this.thickness = settings.thickness.value;
            this.mode = settings.mode;
            this.color = settings.color.value;
            this.resetBrush();
        }
    }
    clone() {
        const clone = new this.constructor();
        clone.actions = this.actions;
        return clone;
    }
    clear() {
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(-100, -100, 1000, 800);
    }
    resetBrush() {
        this.canvas.style.cursor = setBrush(this.thickness, this.mode==modes.erase ? '#ffffff' : this.color, this.mode);
    }
    attach(element, workspace) {
        this.parent = element;
        element.appendChild(this.canvas);
        if (workspace) {
            this.workspace = element;
        }
        this.observer.observe(element, {
          childList: true
        });
        this.resize();
    }
    resize() {
        const width = this.canvas.clientWidth;
        if (width != this.canvas.width) {
            this.canvas.width = width;
            this.canvas.height = width*this.ratio;
            this.ctx.scale(this.canvas.width/800, this.canvas.height/600);
        }
        this.clear();
        this.play();
        if (this.workspace) {
            this.workspace.style.height = this.workspace.style.maxHeight = Math.ceil(this.canvas.height)+'px';
        }
    }
    onTouchStart(e) {
        if (e.targetTouches.length) {
            e.preventDefault();
            this.onMouseUp();
            this.onMouseDown(e.targetTouches.item(0));
        }
    }
    onTouchMove(e) {
        if (e.changedTouches.length) {
            e.preventDefault();
            this.onMouseMove(e.changedTouches.item(0));
        }
    }
    onTouchEnd(e) {
        this.onMouseUp();
    }
    onMouseDown(e) {
        if (e.button) return;
        const rect = this.canvas.getBoundingClientRect()
        const x = Math.floor((e.pageX - rect.left - window.pageXOffset)*800/this.canvas.width),
              y = Math.floor((e.pageY - rect.top - window.pageYOffset)*600/this.canvas.height);
        this.redoList = [];
        this.lastAction = {
            mode: this.mode,
            color: this.color,
            thickness: this.thickness,
            position: [ { x: x, y: y } ]
        }
        this.actions.push(this.lastAction);
        switch (this.mode) {
            case modes.erase:
                this.ctx.strokeStyle = '#ffffff';
            case modes.erase:
            case modes.draw:
                document.addEventListener('mousemove', this.onMouseMove, false);
                document.addEventListener('touchmove', this.onTouchMove, false);
                break;
            case modes.fill:
                this.checkpoint.unshift([this.actions.length-1, this.floodFill(Math.floor(this.canvas.width*x/800), Math.floor(this.canvas.height*y/600), hexToRgb(this.color))]);
                this.play();
                break;
        }
    }
    onMouseMove(e) {
        if (e.button) return;
        const rect = this.canvas.getBoundingClientRect()
        const x = Math.floor((e.pageX - rect.left - window.pageXOffset)*800/this.canvas.width),
              y = Math.floor((e.pageY - rect.top - window.pageYOffset)*600/this.canvas.height);
        switch (this.mode) {
            case modes.draw:
            case modes.erase:
                this.lastAction.position.push({ x: x, y: y });
                this.clear();
                this.play();
                break;
        }
    }
    onMouseUp(e) {
        if (e && e.button) return;
        switch (this.mode) {
            case modes.draw:
            case modes.erase:
                document.removeEventListener('mousemove', this.onMouseMove, false);
                document.removeEventListener('touchmove', this.onTouchMove, false);
        }
    }
    record() {
        this.canvas.addEventListener('mousedown', this.onMouseDown, false);
        document.addEventListener('mouseup', this.onMouseUp, false);
        this.canvas.addEventListener('touchstart', this.onTouchStart, false);
        document.addEventListener('touchend', this.onTouchEnd, false);
    }
    stop() {
        this.canvas.removeEventListener('mousedown', this.onMouseDown, false);
        document.removeEventListener('mouseup', this.onMouseUp, false);
        this.canvas.removeEventListener('touchstart', this.onTouchStart, false);
        document.removeEventListener('touchend', this.onTouchEnd, false);
        this.onMouseUp();
    }
    undo() {
        if (!this.actions.length) return;
        this.redoList.push(this.actions.pop());
        this.clear();
        this.play();
    }
    redo() {
        if (!this.redoList.length) return;
        this.actions.push(this.redoList.pop());
        this.clear();
        this.play();
    }
    floodFill(startX, startY, fillColor) {
        //flood fill algorithm from http://www.williammalone.com/articles/html5-canvas-javascript-paint-bucket-tool/
        var dstImg = this.ctx.getImageData(0,0,this.canvas.width,this.canvas.height);
        var dstData = dstImg.data;
      
        var startPos = getPixelPos(this.canvas, startX, startY);
        if (!matchStartColor(dstData, startPos, fillColor)) {
            var startColor = {
                r: dstData[startPos],
                g: dstData[startPos+1],
                b: dstData[startPos+2],
                a: dstData[startPos+3]
            };

            var todo = [[startX,startY]];
          
            while (todo.length) {
                var pos = todo.pop();
                var x = pos[0];
                var y = pos[1];  
                var currentPos = getPixelPos(this.canvas, x, y);
            
                while((y-- >= 0) && matchStartColor(dstData, currentPos, startColor)) {
                    currentPos -= this.canvas.width * 4;
                }
            
                currentPos += this.canvas.width * 4;
                ++y;
                var reachLeft = false;
                var reachRight = false;
            
                while((y++ < this.canvas.height-1) && matchStartColor(dstData, currentPos, startColor)) {
            
                    colorPixel(dstData, currentPos, fillColor);
              
                    if (x > 0) {
                        if (matchStartColor(dstData, currentPos-4, startColor)) {
                            if (!reachLeft) {
                                todo.push([x-1, y]);
                                reachLeft = true;
                            }
                        } else if (reachLeft) {
                            reachLeft = false;
                        }
                    }
              
                    if (x < this.canvas.width-1) {
                        if (matchStartColor(dstData, currentPos+4, startColor)) {
                            if (!reachRight) {
                                todo.push([x+1, y]);
                                reachRight = true;
                            }
                        } else if (reachRight) {
                            reachRight = false;
                        }
                    }

                    currentPos += this.canvas.width * 4;
                }
            }
        }
        const dstCanvas = document.createElement('canvas');
        dstCanvas.width = this.canvas.width;
        dstCanvas.height = this.canvas.height;
        dstCanvas.getContext('2d').putImageData(dstImg,0,0);
        return dstCanvas;
    };
    drawPath(path) {
        this.ctx.lineCap = "round";
        this.ctx.lineJoin = "round";
        this.ctx.beginPath();
        this.ctx.moveTo(path[0].x, path[0].y);
        for (var i = 1; i < path.length; i++) {
            this.ctx.lineTo(path[i].x, path[i].y);
        }
        this.ctx.stroke();
    }
    play() {
        var startPoint;
        if (this.checkpoint[0]) {
            const [id, canvas] = this.checkpoint[0];
            if (id >= this.actions.length) {
                this.checkpoint.shift();
            } else {
                const transform = this.ctx.getTransform();
                this.ctx.setTransform(1, 0, 0, 1, 0, 0);
                this.ctx.drawImage(canvas, 0, 0, this.canvas.width, this.canvas.height);
                this.ctx.setTransform(transform);
                startPoint = id+1;
            }
        }
        for (var i = startPoint || 0; i < this.actions.length; i++) {
            const action = this.actions[i];
            this.ctx.strokeStyle = action.color;
            this.ctx.lineWidth = action.thickness;
            if (!action.position.length) continue;
            switch (action.mode) {
                case modes.erase:
                    this.ctx.strokeStyle = '#ffffff';
                case modes.draw:
                case modes.erase:
                    this.drawPath(action.position);
                    break;
                case modes.fill:
                    this.checkpoint.unshift([i, this.floodFill(Math.floor(this.canvas.width*action.position[0].x/800), Math.floor(this.canvas.height*action.position[0].y/600), hexToRgb(action.color))]);
                    return this.play();
                    break;
            }
        }
    }
    compress() {
        return this.actions.map(action => [action.mode, parseInt(action.color.replace('#', ''), 16), action.thickness*10, action.position.map(pos => [pos.x, pos.y])]);
    }
    decompress(actions) {
        this.actions = actions.map(action => ({
            mode: (isNumber(action[0]) && action[0] <= 2 && action[0] >= 0) ? action[0] : 0,
            color: isNumber(action[1]) ? '#' + ('000000' + action[1].toString(16)).slice(-6) : '#ffffff',
            thickness: isNumber(action[2]) ? action[2]/10 : 1,
            position: action[3].map(pos => ({x: isNumber(pos[0]) ? pos[0] : 0, y: isNumber(pos[1]) ? pos[1] : 0}))
        }));
        return this;
    }
}

module.exports = Board;