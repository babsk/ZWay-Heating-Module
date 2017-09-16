var DEFAULT_SETPOINT = 4.0;
var COSY_SETPOINT = 17.0;
var MAX_SETPOINT = 28.0;

var HOTWATER_ON = 1.0;
var HOTWATER_OFF = 0.0;

var WHOLE_HOUSE_INDEX = 0;
var HOT_WATER_INDEX = 1;

var BASE_ROOM_ID   = 1000;
var WHOLE_HOUSE_ID = BASE_ROOM_ID + WHOLE_HOUSE_INDEX;
var HOT_WATER_ID = BASE_ROOM_ID + HOT_WATER_INDEX;

var RoomType = 
{
  ONOFF     : 1,
  RADIATOR  : 2,
};

var RoomMode =
{
   OFF   : 1,
   TIMER : 2,
   BOOST : 3,
};

function Room (id,title,type,mode) {
  this.id = id;
  this.title = title;
  this.type = type;
  this.primary = true;
  this.mode = mode;
  this.baseMode = mode;
  this.callForHeat = false;
  // TODO: add to config
  this.offset = 2;

  this.trvs = [];
  this.nodes = [];
  this.schedule = [];

  this.scheduleSP = DEFAULT_SETPOINT;
  this.desiredTemp = 0;
  this.currentTemp = 0;
  this.hasTempSensor = false;
  this.tempSensorId = "";

  // override / boost variables
  this.boostSP = COSY_SETPOINT;
  this.boostTimeRemaining = 0;
  this.boostDuration = 60; // minutes
}

//
// addNode
// nodeID is the ZWave ID of the physical device
//
Room.prototype.addNode= function (nodeID) {
   this.nodes.push (nodeID);
}

//
// addTRV
// Add a TRV for radiator control.
// vDevID is of the form 'ZWayVDev_zway_20-0-67-1'
//
Room.prototype.addTRV = function (vDevID) {
	this.trvs.push (vDevID);
}

//
// addTempSensor
// Add a ZWay virtual device / HTTP device as a temperature sensor.
// vDevID is of the form 'ZWayVDev_zway_2-0-49-1' or 'HTTP_Device_sensorMultilevel_21'.
//
Room.prototype.addTempSensor= function (vDevID) {
  this.tempSensorId = vDevID;
  this.hasTempSensor = true;
}


/***************************************************************************************

          PRIVATE FUNCTIONS

***************************************************************************************/
//
// update
// Update the current and desired temperatures 
// Countdown the boost status
//
Room.prototype.update = function () {
  console.log ("MYTESTMOD: " + this.title + " mode is " + this.mode + " time is " + this.boostTimeRemaining);
  this.checkBoostStatus();

  // read temp from sensor or use master thermostat
  this.updateCurrentTemp();

  // set desired temp depending on current mode
  this.updateDesiredTemp();
}

//
// adjustValves
// This is called to make sure the TRVs of a room with radiators are set to the correct value as follows.
// If a room's desired temperature is greater than the current temperature then the TRV is opened fully (MAX_SETPOINT)
// Once the desired temperature has been reached (ie is less than or equal to the current temperature), then the TRV is set to the desired temp to
// allow the TRV to adjust the open/close state according to its own readings of the current temp
//
Room.prototype.adjustValves = function () {
  var i;

  if (this.type == RoomType.RADIATOR) {
    var setPoint = 0;
    var desiredTemp = 0;
    var deviceId;
    var deviceType;
    var msg;

    // set to max value if current temp is not equal to the desired temp - ie fully open the valve until we get up to desired temp
    if (this.currentTemp < this.desiredTemp) {
      desiredTemp = MAX_SETPOINT;
    }
    else {
      // allow for offset
      desiredTemp = this.desiredTemp + this.offset;
      if (desiredTemp > MAX_SETPOINT) {
        desiredTemp = MAX_SETPOINT;
        console.log ("MYTESTMOD: " + this.title + " desired temp adjusted to max " + desiredTemp);
      }    
    }
    console.log ("MYTESTMOD: " + this.title + " desired temp is " + desiredTemp);
	
	for (i=0; i<this.trvs.length; i++)
    {
      deviceId = this.trvs[i];

      setPoint = controller.devices.get(deviceId).get("metrics:level");

      console.log ("MYTESTMOD: " + this.title + " radiator valve " + deviceId + " set to " + setPoint);

      if (desiredTemp != setPoint)
      {
          // change valve set point
          msg = "adjust TRV " + deviceId + " sp: " + setPoint + "(dp: " + desiredTemp + ")";
          controller.addNotification("warning", msg, "module", "MyTestMod");
		  controller.devices.get(deviceId).performCommand("exact",{level:desiredTemp});
      }
    }
  }
  else if (this.type == RoomType.ONOFF) {
    // TODO: need to check that control has not been manually changed
  }
}


