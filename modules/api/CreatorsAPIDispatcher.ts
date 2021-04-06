import axios, { Method } from "axios";
import { CreatorsAPICommand} from "./CreatorsAPICommand";
import electronIsDev from "electron-is-dev";
import ElectronLog from "electron-log";

const apiEndpoint = "https://creators.tf/api/";

class CreatorsAPIDispatcher
{
    public static instance = new CreatorsAPIDispatcher();

    async ExecuteCommand(command: CreatorsAPICommand<any>){
        try{
            let resp = await axios.request({
                method: <Method>command.requestType,
                url: this.CreateRequestUrl(command),
                data: JSON.stringify(command.GetCommandParameters()),
                headers: {
                    "Content-Type": "application/json"
                }
            });
            command.OnResponse(resp.data);
        }
        catch (e) {
            if(command.OnFailure != null && command.OnFailure != undefined){
                if(electronIsDev){
                    let error = <Error>e;
                    ElectronLog.error(error.stack);
                }
                command.OnFailure(e);
            }
            else{
                throw e;
            }
        }
    }

    private CreateRequestUrl(command: CreatorsAPICommand<any>) : string{
        let baseUri = apiEndpoint + command.endpoint;

        //if(command.hasArguments){
        //    baseUri += this.MapToQueryString(command.GetCommandParameters());
        //}

        return baseUri;
    }

    private MapToQueryString(map: Map<string, string>) : string{
        let queryStr = "?";
        for (const [key, value] of Object.entries(map)) {
            if(value != "" && value != undefined && value != null){
                queryStr += `${key}=${value}&`;
            }
        }

        return queryStr;
    }
}

export default CreatorsAPIDispatcher;