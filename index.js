/************* HILLVIEW HOME AUTOMATION MODULE ****************/
// ----------------------------------------------------------------------------
// --- Class definition, inheritance and setup
// ----------------------------------------------------------------------------

function MyTestMod (id, controller) {
  console.log ("MYTESTMOD: constructor called");

  // Call superconstructor first (AutomationModule)
  MyTestMod.super_.call(this, id, controller);

  this.rooms = [];

  this.binding = false;
  this.initialised = false;
  this.registered = false;
  this.configloaded = false;
  this.heatingOn = false;
  this.waterOn = false;
  this.masterThermostat = -1;
  this.boilerController = -1;
  this.pumpController = -1;
  this.hotWaterSwitch = -1;

  boilerModule = this;
}

inherits(MyTestMod, AutomationModule);

_module = MyTestMod;

// ----------------------------------------------------------------------------
// --- Module instance initialized
// ----------------------------------------------------------------------------

MyTestMod.prototype.init = function (config) 
{
   console.log ("MyTestMod:init starting");

   MyTestMod.super_.prototype.init.call(this, config);
   ;;;

   // 1 minute
   var m = [0, 59, 1];

   // required for access to this object's controller when
   // called back
   var self = this;

   // set up a periodic poll
   this.controller.emit("cron.addTask", "MyTestMod.poll", {
        minute: m,
        hour: null,
        weekDay: null,
        day: null,
        month: null
    });

   this.onPoll = function () 
   {
      console.log ("MyTestMod: tick");

      // register the hillview API
      if (!self.registered)
      {
        console.log ("MYTESTMOD: registering API")
        self.registered = self.router.register();
      }

      if (!self.initialised && zway && zway.devices)
      {
         // find the master thermostat and bind to it
         masterThermostat = getDeviceByManufacturer (HOSTMANN_ID, HOSTMANN_THERMOSTAT_ID, HOSTMANN_THERMOSTAT_TYPE);
         console.log ("MYTESTMOD: master thermostat is " + masterThermostat);
         if (masterThermostat != -1) {
               zway.devices[masterThermostat].instances[0].commandClasses[49].data[1].val.bind(
                                                      function() 
                                                      {
					                 var value = zway.devices[masterThermostat].instances[0].commandClasses[49].data[1].val;
					                 console.log("MyTestMod: master thermostat temp reading update = " + value);
                                                      });

               zway.devices[masterThermostat].instances[0].commandClasses[67].data[1].val.bind(
                                                      function() 
                                                      {
					                 var value = zway.devices[masterThermostat].instances[0].commandClasses[67].data[1].val;
					                 console.log("MyTestMod: master thermostat set point update = " + value);
                                                      });
         }
         else {
            controller.addNotification("error", "No Master Thermostat Present", "module", "MyTestMod");
         }
         self.masterThermostat = masterThermostat;

         // find the boiler controller
         boilerController = getDeviceByManufacturer (HOSTMANN_ID, HOSTMANN_BOILER_DUAL_CONTROL_ID, HOSTMANN_BOILER_CONTROL_TYPE);
         if (boilerController != -1) {
               zway.devices[boilerController].instances[1].commandClasses[37].data.level.bind(
                                                      function() 
                                                      {
					                 var value = zway.devices[boilerController].instances[1].commandClasses[37].data.level.value;
                                                         self.heatingOn = value;
					                 console.log("MyTestMod: central heating status = " + typeof(value));
                                                         console.log("MyTestMod: actual central heating status = " + self.heatingOn);
                                                      });         
               zway.devices[boilerController].instances[2].commandClasses[37].data.level.bind(
                                                      function() 
                                                      {
					                 var value = zway.devices[boilerController].instances[2].commandClasses[37].data.level.value;
                                                         self.waterOn = value;
					                 console.log("MyTestMod: hot water status = " + value);
                                                         console.log("MyTestMod: actual hot water status = " + self.waterOn);
                                                      });          
         }
         else {
            controller.addNotification("error", "No Boiler Controller Present", "module", "MyTestMod");
         }
         self.boilerController = boilerController;

         // find the hot water pump switch
         hotWaterSwitch = getDeviceByManufacturer(FIBARO_ID, FIBARO_BUTTON_ID, FIBARO_BUTTON_TYPE);
         console.log ("MYTESTMOD: hot water switch is " + hotWaterSwitch);
         if (hotWaterSwitch != -1) { 
            zway.devices[hotWaterSwitch].instances[0].commandClasses[91].data.keyAttribute.bind(
                                                      function() 
                                                      {
                                                        self.rooms[HOT_WATER_INDEX].setPumpStatus(true);
                                                      });
         }
         else {
            controller.addNotification("error", "No Hot Water Switch Present", "module", "MyTestMod");
         }
         self.hotWaterSwitch = hotWaterSwitch;

         // find the hot water pump controller
         pumpController = getDeviceByManufacturer (HOSTMANN_ID, HOSTMANN_BOILER_CONTROL_ID, HOSTMANN_BOILER_CONTROL_TYPE);
         console.log ("MYTESTMOD: pump controller is " + pumpController);
         if (pumpController != -1) {
               zway.devices[pumpController].instances[0].commandClasses[37].data.level.bind(
                                                      function() 
                                                      {
					                 var value = zway.devices[pumpController].instances[0].commandClasses[37].data.level.value;
					                 console.log("MyTestMod: hot water pump status = " + zway.devices[pumpController].instances[0].commandClasses[37].data.level.value);
                                                         console.log("MyTestMod: old status was = " + self.rooms[HOT_WATER_INDEX].pumpStatus);
                                                         if (value != self.rooms[HOT_WATER_INDEX].pumpStatus) {
                                                            controller.addNotification("warning","Status of pump has changed to " + value,"module","MyTestMod");
                                                            self.rooms[HOT_WATER_INDEX].pumpStatus = value;
                                                            if (value == true) {
                                                              // start countdown timer
                                                              self.rooms[HOT_WATER_INDEX].pumpTimeRemaining = self.rooms[1].pumpDuration;
                                                            }
                                                            else {
                                                              // pump is off already, just reset the timer
                                                              self.rooms[HOT_WATER_INDEX].pumpTimeRemaining = 0;
                                                            }
                                                         }
                                                      });
         }
         else {
            controller.addNotification("error", "No pump controller present", "module", "MyTestMod");
         }
         self.pumpController = pumpController;     

        self.initialised = true;
      }
	  
	  if (self.initialised && !self.configloaded) {
		  // load the config
		  console.log ("MYTESTMOD: loading config");
          self.validateAndLoadConfig();
		  self.configloaded = true;
	  }

      // once everything has been setup, we just service the rooms periodically
      if (self.initialised && self.configloaded) {
         self.serviceRooms ();
      }

    };
    
    this.controller.on('MyTestMod.poll', this.onPoll);

    this.router = new HillViewAPI ();
    this.logger = new HillViewLogger ();
}

