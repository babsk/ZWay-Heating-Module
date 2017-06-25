// Unused, test code

// serviceBoiler
//
// compares current temperature to that desired and turns on the boiler
// appropriately
MyTestMod.prototype.serviceBoiler = function ()
{
   var currentTemp = zway.devices[2].instances[0].commandClasses[49].data[1].val;
   console.log("MyTestMod: current temp is " + currentTemp);
   var desiredTemp = zway.devices[2].instances[0].commandClasses[67].data[1].val;
   console.log("MyTestMod: desired temp is " + desiredTemp);

   if (currentTemp < desiredTemp)
   {
      controller.addNotification("warning", "boiler on", "core", "MyTestMod");
//      use smart switch for now
//      zway.devices[3].instances[0].commandClasses[32].Set(255);
   }
   else
   {
      controller.addNotification("warning", "boiler off", "core", "MyTestMod");
//      use smart switch for now
//      zway.devices[3].instances[0].commandClasses[32].Set(0);
   }
}


MyTestMod.prototype.reportTemperature = function (val)
{
   var servUrl = "http://www.grovestreams.com//api/feed?compId=mum+office&api_key=92f0627a-9228-38c2-9457-d00d74c1c805";
   var httpreq = servUrl + "&temperature=" + val;

//   console.log("MYTESTMOD: report temp " + httpreq);  

//   http.request({
//               method: 'PUT',
//                url: httpreq
//            });
 
}

MyTestMod.prototype.getSetPoint = function ()
{
   zway.devices[2].instances[0].commandClasses[67].Get();
}

MyTestMod.prototype.getTemp = function ()
{
   zway.devices[2].instances[0].commandClasses[49].Get();
}

function ABCXYZ ()
{
   console.log ("MYTESTMOD: ABCXYZ");
}

MyTestMod.prototype.abcxyz = function ()
{
   console.log ("MYTESTMOD: abcxyz");
}

// from init fn
    this.abcXYZ = function () {console.log("MYTESTMOD: abcXYZ");};

   !function (undefined) 
   {
      console.log("MYTESTMOD: weird function call");
   }();

