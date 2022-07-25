const { ipcRenderer } = require("electron");

// ----------------------------------------------------------------------------------------------------

class EventEmitter {
    constructor() {
        this.events = {};
    }

    on(event_name, callback) {
        if (this.events[event_name] === 'Emit Before Registor') {
            this.events[event_name] = callback;
            this.events[event_name]();
        }
        else { this.events[event_name] = callback; }
    }

    emit(event_name) {
        if (this.events[event_name]) { this.events[event_name](); }
        else { this.events[event_name] = 'Emit Before Registor' }
    }
}

// ----------------------------------------------------------------------------------------------------

class Controller {
    static instance;
    constructor() {
        if (Controller.instance) { return Controller.instance }
        Controller.instance = this
        this.elements = new DOMElements();
        this.audio_controller = new AudioController();
        this.visualizer = new Visualizer();
        this.player = new Player();

        this.setElementsEvent();
    }

    setElementsEvent() {
        this.elements.on('audio-play-btn-click', () => {
            if (this.audio_controller.audio.paused) { this.player.play(); }
            else { this.player.pause(); }
        });

        this.elements.on('audio-next-btn-click', () => {
            if (!this.audio_controller.audio.paused) { this.elements.play_btn.click(); }
            this.player.toNext();
        });

        this.elements.on('audio-prev-btn-click', () => {
            if (!this.audio_controller.audio.paused) { this.elements.play_btn.click(); }
            this.player.toPrev();
        });

        this.elements.on('folder-btn-click', () => {
            ipcRenderer.send('folder-btn-click');
        });

        this.elements.on('volume-to-0.0', () => { this.audio_controller.audio.volume = 0.0; });
        this.elements.on('volume-to-0.5', () => { this.audio_controller.audio.volume = 0.5; });
        this.elements.on('volume-to-1.0', () => { this.audio_controller.audio.volume = 1.0; });

        ipcRenderer.on('update-song-paths', (event, args) => {
            if (!this.audio_controller.audio.paused) { this.elements.play_btn.click(); }
            this.player.updateSongPaths(args);
        });

        ipcRenderer.on('toggle-mini-player', () => {
            this.visualizer.canvas = new Canvas();
            this.visualizer.canvas.draw();
        });
    }

    getStyleVariableValue(variable_name) { return getComputedStyle(document.documentElement).getPropertyValue(variable_name); }
}

// ----------------------------------------------------------------------------------------------------

class Player {
    constructor() {
        this.controller = new Controller()
        this.elements = this.controller.elements;
        this.audio_controller = this.controller.audio_controller;
        this.visualizer = this.controller.visualizer;

        this.song_paths = ['./assets/15-second-countdown.mp3'];
        this.song_index = 0;
        this.audio_controller.on('audio-load', () => this.start());
        this.audio_controller.loadAudio(this.song_paths[this.song_index]);
    }

    play() {
        this.audio_controller.play();
        this.visualizer.play();
    }

    pause() {
        this.audio_controller.pause();
        this.visualizer.pause();
    }

    end() {
        this.audio_controller.pause();
        this.visualizer.clear();
        this.toNext();
        this.play();
    }

    start() {
        this.audio_controller.audio.addEventListener('timeupdate', () => {
            const totalSeconds = this.audio_controller.audio.currentTime;
            const minutes = Math.round(totalSeconds / 60).toString().padStart(2, '0');
            const seconds = Math.round(totalSeconds % 60).toString().padStart(2, '0');
            this.elements.timer.innerText = `${minutes}:${seconds}`;
        });

        this.audio_controller.audio.addEventListener('ended', () => this.end());

        this.elements.marquee.innerText = this.song_paths[this.song_index].replace(/^.*[\\\/]/, '');

        this.visualizer.clear();
    }

    toNext() {
        this.song_index = this.song_index + 1 < this.song_paths.length ? this.song_index + 1 : 0;
        this.audio_controller.loadAudio(this.song_paths[this.song_index]);
    }

