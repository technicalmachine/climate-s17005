var tessel = require('tessel');
var test = require('ttt');
var port = process.argv[2] || 'A';
var climatelib = require('/..');
var climate = null;
var TIMEOUT = 10000;

console.log('intialized everything');

test('\'ready\' event', function (t) {
  //  Connect to the module in a reasonable amount of time
  var startTime = new Date();
  climate = climatelib.use(tessel.port[port]);
  var requireTime = new Date();

  var rl = climate.on('ready', function () {
    clearTimeout(rlf);
    t.ok(true, 'Ready event fired');
    t.end();
    climate.removeListener('ready', rl);
  });

  var rlf = setTimeout(function () {
    climate.removeListener('ready', rl);
    t.ok(false, '\'ready\' event never fired');
    t.end();
  }, TIMEOUT);
});

test('Reasonable boot time', function (t) {
  t.ok(requireTime - startTime < 100, 'Module took longer than 100ms to boot');
  t.end();
});

/////////////////////////////      Functions     ///////////////////////////////

test('getData', function (t) {
  //  Temperature read
  climate.getData(0x10, function (err, data) {
    t.ok(!err, 'Error retrieving data from Si7005');
    t.ok(data, 'Invalid data retrieved from Si7005');
    t.end();
  });
});

test('readTemperature - Valid temperature reading, Celsius', function (t) {
  //  Don't end the test until the last part is done. There is 1 required event.
  var eventsCompleted = 0;
  var eventsRequired = 1;

  //  Celsius temperature event listener setup
  var rtcl = climate.on('temperature', function (temp, type) {
    if (type !== 'f') {
      clearTimeout(rtcf);
      climate.removeListener('ready', rtcl);
      t.ok(true, '\'temperature\' event for Celsius fired');
      eventsCompleted++;
    } 
  });

  //  Celsius temperature event failure to fire
  var rtcf = setTimeout(function () {
    climate.removeListener('temperature', rtcl);
    t.ok(false, '\'temperature\' event for Celsius never fired');
    eventsCompleted++;
  }, TIMEOUT);

  climate.readTemperature(function (err, temp) {
    //  Make sure there was no error reading the temperature
    t.ok(!err, 'Error reading temperature in Celsius');

    //  Does the temperature reading make sense?
    t.equal(typeof temp, 'number', 'Returned temperature in Celsius was not a number');
    t.ok(temp > -100 && temp < 200, 'Returned temperature in Celsius does not make sense physically');
  });

  //  Wait for event to pass/fail
  var complete = setInterval(function () {
    if (eventsCompleted === eventsRequired) {
      clearInterval(complete);
      t.end();
    }
  }, 100);
});

test('readTemperature - Valid temperature reading, Farenheit', function (t) {
  //  Don't end the test until the last part is done. There is 1 required event.
  var eventsCompleted = 0;
  var eventsRequired = 1;

  //  Farenheit temperature event listener setup
  var rtfl = climate.on('temperature', function (temp, type) {
    if (type === 'f') {
      clearTimeout(rtff);
      climate.removeListener('ready', rtfl);
      t.ok(true, '\'temperature\' event for Farenheit fired');
      eventsCompleted++;
    }
  });

  //  Farenheit temperature event failure to fire
  var rtff = setTimeout(function () {
    climate.removeListener('temperature', rtfl);
    t.ok(false, '\'temperature\' event for Farenheit never fired');
    eventsCompleted++;
  }, TIMEOUT);

  climate.readTemperature('f', function (err, temp) {
    //  Make sure there was no error reading the temperature
    t.ok(!err, 'Error reading temperature in Farenheit');

    //  Does the temperature reading make sense?
    t.equal(typeof temp, 'number', 'Returned temperature in Farenheit was not a number');
    t.ok(temp > -100 && temp < 200, 'Returned temperature in Farenheit does not make sense physically');
  });

  //  Wait for event to pass/fail
  var complete = setInterval(function () {
    if (eventsCompleted === eventsRequired) {
      clearInterval(complete);
      t.end();
    }
  }, 100);
});

test('readTemperature - consistent Farenheit and Celsius measurements and events', function (t) {
  //  Read the temperatures
  climate.readTemperature(function (errC, tempC) {
    climate.readTemperature('f', function (errF, tempF) {
      //  Sanity check
      t.ok(!errC && !errF, 'Error reading temperatures, which is odd because they passed last time...');
      t.ok(Math.abs((tempF - 32) * (5.0/9.0) - tempC) < 0.5, 'Temperature mismatch by more than 0.5 degrees C in consecutive reads with unit conversion');
      t.end();
    });
  });
});

test('readHumidity', function (t) {
  //  Don't end the test until the last part is done. There is 1 required event.
  var eventsCompleted = 0;
  var eventsRequired = 1;

  //  Event listener setup
  var rhl = climate.on('humidity', function () {
    clearTimeout(rhf);
    climate.removeListener('ready', rhl);
    t.ok(true, '\'humidity\' event fired');
    //  If we're last, end the test, otherwise, set the other guy to last
    eventsCompleted++;
  });

  //  Humidity event failure to fire
  var rhf = setTimeout(function () {
    climate.removeListener('humidity', rhl);
    t.ok(false, '\'humidity\' event never fired');
    eventsCompleted++;
  }, TIMEOUT);

  //  Actually read the humidity
  climate.readHumidity(function (err, hum) {
    //  Make sure there was no error reading the humidity
    t.ok(!err, 'Error reading humidity');

    //  Check the humidity value
    t.equal(typeof hum, 'number', 'Returned humidity was not a number');
    t.ok(hum >= -50 && hum <= 150, 'Returned humidity value does not make sense physically');
  });

  //  Wait for event to pass/fail
  var complete = setInterval(function () {
    if (eventsCompleted === eventsRequired) {
      clearInterval(complete);
      t.end();
    }
  }, 100);
});