MyTestMod.prototype.stop = function () {	
	var self = this;

    console.log ("MYTESTMOD: stop");
    
    MyTestMod.super_.prototype.stop.call(this);

	// remove all the timers
	self.controller.emit("cron.removeTask", "MyTestMod.poll");
    self.controller.off('MyTestMod.poll', this.onPoll);
	
	for (i=0; i<self.rooms.length; i++) {		
		self.rooms[i].deactivateSchedule();	
	}
	
	// unload the config
    self.rooms = [];	
	self.configloaded = false;
};

// ----------------------------------------------------------------------------
// --- Module methods
// ----------------------------------------------------------------------------

MyTestMod.prototype.getRoomFromID = function (roomID) {
  var i;
  for (i=0; i<this.rooms.length; i++) {
    if (this.rooms[i].id == roomID) {
      return this.rooms[i];
    }
  }
  return null;
}

MyTestMod.prototype.serviceRooms = function () {
  var i;
  var callForHeat = false;

  // TODO: temp - need to push this into the object method for whole house?
  // access weather information and add to whole house
  // TODO: need to find id rather than hard code
  var vDev = controller.devices.get("OpenWeather_10");
  this.rooms[WHOLE_HOUSE_INDEX].externalTemp = vDev.get("metrics:level");
  this.rooms[WHOLE_HOUSE_INDEX].location = vDev.get("metrics:title");

  // poll for the hot water pump status
  // this is necessary because if the pump is activated manually we do not receive a notification
  zway.devices[pumpController].instances[0].commandClasses[37].Get();
  this.rooms[HOT_WATER_INDEX].checkPumpStatus();
          
  // update each room and determine if we need to call for heat
  // hot water is treated separately
  for (i=0; i<this.rooms.length; i++) {
    this.rooms[i].updateCallForHeat();
    if (this.rooms[i].callForHeat && this.rooms[i].primary && this.rooms[i].type != RoomType.ONOFF) {
      callForHeat = true;
    }
  }

  // poll for the dual channel boiler receiver status
  // this is necessary because if either channel is activated manually we do not receive a notification
  zway.devices[this.boilerController].instances[1].commandClasses[37].Get();
  zway.devices[this.boilerController].instances[2].commandClasses[37].Get();
  this.checkHeatingSwitchStatus();
  this.checkWaterSwitchStatus();

  if (callForHeat && !this.heatingOn) {
      controller.addNotification("warning", "turning heating on", "module", "MyTestMod");
      this.logger.pushToLog("CFH",1);
      this.heatingOn = true;
      zway.devices[this.boilerController].instances[1].commandClasses[37].Set(true);
      this.heatingWakeup = FAILSAFE_OVERRIDE_TIMER;
  }
  else if (!callForHeat && this.heatingOn) {
      controller.addNotification("warning", "turning heating off", "module", "MyTestMod");
      this.logger.pushToLog("CFH",0);
      this.heatingOn = false;
      zway.devices[this.boilerController].instances[1].commandClasses[37].Set(false);
      this.heatingWakeup = 0;
  }

  if (this.rooms[HOT_WATER_INDEX].callForHeat && !this.waterOn) {
      controller.addNotification("warning", "turning water on", "module", "MyTestMod");
      this.waterOn = true;
      zway.devices[this.boilerController].instances[2].commandClasses[37].Set(true);
      this.waterWakeup = FAILSAFE_OVERRIDE_TIMER;
  }
  else if (!this.rooms[HOT_WATER_INDEX].callForHeat && this.waterOn) {
      controller.addNotification("warning", "turning water off", "module", "MyTestMod");
      this.waterOn = false;
      zway.devices[this.boilerController].instances[2].commandClasses[37].Set(false);
      this.waterWakeup = 0;
  }  
}

