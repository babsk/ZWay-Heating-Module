/************************************************

ScheduleEvent

*************************************************/

// constructor
function ScheduleEvent (day,hour,minute,sp,id)
{
   this.sp = sp;
   this.day = day;
   this.hour = hour;
   this.minute = minute;
   this.id = id;
   this.active = false;
   this.eventName = "MYTESTMOD."+this.id;

   var thisObject;

   this.start = function ()
   {
      thisObject = this;

      this.active = true;

      console.log("MYTESTMOD: on & emit " + this.eventName);
      controller.on(this.eventName, this.tick);
      controller.emit("cron.addTask",this.eventName,{
        minute: this.minute,
        hour: this.hour,
        weekDay: this.day,
        day: null,
        month: null
    });
   }

   this.stop = function ()
   {
      // remove the event
      this.active = false;
      console.log ("MYTESTMOD: removing timer event " + this.eventName);
      controller.emit("cron.removeTask",this.eventName);
      controller.off(this.eventName,thisObject.tick);
   }

   // this is the callback function which cron calls when the timer goes off
   this.tick = function () 
   {
      // remove the current timer event from cron
      thisObject.stop();

      // log the event
      controller.addNotification("warning", "timer tick "+thisObject.id + " temp "+thisObject.sp, "module", "MyTestMod");

      // extract the room object and act on the event
      room = boilerModule.getRoom (thisObject.id);
      room.setScheduleSP (thisObject.sp);
      room.activateNextEvent ();

   };
}
