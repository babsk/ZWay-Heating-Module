/********************************* HillView Logger **************************************

This module logs HillView data in a JSON file

******************************************************************************************/

function HillViewLogger () {
}

HillViewLogger.prototype.log = function (logID, value) {

  var storedLog = loadObject("HillViewLogging_" + logID);
            if (!storedLog) {
                storedLog = {
                    sensorData: []
                };
            }
            storedLog.sensorData.push({"time": Date.now(), "value": value});
            saveObject("HillViewLogging_" + logID, storedLog);
            storedLog = null;
};

HillViewLogger.prototype.pushToLog = function (tag, value) {
            http.request({
                method: 'GET',
                url: "http://api.pushingbox.com/pushingbox?devid=v55A8D24D1162D9D&tag="+tag+"&val="+value 
            });
}