// if the heating switch is on, we need to keep it on by sending an occasional signal
MyTestMod.prototype.checkHeatingSwitchStatus = function () {
  if (this.heatingOn == true) {
    this.heatingWakeup--;

    if (this.heatingWakeup <= 0) {
      this.heatingWakeup = FAILSAFE_OVERRIDE_TIMER;
      // poke the switch
      zway.devices[this.boilerController].instances[1].commandClasses[37].Set(true);
    }  
  }
}

// if the water switch is on, we need to keep it on by sending an occasional signal
MyTestMod.prototype.checkWaterSwitchStatus = function () {
  if (this.waterOn == true) {
    this.waterWakeup--;

    if (this.waterWakeup <= 0) {
      this.waterWakeup = FAILSAFE_OVERRIDE_TIMER;
      // poke the switch
      zway.devices[this.boilerController].instances[2].commandClasses[37].Set(true);
    }  
  }
}


MyTestMod.prototype.listRooms = function ()
{
   var i;
   var len;

   console.log ("MYTESTMOD: " + controller);
   len = controller.locations.length;
   console.log ("MYTESTMOD: num locations is " + len);

   for (i=0; i<len; i++)
   {
      console.log("MYTESTMOD: " + controller.locations[i].id + " " + controller.locations[i].title + " " + controller.locations[i].user_img);
   }

   for (i=0; i<this.rooms.length; i++)
   {
      console.log("MYTESTMOD: my rooms " + this.rooms[i].title);
   }
}