test('setHeater', function (t) {
  //  Get the current heater setting
  var heaterStart = climate._configReg & 0x02;
  //  Set the heater bit to false
  climate.setHeater(false);
  var heaterOff = climate._configReg & 0x02;
  //  Set the heater bit to true
  climate.setHeater(true);
  var heaterOn = climate._configReg & 0x02;

  //  Make sure we're setting the internal variable correctly
  t.ok(!heaterStart, 'Heater was on by default');
  t.ok(!heaterOff, 'Unable to deactivate heater');
  t.ok(heaterOn, 'Unable to activate heater');

  //  Make sure it can get set/reset randomly
  var targets = [];
  var values = [];
  var tries = 100;
  for (var i = 0; i < tries; i++) {
    var target = Math.random() > 0.5 ? true : false;
    targets.push(target);
    climate.setHeater(target);
    values.push(climate._configReg & 0x02 ? true : false);
  }
  for (i = 0; i < tries; i++) {
    if (targets[i] != values[i]) {
      console.log('fail\n', targets, values);
      t.ok(false, 'Random heater set/reset failed');
      break;
    }
    if (i == tries-1) {
      t.ok(true, 'Random heater set/reset successful');
    }
  }
  
  climate.setHeater(true);
  //  Actually turn the heater on by sending a read command
  climate.readTemperature(function (err1, temp1) {
    //  Wait for the thing to heat up a little
    setTimeout( function () {
      //  Take another measurement
      climate.readTemperature(function (err2, temp2) {
        t.ok(!err1 && !err2 && temp1 && temp2, 'Error or invalid measurements during reads');
        t.ok(temp2 >= temp1, 'Heater nonfunctional: t1='+temp1+', t2='+temp2);
        //  Turn the heater back off
        climate.setHeater(false);
        climate.readTemperature(function () {
          t.end();
        });
      });
    }, 100);
  });
});

test('setFastMeasure', function (t) {
  //  Get the current fastMeasure setting
  var fastMeasureStart = climate._configReg & 0x20;
  //  Set the fastMeasure bit to false
  climate.setFastMeasure(false);
  var fastMeasureOff = climate._configReg & 0x20;
  //  Set the fastMeasure bit to true
  climate.setFastMeasure(true);
  var fastMeasureOn = climate._configReg & 0x20;

  //  Make sure we're setting the internal variable correctly
  t.ok(!fastMeasureStart, 'fastMeasure was on by default');
  t.ok(!fastMeasureOff, 'Unable to deactivate fastMeasure');
  t.ok(fastMeasureOn, 'Unable to activate fastMeasure');

  //  Make sure it can get set/reset randomly
  var targets = [];
  var values = [];
  var tries = 100;
  for (var i = 0; i < tries; i++) {
    var target = Math.random() > 0.5 ? true : false;
    targets.push(target);
    climate.setFastMeasure(target);
    values.push(climate._configReg & 0x20 ? true : false);
  }
  for (i = 0; i < tries; i++) {
    if (targets[i] != values[i]) {
      console.log('fail\n', targets, values);
      t.ok(false, 'Random fastMeasure set/reset failed');
      break;
    }
    if (i == tries-1) {
      t.ok(true, 'Random fastMeasure set/reset successful');
    }
  }

  //  Actually see if we can measure faster. Start by allocating memory. 
  var dtNormalT = new Date();
  var dtFastT = new Date();
  var dtNormalH = new Date();
  var dtFastH = new Date();
  var foo = new Date(); 
  //  Start false
  climate.setFastMeasure(false);
  climate.readTemperature(function (err, data) {
    //  Setting transferred, so gather data
    foo = new Date();
    climate.readTemperature(function (err1, data1) {
      dtNormalT = new Date() - foo;

      foo = new Date();
      climate.readHumidity(function (err2, data2) {
        dtNormalH = new Date() - foo;

        //  Switch to true, transfer setting
        climate.setFastMeasure(true);
        climate.readHumidity(function (err3, data3) {

          foo = new Date();
          climate.readHumidity(function (err4, data4) {
            dtFastH = new Date() - foo;

            foo = new Date();
            climate.readTemperature(function (err5, data5) {
              dtFastT = new Date() - foo;

              //  Sanity check
              t.ok(!err && !err1 && !err2 && !err3 && !err4 && !err5 &&
                    data && data1 && data2 && data3 && data4 && data5, 
                    'Measurements unsuccessful or invalid');
              t.ok(dtFastT < dtNormalT, 'fastMeasure was slow for temperature');
              t.ok(dtFastH < dtNormalH, 'fastMeasure was slow for humidity');
              t.end();
            });
          });
        });
      });
    });
  });
});
