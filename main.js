const { BrowserWindow, app, ipcMain, dialog, globalShortcut } = require("electron");
const path = require('path');
const fs = require('fs');

class Application {
    constructor() {
        app.whenReady().then(() => {
            this.createWindow();

            app.on('activate', () => {
                if (BrowserWindow.getAllWindows().length == 0) {
                    this.createWindow();
                }
            })
        });

        app.on('window-all-closed', () => {
            if (process.platform !== 'darwin') {
                app.quit()
            }
        })
    }

    createWindow() {
        this.window = new BrowserWindow({
            width: 400,
            height: 400,
            frame: false,
            resizable: false,
            transparent: true,
            skipTaskbar: true,
            alwaysOnTop: true,
            webPreferences: {
                preload: path.join(__dirname, 'preload.js'),
                nodeIntegration: false,
                enableRemoteModule: false,
                contextIsolation: true,
                sandbox: true
            }
        });
        this.window.loadFile('index.html');

        this.addEventListeners();
        globalShortcut.register('ctrl+m', () => this.toggleMiniPlayer());
        globalShortcut.register('ctrl+t', () => this.window.setAlwaysOnTop(!this.window.isAlwaysOnTop()));
    }

    toggleMiniPlayer() {
        if (this.window.getContentSize()[0] === 400) {
            this.window.setContentSize(300, 300);
            const [x, y] = this.window.getPosition();
            this.window.setPosition(x + 50, y + 50);
        }
        else {
            this.window.setContentSize(400, 400);
            const [x, y] = this.window.getPosition();
            this.window.setPosition(x - 50, y - 50);
        }
        this.window.webContents.send('toggle-mini-player');
    }

    addEventListeners() {
        // add menu button click event
        ipcMain.on('popup-setting-menu', function() { this.menu.popup() });

        // add folder button click event
        ipcMain.on('folder-btn-click', async (event, arg) => {
            const result = await dialog.showOpenDialog(this.window, { properties: ['openDirectory'] });

            if (!result.canceled) {
                event.reply(
                    'update-song-paths',
                    result.filePaths.flatMap(filePath =>
                        fs.readdirSync(filePath)
                            .filter(file => file.endsWith('.mp3'))
                            .map(file => path.join(filePath, file))
                    )
                );
            }
        });
    }
}

const application = new Application();