Room.prototype.checkBoostStatus = function () {
  if (this.mode == RoomMode.BOOST)
  {
    this.boostTimeRemaining--;
    if (this.boostTimeRemaining % 10 == 0)
    {
      var msg = "boost duration for " +  this.title + " is " + this.boostTimeRemaining;
      controller.addNotification("warning", msg, "module", "MyTestMod");
    }
    if (this.boostTimeRemaining <= 0)
    {
      this.mode = this.baseMode;
    }  
  }

}

Room.prototype.checkPumpStatus = function ()
{
  if (this.pumpStatus == true)
  {
    this.pumpTimeRemaining--;
    var msg = "pump duration for " +  this.title + " is " + this.pumpTimeRemaining;
    controller.addNotification("warning", msg, "module", "MyTestMod");

    if (this.pumpTimeRemaining <= 0)
    {
      this.pumpStatus = false;
      // turn off the pump
      zway.devices[37].instances[0].commandClasses[37].Set(false);
    }  
  }

}

Room.prototype.updateDesiredTemp = function ()
{
  var msg = "updateDesiredTemp of " + this.title + " to ";
  var oldDesired = this.desiredTemp;
  if (this.mode == RoomMode.OFF) {
    // no schedule in operation
    if (this.type == RoomType.ONOFF) {
      // OFF means 0.0
      msg += " on/off 0 ";
      this.desiredTemp = 0.0;	  
    }
    else {
      // OFF means frost protection
      msg += " DEFAULT " + DEFAULT_SETPOINT;
      this.desiredTemp = DEFAULT_SETPOINT;
   }
  }
  else if (this.mode == RoomMode.BOOST)
  {
    msg += " boost " + this.boostSP;
    this.desiredTemp = this.boostSP;
  }
  else
  {
    // use the value from the schedule
    msg += "schedule " + this.scheduleSP;
    this.desiredTemp = this.scheduleSP;
  }
  if (this.desiredTemp != oldDesired) {
    boilerModule.logger.pushToLog ("R_"+this.id+"_SP",this.desiredTemp);
  }
  console.log ("MYTESTMOD: " + msg);
}

Room.prototype.updateCurrentTemp = function () {
  var oldCurrent = this.currentTemp;
  if (this.type == RoomType.ONOFF) {
    // TODO: should make this more generic - for now we know that the only onoff type is the hot water
    if (zway.devices[boilerModule.boilerController].instances[1].commandClasses[37].data.level.value == true) {
      this.currentTemp = 1.0;
    }
    else {
      this.currentTemp = 0.0;
    }
  }
  else {
    // if room has its own sensor, then read current from sensor, otherwise use master thermostat
    if (this.hasTempSensor) {
      this.currentTemp = controller.devices.get(this.tempSensorId).get("metrics:level");
      if (this.currentTemp != oldCurrent) {
        boilerModule.logger.pushToLog ("R_"+this.id+"_TEMP",this.currentTemp);
      }
    }
    else {
      console.log ("MYTESTMOD: master therm is " + boilerModule.masterThermostat);
      this.currentTemp = zway.devices[boilerModule.masterThermostat].instances[0].commandClasses[49].data[1].val.value;
      if (this.currentTemp != oldCurrent) {
        boilerModule.logger.pushToLog ("MASTER_TEMP",this.currentTemp);
      }
    }
  }
}