    toPrev() {
        this.song_index = this.song_index - 1 >= 0 ? this.song_index - 1 : this.song_paths.length - 1;
        this.audio_controller.loadAudio(this.song_paths[this.song_index]);
    }

    updateSongPaths(song_paths) {
        this.song_paths = song_paths.length > 0 ? song_paths : this.song_paths;
        this.song_index = 0;
        this.audio_controller.loadAudio(this.song_paths[this.song_index]);
    }
}

class AudioController extends EventEmitter {
    constructor() {
        super();
    }

    loadAudio(src) {
        let volume = this.audio ? this.audio.volume : 1.0;

        this.audio = new Audio(src);
        this.audio.volume = volume;
        this.context = new (window.AudioContext || window.webkitAudioContext)();

        this.source = this.context.createMediaElementSource(this.audio);
        this.analyser = this.context.createAnalyser();

        this.source.connect(this.analyser);
        this.analyser.connect(this.context.destination);

        this.analyser.fftSize = 2048;

        this.frequency_array = new Uint8Array(this.analyser.frequencyBinCount);
        this.frequency_average = 0.0;

        this.emit('audio-load');
    }

    play() {
        if (this.context.state === 'suspended') { this.context.resume(); }
        this.audio.play();
    }

    pause() { this.audio.pause(); }

    getAudioProgressPercentage() { return this.audio.currentTime / this.audio.duration; }

    setAudioProgressPercentage(percentage) { this.audio.currentTime = percentage * this.audio.duration; }

    updateFrequencyData() {
        this.analyser.getByteFrequencyData(this.frequency_array);
        this.frequency_average = this.frequency_array.reduce((a, b) => a + b) / this.frequency_array.length;
    }

    clearFrequencydata() {
        this.frequency_array.fill(0);
        this.frequency_average = 0.0;
    }

    getFrequencyData() { return [this.frequency_array, this.frequency_average]; }
}

// ----------------------------------------------------------------------------------------------------

class Visualizer {
    constructor() {
        this.canvas = new Canvas()

        this.controller = new Controller();
        this.audio_controller = this.controller.audio_controller;
        this.animation_id = 0;
    }

    play() {
        this.audio_controller.updateFrequencyData();
        this.canvas.rotate();
        this.canvas.draw();
        this.animation_id = requestAnimationFrame(() => this.play());
    }

    pause() {
        cancelAnimationFrame(this.animation_id);
    }

    clear() {
        cancelAnimationFrame(this.animation_id);
        this.audio_controller.clearFrequencydata();
        this.canvas.draw();
    }
}

class Canvas {
    constructor() {
        this.controller = new Controller()
        this.elements = this.controller.elements;
        this.getStyleVariableValue = this.controller.getStyleVariableValue;

        this.element_canvas = this.elements.canvas;
        this.element_canvas.setAttribute('width', this.elements.player.clientWidth + 'px');
        this.element_canvas.setAttribute('height', this.elements.player.clientHeight + 'px');
        this.center_x = this.element_canvas.clientWidth / 2;
        this.center_y = this.element_canvas.clientHeight / 2;
        this.radius = this.element_canvas.clientHeight / 2;

        this.context = this.element_canvas.getContext('2d');

        this.rotate_radians = 0.0;
        this.rotate_speed = 0.002;

        this.ticks = new Ticks(this);
        this.tracker = new Tracker(this);
    }

    draw() {
        this.clear();
        this.ticks.draw();
        this.tracker.draw();
    }

    clear() {
        this.context.clearRect(0, 0, this.element_canvas.clientWidth, this.element_canvas.clientHeight);
    }

    rotate() {
        this.rotate_radians = (this.rotate_radians + this.rotate_speed) % (Math.PI * 2);
        this.element_canvas.style.transform = `rotate(${this.rotate_radians}rad)`;
    }

