require('../typedefs.js')
const process = global.process;
const fs = global.fs;
const os = global.os;
const path = global.path;

const pathStringRegex = new RegExp(/("(\S+[:]+[\S]+)")/, 'g'); //Home made regex to find a path. May not be perfect.

module.exports = {
    config: null,
    
    //Save the config given.
    SaveConfig (_config) {
        let filepathfull = this.GetConfigFullPath();

        fs.writeFileSync(filepathfull, JSON.stringify(_config), 'utf8');
        global.log.log("Config file was saved.");
    },

    //Get the config from disk.
    GetConfig: async function GetConfig() {
        //If config is null, load it.
        let filepathfull = this.GetConfigFullPath();

        //If the config file exists, read and parse it.
        if(fs.existsSync(filepathfull)){
            this.config = JSON.parse(fs.readFileSync(filepathfull, 'utf8'));
            global.log.log("Loaded pre existing config");
            return this.config;
        } else {
            global.log.log("User does not have a config file, creating one");
            //Create default config
            this.config = {
                steam_directory: "",
                tf2_directory: "",
                current_mod_versions: []
            }

            //Try to populate the default values of the steam directory and tf2 directory automatically.
            this.config.steam_directory = GetSteamDirectory();

            global.log.log(`Auto locater for the users steam directory returned '${this.config.steam_directory}'`);

            if(this.config.steam_directory != "") {
                //Try to find the users tf2 directory automatically.
                try {
                    let result = await this.GetTF2Directory(this.config.steam_directory)

                    global.log.log("TF2 directory was found successfully at: " + result);
                    this.config.tf2_directory = result;
                } catch {
                    global.log.error("TF2 directory was not found automatically");
                }
            }
            //Return whether or not the TF2/Steam directory was found
            //User is told later anyway.
            this.SaveConfig(this.config);
            return this.config;
        }
    },

    //This attempts to find the users tf2 directory automatically.
    GetTF2Directory: async function GetTF2Directory(steamdir) {
        let tf2path = "steamapps/common/Team Fortress 2/";

        //Check if tf2 is installed in the steam installation steamapps.
        if (fs.existsSync(path.join(steamdir, tf2path))) {
            tf2path = path.join(steamdir, tf2path);
            return tf2path;
        } else {
            //Check the library folders file and check all those for the tf2 directory.
            let libraryfolders = `${steamdir}/steamapps/libraryfolders.vdf`;
            if (fs.existsSync(libraryfolders)) {
                //How this works:
                //Read the lines of the libraryfolders
                //If we find a match with the regular expression, we have a possible other library folder.
                //We check this library folder to see if it has a tf2 install folder.
                //If yes, we use this!
                //If no, we just fail.

                let data = fs.readFileSync(libraryfolders, 'utf8');
                let lines = data.split("\n");
                for (let i = 0; i < lines.length; i++) {
                    let result = pathStringRegex.exec(lines[i]);
                    if (result) {
                        if (result[2]) {
                            let potentialPath = path.join(result[2], "/", tf2path);
                            if(fs.existsSync(potentialPath)){
                                return potentialPath;
                            }
                        }
                    }
                }
                throw new Error("No other tf2 libraries had TF2");
            } else {
                throw new Error("TF2 not found in base install location, no other libraries found.");
            }
        }
    },

    GetConfigFullPath(){
        let _path = (process.env.APPDATA || (process.platform == 'darwin' ? process.env.HOME + '/Library/Preferences' : process.env.HOME + "/.local/share")) + "/creators-tf-launcher";
        
        if(!fs.existsSync(_path)) fs.mkdirSync(_path);
    
        let fullpath = path.join(_path, configname);
        return fullpath;
    },

    /**
     * replaces known variable (i.e. {tf2_dir}) and normalizes the path
     * @param {string} p path tp expand
     * @returns {string} replaced and normalized path
     */
    ResolveVariables(p){
        return path.normalize(p.replace("{tf2_dir}", this.config.tf2_directory));
    }
};

var configname = "config.json";

//Attempts to locate the steam directory automatically.
//This aids in finding the tf2 dir later.
function GetSteamDirectory() {
    var basedir = "";
    /**
     * Gets first existing path in an array of strings
     * @param {string[]} steamPaths An array of directory paths
     * @param {string} pathPrefix A path to add before each path in steamPaths before checking
     * @returns First existing path in steamPaths or null if none of the paths exist, with prefix added
     */
    var getExistingPath = function(steamPaths, pathPrefix="") {
        for (let steamPath of steamPaths) {
            steamPath = path.join(pathPrefix, steamPath);
            if(fs.existsSync(steamPath)) {
                return steamPath;
            }
        }

        return "";
    }

    //Try to find steam installation directory
    //Not using the registry for Windows installations
    //We check the most likely install paths.
    if (os.platform() == "win32") {
        var steamPaths = ["C:/Program Files (x86)/Steam", "C:/Program Files/Steam"];
        basedir = getExistingPath(steamPaths);
    } else if (os.platform() == "linux" || "freebsd" || "openbsd") {
        //Linux solution is untested
        var homedir = process.env.HOME;
        var steamPaths = [
            {
                "paths": [".steam/steam"],
                "prefix": homedir
            },
            {
                "paths": [".local/share/steam"],
                "prefix": ""
            }
        ]
        
        for(const pathGroup of steamPaths) {
            basedir = getExistingPath(pathGroup["paths"], pathGroup["prefix"])
            if(basedir != "") {
                break;
            }
        }
    } else {
        basedir = "";
    }

    return basedir;
}