Room.prototype.updateCallForHeat = function () {
  // update the current temp and the desired temp for each room and turn on the valves if required
  this.update ();
  this.adjustValves ();
  //TODO: need to do some kind of function like update - eg new update, but call old one from it - super update
  // hot water treated separately
  if (this.type == RoomType.ONOFF) {
      this.callForHeat = (this.desiredTemp != 0);
  }
  else {
      if (this.primary && (this.currentTemp < this.desiredTemp)) {
         this.callForHeat = true;
      }
      else {
         this.callForHeat = false;
      }
  }
}



Room.prototype.setBoostSP = function (sp) {
  // TODO: check values
  this.boostSP = sp;
  msg = "boost sp set to " + sp + " for " + this.title;
  this.updateCallForHeat();
  this.updateConfig();
  controller.addNotification("warning", msg, "module", "MyTestMod");
}

//
// setBoostDuration
//
// Sets the reload value of the boost time in minutes
// If the room mode is already BOOST, then the boostTimeRemaining value is reset,
// otherwise the reload value is picked up when the mode changes to BOOST
//
Room.prototype.setBoostDuration = function (val) {
  // TODO: check values
  this.boostDuration = val;
  this.updateConfig();
  msg = "boost duration set to " + val + " for " + this.title;
  if (this.mode == RoomMode.BOOST) {
    this.boostTimeRemaining = this.boostDuration;
  }

  controller.addNotification("warning", msg, "module", "MyTestMod");
}

Room.prototype.setPumpStatus = function (status) {
  // TODO: check values
  console.log("setPumpStatus status is " + status + " (" + typeof(status) + ")");
  msg = "request to set pump status to " + status + " for " + this.title;
  // set the actual status and wait for the response before updating our data
  // structures and starting the timer if necessary
  zway.devices[37].instances[0].commandClasses[37].Set(status);
  controller.addNotification("warning", msg, "module", "MyTestMod");
}

Room.prototype.setPumpDuration = function (val) {
  // TODO: check values
  this.pumpDuration = val;
  msg = "pump duration set to " + val + " for " + this.title;
  if (this.pumpStatus == true) {
    this.pumpTimeRemaining = this.pumpDuration;
  }

  controller.addNotification("warning", msg, "module", "MyTestMod");
}


Room.prototype.setScheduleSP = function (sp)
{
  console.log ("MYTESTMOD: set schedule SP of " + this.title + " to " + sp);
  this.scheduleSP = sp;
}

Room.prototype.setMode = function (mode)
{
  var msg;
  // if mode is BOOST, then store current mode, start countdown (not cron?)
  // keep schedule going and update temps when timers go off
  if (mode == RoomMode.BOOST)
  {
    msg = "boost mode for " + this.title + " time " + this.boostDuration;
    this.boostTimeRemaining = this.boostDuration;
    this.mode = mode;
  }
  else if (mode == RoomMode.TIMER)
  {
    // schedule is already running and on next main poll desired temp
    // will be set to schedule SP
    msg = "timer mode for " + this.title;
    this.baseMode = mode;
    this.mode = mode;
    this.boostTimeRemaining = 0;
  }
  else if (mode == RoomMode.OFF)
  {
    // keep schedule running, but don't act on timers
    // default SP will be set on next main poll
    msg = "off mode for " + this.title;
    this.baseMode = mode;
    this.mode = mode;
    this.boostTimeRemaining = 0;
  }
  else
  {
    msg = "bad mode value for " + this.title + ": " + mode;
  }
  this.updateCallForHeat();
  this.updateConfig();
  controller.addNotification("warning", msg, "module", "MyTestMod");
}