    polarToXY(radius, angle) {
        angle = (angle - 90) * Math.PI / 180;
        return {
            x: this.center_x + radius * Math.cos(angle),
            y: this.center_y + radius * Math.sin(angle)
        };
    }

    XYToPolar(x, y) {
        x = x - this.center_x;
        y = y - this.center_y;

        const radians = Math.atan2(y, x)
        return {
            radius: Math.sqrt(x * x + y * y),
            radians: radians > 0 ? radians : Math.PI * 2 + radians
        };
    }
}

class Ticks {
    constructor(canvas) {
        this.canvas = canvas;

        this.controller = new Controller();
        this.audio_controller = this.controller.audio_controller;
        this.getStyleVariableValue = this.controller.getStyleVariableValue;

        this.base_height = 10;
        this.max_height = this.getStyleVariableValue('--tick-max-height').slice(0, -2);
        this.radius = this.canvas.radius - this.max_height;

        this.context_line_width = 2
        this.context_stroke_style = this.canvas.context.createLinearGradient(0, 0, this.canvas.radius * 2, this.canvas.radius * 2);
        this.context_stroke_style.addColorStop(0.0, this.getStyleVariableValue('--player-primary-gradient-color-1'));
        this.context_stroke_style.addColorStop(0.3, this.getStyleVariableValue('--player-primary-gradient-color-2'));
        this.context_stroke_style.addColorStop(0.7, this.getStyleVariableValue('--player-primary-gradient-color-3'));
        this.context_stroke_style.addColorStop(1.0, this.getStyleVariableValue('--player-primary-gradient-color-4'));

        // determine the density between ticks;
        this.shift_angle = 2;
    }

    draw() {
        this.canvas.context.lineWidth = this.context_line_width;
        this.canvas.context.strokeStyle = this.context_stroke_style;

        for (let angle = 0; angle < 360; angle += this.shift_angle) {
            const u = this.canvas.polarToXY(this.radius, angle);
            const v = this.canvas.polarToXY(this.radius + this.calcTickHeight(angle), angle);
            this.canvas.context.beginPath();
            this.canvas.context.moveTo(u.x, u.y);
            this.canvas.context.lineTo(v.x, v.y);
            this.canvas.context.stroke();
        }
    }

    calcTickHeight(angle) {
        const index = 100 + parseInt(angle);
        const height = (this.audio_controller.frequency_array[index] - this.audio_controller.frequency_average) * 0.4;
        return Math.min(this.max_height, this.base_height + Math.max(0, height));
    }
}

class Tracker {
    constructor(canvas) {
        this.canvas = canvas;

        this.controller = new Controller();
        this.elements = this.controller.elements;
        this.audio_controller = this.controller.audio_controller;
        this.getStyleVariableValue = this.controller.getStyleVariableValue;

        this.tracker_ball = this.elements.tracker_ball;

        this.begin_radians = Math.PI + parseFloat(this.getStyleVariableValue('--tracker-transform-begin-radians').slice(0, -3));
        this.delta_radians = 0.0;

        this.margin = parseInt(this.getStyleVariableValue('--tracker-margin').slice(0, -2));
        this.radius = this.canvas.radius - this.canvas.ticks.max_height - this.margin;

        this.context_line_width = 3;
        this.context_stroke_style = this.getStyleVariableValue('--player-primary-tracker-color');
        
        this.setEvent();
    }

    draw() {
        this.delta_radians = (this.audio_controller.getAudioProgressPercentage() || 0) * Math.PI * 2;
        this.tracker_ball.style.transform = `rotate(${this.begin_radians + this.delta_radians - Math.PI}rad)`;

        this.canvas.context.lineWidth = this.context_line_width;
        this.canvas.context.strokeStyle = this.context_stroke_style;
        this.canvas.context.beginPath();
        this.canvas.context.arc(
            this.canvas.center_x,
            this.canvas.center_y,
            this.radius,
            this.begin_radians - this.canvas.rotate_radians,
            this.begin_radians + this.delta_radians - this.canvas.rotate_radians,
        );
        this.canvas.context.stroke();
    }

