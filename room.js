var DEFAULT_SETPOINT = 4.0;
var COSY_SETPOINT = 17.0;
var MAX_SETPOINT = 28.0;

var HOTWATER_ON = 1.0;
var HOTWATER_OFF = 0.0;

var MAIN_HOUSE_ID  = 1000;
var HOT_WATER_ID   = 1001;
var LIVING_ROOM_ID = 1002;
var SIDE_ROOM_ID   = 1003;
var SAM_OFFICE_ID  = 1004;
var BECKY_ROOM_ID  = 1005;
var TOMMY_ROOM_ID  = 1006;
var KITCHEN_ID     = 1007;

var RoomType = 
{
  GLOBAL    : 1,
  ONOFF     : 2,
  RADIATOR  : 3,
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
  this.offset = 0;

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
// Add a TRV for radiator control.
// nodeID is the ZWave ID of the physical device
//
Room.prototype.addNode= function (nodeID) {
   this.nodes.push (nodeID);
}

//
// addTRV
// Add a TRV for radiator control.
// vDevID is of the form ''
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

Room.prototype.update = function () {
  console.log ("MYTESTMOD: " + this.title + " mode is " + this.mode + " time is " + this.boostTimeRemaining);
  this.checkBoostStatus();

  // read temp from sensor or use master thermostat
  this.updateCurrentTemp();

  // set desired temp depending on current mode
  this.updateDesiredTemp();
}

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
  if (this.mode == RoomMode.OFF)
  {
    // no schedule in operation, frost protection
    msg += " default " + DEFAULT_SETPOINT;
    this.desiredTemp = DEFAULT_SETPOINT;
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
  if (this.id == HOT_WATER_ID) {
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
//  this.updateDesiredTemp();
  this.updateCallForHeat();
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
//  this.updateDesiredTemp();
  this.updateCallForHeat();
  controller.addNotification("warning", msg, "module", "MyTestMod");
}

/**********************************************************
defaultSchedule

***********************************************************/
Room.prototype.defaultSchedule = function (defSP) {
  var day;
  var i;

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
Room.prototype.loadSchedule = function () {
  var day;
  var i;

  // TODO: for now, creating a dummy schedule for each room
  // TODO: do we need a unique id generator? for now using name of room

  // whole house - basically, radiators that are not zwave enabled
  // if they happen to be on, then they will heat according to how
  // the set point compares to the master thermostat
  if (this.id == MAIN_HOUSE_ID) {
    this.defaultSchedule(DEFAULT_SETPOINT);

    // turn radiators on for a few hours in the morning (6pm to 9am)
    // and a few hours in the evening (8pm to 10pm)
    for (day=0; day<7; day++)
    {
      this.schedule.push (new ScheduleEvent (day,6,0,COSY_SETPOINT+5,this.title));
      this.schedule.push (new ScheduleEvent (day,9,0,DEFAULT_SETPOINT,this.title));
      this.schedule.push (new ScheduleEvent (day,20,0,COSY_SETPOINT+5,this.title));
      this.schedule.push (new ScheduleEvent (day,21,0,DEFAULT_SETPOINT,this.title));
    }

    this.offset = 2;
  }


  // hot water
  if (this.id == HOT_WATER_ID) {
    this.defaultSchedule(0.0);
    // heat water every day from 6am until 9pm
    for (day=0; day<7; day++) {
        this.schedule.push (new ScheduleEvent (day,5,0,HOTWATER_ON,this.title));
        this.schedule.push (new ScheduleEvent (day,21,0,HOTWATER_OFF,this.title));    
    }
  }

  // Living Room
  if (this.id == LIVING_ROOM_ID)
  {
        this.defaultSchedule(DEFAULT_SETPOINT);
        // weekend, heating on from 9am until 10pm
        this.schedule.push (new ScheduleEvent (0,9,0,COSY_SETPOINT,this.title));
        this.schedule.push (new ScheduleEvent (0,22,0,DEFAULT_SETPOINT,this.title));
        this.schedule.push (new ScheduleEvent (6,9,0,COSY_SETPOINT,this.title));
        this.schedule.push (new ScheduleEvent (6,22,0,DEFAULT_SETPOINT,this.title));

        // tuesday, heating on early evening until 10pm
        this.schedule.push (new ScheduleEvent (2,16,0,COSY_SETPOINT,this.title));
        this.schedule.push (new ScheduleEvent (2,22,0,DEFAULT_SETPOINT,this.title));

        // heating on from 7pm until 10pm for all other days
        this.schedule.push (new ScheduleEvent (1,19,0,COSY_SETPOINT,this.title));
        this.schedule.push (new ScheduleEvent (1,22,0,DEFAULT_SETPOINT,this.title));
        this.schedule.push (new ScheduleEvent (3,19,0,COSY_SETPOINT,this.title));
        this.schedule.push (new ScheduleEvent (3,22,0,DEFAULT_SETPOINT,this.title));
        this.schedule.push (new ScheduleEvent (4,19,0,COSY_SETPOINT,this.title));
        this.schedule.push (new ScheduleEvent (4,22,0,DEFAULT_SETPOINT,this.title));
        this.schedule.push (new ScheduleEvent (5,19,0,COSY_SETPOINT,this.title));
        this.schedule.push (new ScheduleEvent (5,22,0,DEFAULT_SETPOINT,this.title));

	this.offset = 3;
   }

  // Side Room
  if (this.id == SIDE_ROOM_ID)
  {
    this.defaultSchedule(DEFAULT_SETPOINT);
    // turn radiator on for a few hours in the evening (7pm to 10pm)
    for (day=0; day<7; day++)
    {
      this.schedule.push (new ScheduleEvent (day,19,0,COSY_SETPOINT,this.title));
      this.schedule.push (new ScheduleEvent (day,22,0,DEFAULT_SETPOINT,this.title));
    }

    this.offset = 2;
  }

  // Sam's Office
  if (this.id == SAM_OFFICE_ID)
  {
    // turn radiator on Monday, Thursday, Friday all day (9am to 8pm)
    this.defaultSchedule(DEFAULT_SETPOINT);
    for (day=0; day<7; day++)
    {  
      if ((day == 1) || (day == 4) || (day == 5))
      {
        this.schedule.push (new ScheduleEvent (day,9,0,COSY_SETPOINT,this.title));
        this.schedule.push (new ScheduleEvent (day,20,0,DEFAULT_SETPOINT,this.title));
      }
    }
    this.offset = 2;
  }

  // Becky's Room
  if (this.id == BECKY_ROOM_ID)
  {
    this.defaultSchedule(DEFAULT_SETPOINT);
    // turn radiator on for a short time in the morning
    for (day=0; day<7; day++)
    {
      this.schedule.push (new ScheduleEvent (day,6,0,COSY_SETPOINT,this.title));
      this.schedule.push (new ScheduleEvent (day,8,0,DEFAULT_SETPOINT,this.title));
    }
    this.offset = 2;
  }

  // Tommy's Room
  if (this.id == TOMMY_ROOM_ID)
  {
    this.defaultSchedule(DEFAULT_SETPOINT);
    // turn radiator on for a short time in the morning
    for (day=0; day<7; day++)
    {
      this.schedule.push (new ScheduleEvent (day,6,0,COSY_SETPOINT,this.title));
      this.schedule.push (new ScheduleEvent (day,8,0,DEFAULT_SETPOINT,this.title));
    }
    this.offset = 2;
  }

  // Kitchen
  if (this.id == KITCHEN_ID)
  {
    this.defaultSchedule(DEFAULT_SETPOINT);
    // turn radiator on in the morning
    for (day=0; day<7; day++)
    {
      this.schedule.push (new ScheduleEvent (day,6,0,COSY_SETPOINT,this.title));
      this.schedule.push (new ScheduleEvent (day,11,0,DEFAULT_SETPOINT,this.title));
    }
    this.offset = 3;
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

   if (nextEvent == 0) {
      // we need the last one in the list
      currentEvent = this.schedule.length-1;
   }
   else {
      // we need the one before
      currentEvent = nextEvent-1;
   }

   console.log ("MYTESTMOD current event is day: " + this.schedule[currentEvent].day + " hour: " + this.schedule[currentEvent].hour + " min: " + this.schedule[currentEvent].minute);

   desired = this.schedule[currentEvent].sp;
   msg = "desired temp for " + this.title + " (schedule) is  " + desired;
   this.setScheduleSP (desired);
   controller.addNotification("warning", msg, "core", "MyTestMod");

   console.log ("MYTESTMOD next event is day: " + this.schedule[nextEvent].day + " hour: " + this.schedule[nextEvent].hour + " min: " + this.schedule[nextEvent].minute);

   this.schedule[nextEvent].start();
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