/****************************************************************************
 updateConfig

 Called whenever the config has been changed via the hillview API.
 Copies current writable fields of room into config and calls the 
 ZWay saveConfig fn.

*****************************************************************************/
Room.prototype.updateConfig = function () {
	var roomConfig;

	roomConfig = boilerModule.getRoomConfig(this.id);
	roomConfig.mode = this.baseMode;
	roomConfig.boostSP = this.boostSP;
	roomConfig.boostDuration = this.boostDuration;
	roomConfig.schedule = [];
	for (j=0; j<this.schedule.length; j++) {
		scheduleEntry = this.schedule[j];
		roomConfig.schedule.push(scheduleEntry);			
	}
	boilerModule.saveConfig();	
}

/**********************************************************
defaultSchedule

***********************************************************/
Room.prototype.defaultSchedule = function () {
  var day;
  var i;
  var defSP = (this.type == RoomType.ONOFF)?HOTWATER_OFF:DEFAULT_SETPOINT;

  // every day starts at the default temp
  for (day=0; day<7; day++)
  {
    this.schedule.push (new ScheduleEvent (day,0,0,defSP,this.title));
  }  
}
/**********************************************************
loadSchedule

Read the schedule for this room from the config.

***********************************************************/
Room.prototype.loadSchedule = function (schedule) {
  var day;
  var i;
  
  // if no schedule is present, then default it, otherwise use the one in the config
  // TODO: need to validate config
  if (schedule.length == 0) {
		  this.defaultSchedule();
		  for (j=0; j<this.schedule.length; j++) {
			  scheduleEntry = this.schedule[j];
			  schedule.push(scheduleEntry);
		  }
		  boilerModule.saveConfig();
  }
  else {
		  for (j=0; j<schedule.length; j++) {
				scheduleEntry = schedule[j];
				this.schedule.push (new ScheduleEvent (scheduleEntry.day,scheduleEntry.hour,scheduleEntry.minute,scheduleEntry.sp,this.title));
		  }
  }
  
  // schedule must always be sorted after additions / deletions are made
  this.schedule.sort(function(a,b)
              {
                 if (a.day != b.day)
                 {
                   return a.day - b.day;
                 }
                 else if (a.hour != b.hour)
                 {
                   return a.hour - b.hour;
                 }
                 else
                 {
                   return a.minute - b.minute;
                 }
               });

   for (i=0; i<this.schedule.length; i++)
   {
      console.log("MYTESTMOD day: " + this.schedule[i].day + " hour: " + this.schedule[i].hour + " min: " + this.schedule[i].minute);
   }
}

Room.prototype.updateSchedule = function (data)
{
  console.log ("MYTESTMOD: updateSchedule " + data);
  // stop the active event
  for (var i=0; i<this.schedule.length; i++)
  {
    if (this.schedule[i].active)
    {
      console.log ("MYTESTMOD: stop " + i + " entry");
      this.schedule[i].stop();
    }
  }

  // remove all of the events in the schedule
  this.schedule = [];

  // load the new schedule
  console.log ("MYTESTMOD: length of new schedule is " + data.length);
  for (var i=0; i<data.length; i++)
  {
    this.schedule.push (new ScheduleEvent (data[i].day,data[i].hour,data[i].minute,data[i].sp,this.title));
  }
  this.sortSchedule();
  this.activateSchedule();
  this.updateConfig();
}

Room.prototype.activateNextEvent = function ()
{
   var nextEvent = this.getNextEvent ();
   console.log ("MYTESTMOD next event is day: " + this.schedule[nextEvent].day + " hour: " + this.schedule[nextEvent].hour + " min: " + this.schedule[nextEvent].minute);
   this.schedule[nextEvent].start();
}