    setEvent() {
        this.elements.player.addEventListener('click', (e) => {
            const click_viewport_x = e.clientX;
            const click_viewport_y = e.clientY;
            const player_viewport_x = this.elements.player.getBoundingClientRect().left;
            const player_viewport_y = this.elements.player.getBoundingClientRect().top;
            if (this.update(click_viewport_x - player_viewport_x, click_viewport_y - player_viewport_y)) {
                this.canvas.draw()
            }
        })
    }

    update(x, y) {
        const p = this.canvas.XYToPolar(x, y);
        if (Math.abs(p.radius - this.radius) > 5) return false;

        let percentage = (p.radians + Math.PI * 2 - this.begin_radians) / (Math.PI * 2);
        percentage -= Math.floor(percentage);
        this.audio_controller.setAudioProgressPercentage(percentage);

        return true;
    }
}

// ----------------------------------------------------------------------------------------------------

class DOMElements extends EventEmitter {
    constructor() {
        super();

        this.player = document.querySelector('.player');
        this.canvas = document.querySelector('.canvas');
        this.marquee = document.querySelector('.marquee');
        this.timer = document.querySelector('.timer');
        this.tracker_ball = document.querySelector('.tracker-ball');

        this.hue_rotate_angle = 330;

        this.setColorBtnEvent();
        this.setPlayBtnEvent();
        this.setNextBtnEvent();
        this.setPrevBtnEvent();
        this.setSoundBtnEvent();
        this.setFolderBtnEvent();
    }

    setColorBtnEvent() {
        this.player.style.filter = `hue-rotate(${this.hue_rotate_angle}deg)`;

        let color_btn = document.querySelector('.color-btn');
        color_btn.addEventListener('click', () => {
            this.hue_rotate_angle = (this.hue_rotate_angle + 10) % 360;
            this.player.style.filter = `hue-rotate(${this.hue_rotate_angle}deg)`;
        });
    }

    setPlayBtnEvent() {
        let that = this;
        this.play_btn = document.querySelector('.play-btn');
        this.play_btn.addEventListener('click', function() {
            this.children[0].classList.toggle('hidden');
            this.children[1].classList.toggle('hidden');
            that.emit('audio-play-btn-click');
        })
    }

    setNextBtnEvent() {
        let next_btn = document.querySelector('.next-btn');
        next_btn.addEventListener('click', () => this.emit('audio-next-btn-click'));
    }

    setPrevBtnEvent() {
        let prev_btn = document.querySelector('.prev-btn');
        prev_btn.addEventListener('click', () => this.emit('audio-prev-btn-click'));
    }

    setSoundBtnEvent() {
        let that = this;
        let sound_btn = document.querySelector('.sound-btn');
        sound_btn.addEventListener('click', function() {
            if (!this.children[0].classList.contains('hidden')) {
                this.children[0].classList.add('hidden');
                this.children[1].classList.remove('hidden');
                this.children[2].classList.add('hidden');

                that.emit('volume-to-0.5');
            }
            else if (!this.children[1].classList.contains('hidden')) {
                this.children[0].classList.add('hidden');
                this.children[1].classList.add('hidden');
                this.children[2].classList.remove('hidden');

                that.emit('volume-to-0.0');
            }
            else {
                this.children[0].classList.remove('hidden');
                this.children[1].classList.add('hidden');
                this.children[2].classList.add('hidden');

                that.emit('volume-to-1.0');
            }
        })
    }

    setFolderBtnEvent() {
        let folder_btn = document.querySelector('.folder-btn');
        folder_btn.addEventListener('click', () => this.emit('folder-btn-click'));
    }
}

window.addEventListener('load', () => { new Controller(); })