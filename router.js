/********************************* HillView API *****************************************

This module adds functionality to the existing /ZAutomation/api/v1 that is defined
in ZAutomationAPIProvider.js.

In order for us to extend this API it was necessary to expose the router created there.

This required the addition of the following line to the constructor ZAutomationAPIWebRequest

   zAutomationAPI = this;

******************************************************************************************/

function HillViewAPI () {
}

HillViewAPI.prototype.register = function () {
  if (zAutomationAPI)
  {
    zAutomationAPI.router.get("/hillview/rooms",zAutomationAPI.ROLE.USER,this.listRooms);
    zAutomationAPI.router.get("/hillview/nodes",zAutomationAPI.ROLE.USER,listRealDevices);
    zAutomationAPI.router.get("/hillview/nodes/:devID",zAutomationAPI.ROLE.USER,listRealDevices,[parseInt]);
    zAutomationAPI.router.get("/hillview/schedule/:roomID",zAutomationAPI.ROLE.USER,getSchedule,[parseInt]);
    zAutomationAPI.router.post("/hillview/schedule/:roomID",zAutomationAPI.ROLE.USER,setSchedule,[parseInt]);
    zAutomationAPI.router.get("/hillview/mode/:roomID",zAutomationAPI.ROLE.USER,getMode,[parseInt]);
    zAutomationAPI.router.get("/hillview/basemode/:roomID",zAutomationAPI.ROLE.USER,getBaseMode,[parseInt]);
    zAutomationAPI.router.post("/hillview/mode/:roomID",zAutomationAPI.ROLE.USER,setMode,[parseInt]);
    zAutomationAPI.router.get("/hillview/boostsp/:roomID",zAutomationAPI.ROLE.USER,getBoostSP,[parseInt]);
    zAutomationAPI.router.post("/hillview/boostsp/:roomID",zAutomationAPI.ROLE.USER,setBoostSP,[parseInt]);
    zAutomationAPI.router.get("/hillview/boostduration/:roomID",zAutomationAPI.ROLE.USER,getBoostDuration,[parseInt]);
    zAutomationAPI.router.post("/hillview/boostduration/:roomID",zAutomationAPI.ROLE.USER,setBoostDuration,[parseInt]);
    zAutomationAPI.router.get("/hillview/boosttime/:roomID",zAutomationAPI.ROLE.USER,getBoostTimeRemaining,[parseInt]);
    zAutomationAPI.router.get("/hillview/pumpstatus/:roomID",zAutomationAPI.ROLE.USER,getPumpStatus,[parseInt]);
    zAutomationAPI.router.post("/hillview/pumpstatus/:roomID",zAutomationAPI.ROLE.USER,setPumpStatus,[parseInt]);
    zAutomationAPI.router.get("/hillview/pumpduration/:roomID",zAutomationAPI.ROLE.USER,getPumpDuration,[parseInt]);
    zAutomationAPI.router.post("/hillview/pumpduration/:roomID",zAutomationAPI.ROLE.USER,setPumpDuration,[parseInt]);
    zAutomationAPI.router.get("/hillview/pumptime/:roomID",zAutomationAPI.ROLE.USER,getPumpTimeRemaining,[parseInt]);
    return true;
  }

  return false;

}

/********************************* API FUNCTIONS *****************************************

  These functions can be called from a browser using 

  http://<IP Address>/JS/Run/<function name>

  They are intended to be accessed via the JSON RESTFUL API

******************************************************************************************/
function setRoomMode (roomID, mode)
{
  room = boilerModule.getRoomFromID(roomID);
  if (room != null)
  {
    room.setMode (mode);
  }
}

function setRoomBoostDuration (roomID, val)
{
  room = boilerModule.getRoomFromID(roomID);
  if (room != null)
  {
    room.setBoostDuration (val);
  }
}

function setRoomBoostSP (roomID, val)
{
  room = boilerModule.getRoomFromID(roomID);
  if (room != null)
  {
    room.setBoostSP (val);
  }
}