/****************************************************************************
 activateSchedule

 Called at boot time for each room to initiate its schedule.
 Based on the current time, it finds the next event which would fire
 and then activates the one before.

*****************************************************************************/
Room.prototype.activateSchedule = function () {
   var nextEvent = this.getNextEvent ();
   var currentEvent;
   var desired;
   var msg;
   
   currentEvent = this.getCurrentEvent();

   console.log ("MYTESTMOD current event is day: " + this.schedule[currentEvent].day + " hour: " + this.schedule[currentEvent].hour + " min: " + this.schedule[currentEvent].minute);

   desired = this.schedule[currentEvent].sp;
   msg = "desired temp for " + this.title + " (schedule) is  " + desired;
   this.setScheduleSP (desired);
   controller.addNotification("warning", msg, "core", "MyTestMod");

   console.log ("MYTESTMOD next event is day: " + this.schedule[nextEvent].day + " hour: " + this.schedule[nextEvent].hour + " min: " + this.schedule[nextEvent].minute);

   this.schedule[nextEvent].start();
}

Room.prototype.deactivateSchedule = function () {
	var currentEvent = this.getCurrentEvent();
	this.schedule[currentEvent].stop();
}

Room.prototype.getCurrentEvent = function () {
	var nextEvent = this.getNextEvent ();
	
	if (nextEvent == 0) {
      // we need the last one in the list
      return this.schedule.length-1;
	  }
	else {
      // we need the one before
      return nextEvent-1;
	}
}


Room.prototype.getNextEvent = function ()
{
  var d = new Date ();
  var day = d.getDay();
  var hour = d.getHours();
  var minute = d.getMinutes();
  var event;

  var currTimeVal = day * 24 * 60 + hour * 60 + minute;

  console.log ("MYTESTMOD current date is: " + day + "-" + hour + ":" + minute);

  for (event=0; event<this.schedule.length; event++)
  {
      // look for the next event past where we are
      timeVal = this.schedule[event].day * 24 * 60 + this.schedule[event].hour * 60 + this.schedule[event].minute;
      if (timeVal > currTimeVal)
         break;
  }

  // check for wrap, assign first event if reached end
  if (event == this.schedule.length)
  {
    event = 0;
  }

   return event;
}

Room.prototype.sortSchedule = function ()
{
  // schedule must always be sorted after additions / deletions are made
   this.schedule.sort(function(a,b)
              {
                 if (a.day != b.day)
                 {
                   return a.day - b.day;
                 }
                 else if (a.hour != b.hour)
                 {
                   return a.hour - b.hour;
                 }
                 else
                 {
                   return a.minute - b.minute;
                 }
               });
}



Room.prototype.insertInterval = function (day, hour, min, duration, sp)
{
  // TODO: validate values
  this.schedule.push (new ScheduleEvent (day,hour,min,sp,this.title));
}

Room.prototype.loadTESTSchedule = function ()
{
  var day;
  var hour;
  var min;
  var temp;
  var i;

  // setup the default schedule

  // TODO: do we need a unique id generator? for now using name of room

  // TODO: for now, creating a dummy schedule for each room
  //       start with every day at default temp
  for (day=0; day<7; day++)
  {
    // start each day at default temp
    this.schedule.push (new ScheduleEvent (day,0,0,DEFAULT_SETPOINT,this.title));
  }

  // Side Room
  if (this.id == 3)
  {
    for (day=0; day<7; day++)
    {
      for (hour=1; hour<23; hour++)
      {
        temp = DEFAULT_SETPOINT;
        for (min=0; min<60; min+=5)
        {
          temp += 2;
          console.log ("MYTESTMOD: push schedule " + day + " - " + hour +":"+min+"  ("+temp+")");
          this.schedule.push (new ScheduleEvent (day,hour,min,temp,this.title));
        }
      }
    }
  }


   // schedule must always be sorted after additions / deletions are made
   this.schedule.sort(function(a,b)
              {
                 if (a.day != b.day)
                 {
                   return a.day - b.day;
                 }
                 else if (a.hour != b.hour)
                 {
                   return a.hour - b.hour;
                 }
                 else
                 {
                   return a.minute - b.minute;
                 }
               });

   for (i=0; i<this.schedule.length; i++)
   {
      console.log("MYTESTMOD day: " + this.schedule[i].day + " hour: " + this.schedule[i].hour + " min: " + this.schedule[i].minute);
   }

}

function HotWaterRoom (id,title,type,mode) {}