// TODO: how do i make these part of MYTESTMOD?
var HOSTMANN_ID = 89;
var HOSTMANN_BOILER_CONTROL_ID = 1;
var HOSTMANN_THERMOSTAT_ID = 3;
var HOSTMANN_BOILER_CONTROL_TYPE = 3;
var HOSTMANN_THERMOSTAT_TYPE = 1;
var HOSTMANN_BOILER_DUAL_CONTROL_ID = 2;

var FIBARO_ID = 271;
var FIBARO_BUTTON_ID = 4096;
var FIBARO_BUTTON_TYPE = 3841;

var DANFOSS_ID = 2;
var DANFOSS_TRV_ID = 4;
var DANFOSS_TRV_TYPE = 5;

var PHILIO_ID = 316;
var PHILIO_SENSOR_ID = 13;
var PHILIO_SENSOR_TYPE = 2;



var FAILSAFE_OVERRIDE_TIMER = 30;



MyTestMod.prototype.getRoom = function (title)
{
   var i;

   console.log ("MYTESTMOD: get room for title " + title);
   for (i=0; i<this.rooms.length; i++)
   {
      if (this.rooms[i].title == title)
         return this.rooms[i];
   }
   console.log ("MYTESTMOD: no room found");
   return null;
}

MyTestMod.prototype.getRoomConfig = function (id) {
  return this.config.rooms[id-BASE_ROOM_ID];
}

MyTestMod.prototype.validateAndLoadConfig = function () {
  var room;

  // TODO:
  // Whole House relies on there being a master thermostat and a boiler controller - should raise an error and exit if there is not
  // Hot Water relies on there being a 2nd boiler controller - should raise an error and exit if there is not

  // TODO: sanity check that config matches the network and that first room is ON/OFF type for hot water
  console.log ("MYTESTMOD: config rooms len is "+this.config.rooms.length);
  for (i=0; i<this.config.rooms.length; i++) {
    var id = BASE_ROOM_ID + i;
    room = new Room (id,this.config.rooms[i].title,this.config.rooms[i].type,this.config.rooms[i].mode);
    room.primary = this.config.rooms[i].primary;
    room.hasTempSensor = !!this.config.rooms[i].tempSensorId;
    if (room.hasTempSensor) room.tempSensorId = this.config.rooms[i].tempSensorId;
    room.boostSP = !!this.config.rooms[i].boostSP?this.config.rooms[i].boostSP:COSY_SETPOINT;
    room.boostDuration = !!this.config.rooms[i].boostDuration?this.config.rooms[i].boostDuration:60;
    for (j=0; j<this.config.rooms[i].trvs.length; j++) {
      room.addTRV(this.config.rooms[i].trvs[j]);
    }
	if (id == WHOLE_HOUSE_ID) {
      // this will be pulled in from weather app
      room.externalTemp = null;		
	}
    if (id == HOT_WATER_ID) {
      // TODO: hard coding for now - possibly add to config
      room.pumpRelay = this.pumpController;
      room.pumpStatus = false;
      room.pumpDuration = 5;
      room.pumpTimeRemaining = 0;
      room.boostSP = 1.0;
      room.addNode(this.boilerController);     
	}
    this.rooms.push (room);
	room.loadSchedule (this.config.rooms[i].schedule);
	room.activateSchedule();	
  }
  
}

// TODO: where do this functions belong?

function getBoostTemp ()
{
  var boostSP = zway.devices[2].instances[0].commandClasses[67].data[1].val.value;
  var msg = "";

  if (boostSP < 4)
  {
    msg = "desired temp too low " + boostSP;
    controller.addNotification("warning", msg, "module", "MyTestMod");
    boostSP = 4;
  }

  if (boostSP > 28)
  {
     msg = "desired temp too high " + desired;
     controller.addNotification("warning", msg, "module", "MyTestMod");
     boostSP = 28;
  }

  return boostSP;
}