// rooms 
HillViewAPI.prototype.listRooms = function (roomID) {  
  var reply = {
                data: null,
                error: null
              };
  reply.code = 200;
  reply.data = boilerModule.rooms;
  
  return reply;
}

//devices
function listRealDevices (deviceId) 
{
  controller.addNotification("warning", "api call to listDevices " + deviceId, "module", "MyTestMod");  
  var reply = {
                data: null,
                error: null
              };
  reply.code = 200;
  if (deviceId === undefined)
  {
    reply.data = zway.devices;
  }
  else
  {
    reply.data = zway.devices[deviceId]
  }
  return reply;
}

function getSchedule (roomID)
{
  console.log ("MYTESTMOD: getSchedule " + roomID);

  var reply = {
                data: null,
                error: null
              };
  reply.code = 200;

  room = boilerModule.getRoomFromID(roomID);
  if (room != null)
  {
    reply.data = room.schedule;
  }
  
  return reply;
}

function setSchedule (roomID)
{
  console.log ("MYTESTMOD: setSchedule " + roomID);

  var reply = {
                error: null,
                data: null
            };
  var reqObj;
  var locProps = {};

  try 
  {
    reqObj = JSON.parse(zAutomationAPI.req.body);
  } 
  catch (ex) 
  {
    reply.code = 500;
    reply.error = "Cannot parse POST request. ERROR:" + ex.message;
  }

  // TODO: should do some checking of data and provide a callback function
  room = boilerModule.getRoomFromID(roomID);
  if (room != null) {
    room.updateSchedule (reqObj.data);
    reply.data = room.schedule;
  }
  reply.code = 200;

  return reply;
}

function getMode (roomID)
{
  console.log ("MYTESTMOD: getMode " + roomID);

  var reply = {
                data: null,
                error: null
              };
  reply.code = 200;
  room = boilerModule.getRoomFromID(roomID);
  if (room != null) {
    reply.data = room.mode;
  }
  
  return reply;
}

function getBaseMode (roomID)
{
  console.log ("MYTESTMOD: getBaseMode " + roomID);

  var reply = {
                data: null,
                error: null
              };
  reply.code = 200;
  room = boilerModule.getRoomFromID(roomID);
  if (room != null) {
    reply.data = room.baseMode;
  }
  
  return reply;
}

function setMode (roomID)
{
  console.log ("MYTESTMOD: setMode " + roomID);

  var reply = {
                error: null,
                data: null
            };
  var reqObj;
  var locProps = {};

  try 
  {
    reqObj = JSON.parse(zAutomationAPI.req.body);
  } 
  catch (ex) 
  {
    reply.code = 500;
    reply.error = "Cannot parse POST request. ERROR:" + ex.message;
  }

  // TODO: should do some checking of data and provide a callback function
  room = boilerModule.getRoomFromID(roomID);
  if (room != null) {
    room.setMode (reqObj.data);
    reply.data = room.mode;
  }
  reply.code = 200;

  return reply;
}

function getBoostSP (roomID)
{
  console.log ("MYTESTMOD: getBoostSP " + roomID);

  var reply = {
                data: null,
                error: null
              };
  reply.code = 200;
  room = boilerModule.getRoomFromID(roomID);
  if (room != null) {
    reply.data = room.boostSP;
  }
  
  return reply;
}

function setBoostSP (roomID)
{
  console.log ("MYTESTMOD: setBoostSP " + roomID);

  var reply = {
                error: null,
                data: null
            };
  var reqObj;
  var locProps = {};

  try 
  {
    reqObj = JSON.parse(zAutomationAPI.req.body);
  } 
  catch (ex) 
  {
    reply.code = 500;
    reply.error = "Cannot parse POST request. ERROR:" + ex.message;
  }

  // TODO: should do some checking of data and provide a callback function
  room = boilerModule.getRoomFromID(roomID);
  if (room != null) {
    room.setBoostSP (reqObj.data);
    reply.data = room.boostSP;
  }
  reply.code = 200;

  return reply;
}

