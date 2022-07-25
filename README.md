# Circular Audio Visualizer

## About this project

This is a project that visually displays the rhythm, volume, tempo, and frequency of music.

This is a desktop application that was created using Electron, a cross-platform desktop application framework. All of the project's functionality is built from scratch in JavaScript.

The layout of this project was inspired by [Alex Permyakov](https://codepen.io/alexdevp/full/RNELPV).

<style>
.player-images
{
    display: flex;
}

.player-images img
{
    width: 400px;
    height: 400px;
}

.player-images div
{
    display: flex;
    flex-direction: column;
}

.player-images div img
{
    width: 200px;
    height: 200px;

    margin: 0;
    padding: 0;
}
</style>
<div class="player-images">
    <img src="https://i.imgur.com/M0d6GR9.png">
    <div>
        <img src="https://i.imgur.com/IBUfQqA.png">
        <img src="https://i.imgur.com/Qj8JaK1.png">
    </div>
</div>


## Features

* Playing mp3 files in the local folder
* Switching between regular and mini size player
* Controllable player progress bar


## Usage

* `Ctrl + M` switch between regular and mini size player
* `Ctrl + T` toggle window always on top
* `Ctrl + W` Close window