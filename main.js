global.path = require("path");
global.fs = require("fs");
global.process = require("process");
global.os = require("os");
global.https = require("https");

const { app, BrowserWindow, ipcMain, shell, dialog } = require("electron");
const config = require("./modules/config");
const settingsPage = require("./settings-page/settingspage");
const patchnotesPage = require("./patchnotes-page/patchnotespage");
const mod_manager = require("./modules/mod_manager");
const { autoUpdater } = require("electron-updater");

// There are 6 levels of logging: error, warn, info, verbose, debug and silly
const log = require("electron-log");
log.transports.console.format = "[{d}-{m}-{y}] [{h}:{i}:{s}T{z}] -- [{processType}] -- [{level}] -- {text}";
log.transports.file.format = "[{d}-{m}-{y}] [{h}:{i}:{s}T{z}] -- [{processType}] -- [{level}] -- {text}";
log.transports.file.fileName = "main.log";
log.transports.file.maxSize = 10485760;
log.transports.file.getFile();
log.silly("Testing log - MAIN WINDOW");
global.log = log;

const path = global.path;
const majorErrorMessageEnd = "\nPlease report this error to us via email!\nsupport@creators.tf";

var mainWindow;

async function createWindow() {
    try {
        mainWindow = new BrowserWindow({
            minWidth: 960,
            minHeight: 540,
            width: 1200,
            height: 600,
            webPreferences: {
                preload: path.join(__dirname, "preload.js"),
                nodeIntegration: true
            },
            center: true,
            maximizable: true,
            resizable: true,
            autoHideMenuBar: true,
            darkTheme: true,
            backgroundColor: "#2B2826"
        })
        module.exports.mainWindow = mainWindow;
        global.mainWindow = mainWindow;
        global.app = app;
        mainWindow.removeMenu();

        //mainWindow.loadFile(path.resolve(__dirname, 'loading.html'));

        //Load copy of mods data for this process. The rendering process will load its own.

        await loadConfig();
        // and load the index.html of the app.
        //Also setup the mod manager.
        await startMainWindow();
    } 
    catch(majorE) {
        handleMajorError("Startup Error - Major Initial Error", e);
    }
}


app.whenReady().then(async () => {
    await createWindow();
});

autoUpdater.checkForUpdatesAndNotify();
log.info("The launcher was opened and is currently checking for updates");

app.on("window-all-closed", function() {
    // On macOS it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') app.quit()
})

app.on("activate", function() {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
});

autoUpdater.autoDownload = false;
log.info("Auto download for updates is DISABLED.");

autoUpdater.on("checking-for-update", () => {
  log.info("Checking for updates");
});

autoUpdater.on("update-not-available", () => {
  mainWindow.webContents.send("update_not_available");
  log.info("No updates available");
});

autoUpdater.on("update-available", () => {
  mainWindow.webContents.send("update_available");
  log.info("An update is available");
});

ipcMain.on("download_update", () => {
  autoUpdater.downloadUpdate();
  mainWindow.webContents.send("update_downloading");
  log.info("Downloading update");
});

autoUpdater.on("update-downloaded", () => {
  mainWindow.webContents.send("update_downloaded");
  log.info("Update downloaded");
});

autoUpdater.on("error", (err) => {
  log.error("Error in auto-updater: " + err);
});

ipcMain.on("restart_app", () => {
  autoUpdater.quitAndInstall();
  log.info("Restarting program to install an update");
});


ipcMain.on("SettingsWindow", async (event, someArgument) => {
    settingsPage.OpenWindow();
});

ipcMain.on("PatchNotesWindow", async (event, someArgument) => {
    patchnotesPage.OpenWindow();
});

ipcMain.on("app_version", (event) => {
  event.sender.send("app_version", {
    version: app.getVersion()
  });
});

ipcMain.on("GetConfig", async (event, someArgument) => {
    event.reply("GetConfig-Reply", global.config);
});

ipcMain.on("SetCurrentMod", async (event, arg) => {
    mod_manager.ChangeCurrentMod(arg).then((result) => {
        event.reply("InstallButtonName-Reply", result);
    }).catch((error) => {
        event.reply("InstallButtonName-Reply", "Internal Error");
        console.error(error);
        log.error(error);
    });
});

ipcMain.on("install-play-click", async(event, args) => {
    mod_manager.ModInstallPlayButtonClick();
});

ipcMain.on("Visit-Mod-Website", async(event, arg) => {
    shell.openExternal(mod_manager.currentModData.website);
});

ipcMain.on("Visit-Mod-Social", async(event, arg) => {
    let socialLink = mod_manager.currentModData[arg];
    if(socialLink != null && socialLink != ""){
        shell.openExternal(socialLink);
    }
});

ipcMain.on("GetCurrentModVersion", async(event, arg) => {
    let version;
    try {
        version = mod_manager.GetCurrentModVersionFromConfig(mod_manager.currentModData.name);
        if(version == null) version = "?";
    }
    catch {
        version = "?";
    }
    event.reply("GetCurrentModVersion-Reply", version);
});

// TODO -----------------------------
// MAKE THE UNINSTALL BUTTON APPEARS
// ONLY WHEN THE MOD IS INSTALLED
// ----------------------------------
ipcMain.on("Remove-Mod", async(event, arg) => {
    if(mod_manager.currentModData != null && (mod_manager.currentModState == "INSTALLED" || mod_manager.currentModState == "UPDATE" )){
        dialog.showMessageBox(global.mainWindow, {
            type: "question",
            title: "Remove Mod",
            message: `Would you like to uninstall the mod "${mod_manager.currentModData.name}"?`,
            buttons: ["Yes", "Cancel"],
            cancelId: 1
        }).then((button) => {
            if (button.response == 0) {
                log.info("Will start the mod removal process. User said yes.");
                mod_manager.RemoveCurrentMod();
            }
        });
    }
});
async function loadConfig() {
    try {
        //Lets load the config file.
        let c = await config.GetConfig();
        //Make sure the config is loaded in.
        global.config = c;
    }
    catch (e) {
        handleMajorError("Startup Error - Config Load", e);
    }
}

async function startMainWindow() {
    try {
        await mod_manager.Setup();
        mainWindow.loadFile(path.resolve(__dirname, "index.html"));
    }
    catch(e) {
        handleMajorError("Startup Error - Main Window Load", e);
    }
}
function handleMajorError(msg, e) {
    global.log.error(e, msg);
    
    dialog.showMessageBox({
        type: "error",
        title: msg,
        message: e.toString() + majorErrorMessageEnd,
        buttons: ["OK"]
    }).then((button) => {
        app.quit();
    });
}