function getBoostDuration (roomID)
{
  console.log ("MYTESTMOD: getBoostDuration " + roomID);

  var reply = {
                data: null,
                error: null
              };
  reply.code = 200;
  room = boilerModule.getRoomFromID(roomID);
  if (room != null) {
    reply.data = room.boostDuration;
  }
  
  return reply;
}

function setBoostDuration (roomID) {
  console.log ("MYTESTMOD: setBoostDuration " + roomID);

  var reply = {
                error: null,
                data: null
            };
  var reqObj;
  var locProps = {};

  try 
  {
    reqObj = JSON.parse(zAutomationAPI.req.body);
  } 
  catch (ex) 
  {
    reply.code = 500;
    reply.error = "Cannot parse POST request. ERROR:" + ex.message;
  }

  // TODO: should do some checking of data and provide a callback function
  room = boilerModule.getRoomFromID(roomID);
  if (room != null) {
    room.setBoostDuration (reqObj.data);
    reply.data = room.boostDuration;
  }
  reply.code = 200;

  return reply;
}

function getBoostTimeRemaining (roomID) {
  var reply = {
                error: null,
                data: 0
            };
  reply.code = 200;
  room = boilerModule.getRoomFromID(roomID);
  if (room != null) {
    reply.data = room.boostTimeRemaining;
  }
  return reply;
}

function getPumpStatus (roomID) {
  console.log ("MYTESTMOD: getPumpStatus " + roomID);

  var reply = {
                data: false,
                error: null
              };
  reply.code = 200;
  room = boilerModule.getRoomFromID(roomID);
  if (room != null) {
    reply.data = room.pumpStatus;
  }  
  return reply;
}

function setPumpStatus (roomID) {
  console.log ("MYTESTMOD: setPumpStatus " + roomID);

  var reply = {
                error: null,
                data: null
            };
  var reqObj;
  var locProps = {};

  try {
    reqObj = JSON.parse(zAutomationAPI.req.body);
  } 
  catch (ex) {
    reply.code = 500;
    reply.error = "Cannot parse POST request. ERROR:" + ex.message;
  }

  // TODO: should do some checking of data and provide a callback function
  // extract the boolean value
  room = boilerModule.getRoomFromID(roomID);
  if (room != null) {
    var status = JSON.parse(reqObj.data.toLowerCase());
    room.setPumpStatus (status);
    reply.data = room.pumpStatus;
  }
  reply.code = 200;

  return reply;
}

function getPumpDuration (roomID) {
  console.log ("MYTESTMOD: getPumpDuration " + roomID);

  var reply = {
                data: null,
                error: null
              };
  reply.code = 200;
  room = boilerModule.getRoomFromID(roomID);
  if (room != null) {
    reply.data = room.pumpDuration;
  }
  
  return reply;
}

function setPumpDuration (roomID)
{
  console.log ("MYTESTMOD: setPumpDuration " + roomID);

  var reply = {
                error: null,
                data: null
            };
  var reqObj;
  var locProps = {};

  try {
    reqObj = JSON.parse(zAutomationAPI.req.body);
  } 
  catch (ex) {
    reply.code = 500;
    reply.error = "Cannot parse POST request. ERROR:" + ex.message;
  }

  // TODO: should do some checking of data and provide a callback function
  room = boilerModule.getRoomFromID(roomID);
  if (room != null) {
    room.setPumpDuration (reqObj.data);
    reply.data = room.pumpDuration;
  }
  reply.code = 200;

  return reply;
}

function getPumpTimeRemaining (roomID) {
  console.log ("MYTESTMOD: getPumpTimeRemaining " + roomID);

  var reply = {
                error: null,
                data: null
            };
  reply.code = 200;
  room = boilerModule.getRoomFromID(roomID);
  if (room != null) {
    reply.data = room.pumpTimeRemaining;
  }
  
  return reply;
}