//
// find the first device that matches the manufacturer details
// return -1 if none found
//
function getDeviceByManufacturer (id, productId, productType)
{
   var i = 0;
   var count = 0;
   while (count < zway.devices.length)
   {
      if (zway.devices[i])
      {
         if ((zway.devices[i].data.manufacturerId.value == id) && 
             (zway.devices[i].data.manufacturerProductId.value == productId) &&
             (zway.devices[i].data.manufacturerProductType.value == productType))
         {
            return i;
         }
         count++;
      }
      i++;
   }
   return -1;

}

function deviceIsTempSensor (devIndex)
{
  return isDeviceByManufacturer (devIndex,HOSTMANN_ID, HOSTMANN_THERMOSTAT_ID, HOSTMANN_THERMOSTAT_TYPE) || isDeviceByManufacturer (devIndex,PHILIO_ID, PHILIO_SENSOR_ID, PHILIO_SENSOR_TYPE);
}

function deviceIsTRV (devIndex)
{
  return isDeviceByManufacturer (devIndex,DANFOSS_ID,DANFOSS_TRV_ID,DANFOSS_TRV_TYPE);
}

function isDeviceByManufacturer (devIndex, id, productId, productType)
{
  if (zway.devices[devIndex])
  {
    if ((zway.devices[devIndex].data.manufacturerId.value == id) && 
             (zway.devices[devIndex].data.manufacturerProductId.value == productId) &&
             (zway.devices[devIndex].data.manufacturerProductType.value == productType))
    {
      return true;
    }
  }

  return false;
}

// Load all of the required sub-modules

console.log ("MYTESTMOD: loading sub modules");

executeFile ('userModules/MyTestMod/schedule.js');
executeFile ('userModules/MyTestMod/room.js');
executeFile ('userModules/MyTestMod/router.js');
executeFile ('userModules/MyTestMod/logger.js');

// this module object
var boilerModule = null;


/********************************* DEBUG FUNCTIONS ***************************************

  These functions can be called from a browser using 

  http://<IP Address>/JS/Run/<function name>

  They output information to the log file

  var/log/z-way-server.log

******************************************************************************************/
function listDevices ()
{
   var i=0;
   var count=0;

   console.log ("MYTESTMOD: list devices number is " + zway.devices.length);
   while (count < zway.devices.length)
   {
      if (zway.devices[i])
      {         
         console.log ("MYTESTMOD: " + i + ": " + Object.getOwnPropertyNames (zway.devices[i].data));

         console.log ("MYTESTMOD: " + i + ": " + zway.devices[i].data.manufacturerId.value);
         console.log ("MYTESTMOD: " + i + ": " + zway.devices[i].data.manufacturerProductId.value);
         console.log ("MYTESTMOD: " + i + ": " + zway.devices[i].data.manufacturerProductType.value);
         count++;
      }
      i++;
   }
   console.log ("MYTESTMOD: list devices (controller) number is " + controller.devices.length);
   var devices = controller.devices.filter();
   console.log ("MYTESTMOD: " + Object.getOwnPropertyNames (devices)); 

   i=0;
   count=0;
   while (count < devices.length)
   {
      if (!!devices[i])
      {
         console.log("MYTESTMOD: " + i + ": " + Object.getOwnPropertyNames (devices[i]));
         count++;
      }
      i++;
  }
}

function listController ()
{
  for (var key in controller)
  {
    var value = controller[key];
    console.log ("MYTESTMOD: " + key + " : " + value);
  }
}

function listDevice (id)
{
  for (var key in zway.devices[id])
  {
    var value = zway.devices[id][key];
    console.log ("MYTESTMOD: " + key + " : " + value);
  }
}

function listLocations ()
{
   var i=0;
   var count=0;

   console.log ("MYTESTMOD: list locations number is " + controller.locations.length);
   while (count < controller.locations.length)
   {
      if (controller.locations[i])
      {         
         console.log ("MYTESTMOD: " + i + ": " + Object.getOwnPropertyNames (controller.locations[i]));

         console.log ("MYTESTMOD: " + i + ": " + controller.locations[i].title);
         console.log ("MYTESTMOD: " + i + ": " + controller.locations[i].id);
         count++;
      }
      i++;
   }
}


