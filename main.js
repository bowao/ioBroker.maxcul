/* jshint -W097 */// jshint strict:false
/*jslint node: true */

'use strict';
// you have to require the utils module and call adapter function
var utils = require(__dirname + '/lib/utils'); // Get common adapter utils

var max;
var objects = {};
var SerialPort;
var devices = {};
var timers = {};
var limitOverflow = null;
var credits = 0;
var connected = false;

var adapter = utils.adapter('maxcul');

adapter.on('stateChange', function (id, state) {
    if (!id || !state || state.ack) return;
    if (!objects[id] || !objects[id].native) {
        adapter.log.warn('Unknown ID: ' + id);
        return;
    }
    if (!objects[id].common.write) {
        adapter.log.warn('id "' + id + '" is readonly');
        return;
    }
    var channel = id.split('.');
    var name = channel.pop();
    if (channel[channel.length - 1] === 'config') channel.pop();
    channel = channel.join('.');

    if (timers[channel]) clearTimeout(timers[channel].timer);

    timers[channel] = timers[channel] || {};
    timers[channel][name] = state.val;
    timers[channel].timer = setTimeout(function (ch) {
        sendInfo(ch);
    }, 1000, channel);
});

adapter.on('unload', function (callback) {
    if (adapter && adapter.setState) adapter.setState('info.connection', false, true);
    if (max) max.disconnect();
    callback();
});

adapter.on('ready', main);

adapter.on('message', function (obj) {
    if (obj) {
        switch (obj.command) {
            case 'listUart':
                if (obj.callback) {
                    if (SerialPort) {
                        // read all found serial ports
                        SerialPort.list(function (err, ports) {
                            adapter.log.info('List of port: ' + JSON.stringify(ports));
                            adapter.sendTo(obj.from, obj.command, ports, obj.callback);
                        });
                    } else {
                        adapter.log.warn('Module serialport is not available');
                        adapter.sendTo(obj.from, obj.command, [{comName: 'Not available'}], obj.callback);
                    }
                }

                break;
        }
    }
});

function checkPort(callback) {
    if (!adapter.config.serialport) {
        if (callback) callback('Port is not selected');
        return;
    }
    var sPort;
    try {
        sPort = new SerialPort(adapter.config.serialport || '/dev/ttyACM0', {
            baudrate: parseInt(adapter.config.baudrate, 10) || 9600,
            autoOpen: false
        });
        sPort.on('error', function (err) {
            if (sPort.isOpen()) sPort.close();
            if (callback) callback(err);
            callback = null;
        });

        sPort.open(function (err) {
            if (sPort.isOpen()) sPort.close();

            if (callback) callback(err);
            callback = null;
        });
    } catch (e) {
        adapter.log.error('Cannot open port: ' + e);
        try {
            if (sPort.isOpen()) sPort.close();
        } catch (ee) {

        }
        if (callback) callback(e);
    }
}

function sendConfig(channel) {
    if (!max) return;
    max.sendConfig(
        objects[channel].native.src,
        timers[channel].comfortTemperature,
        timers[channel].ecoTemperature,
        timers[channel].minimumTemperature,
        timers[channel].maximumTemperature,
        timers[channel].offset,
        timers[channel].windowOpenTime,
        timers[channel].windowOpenTemperature,
        objects[channel].native.type);

    delete timers[channel].comfortTemperature;
    delete timers[channel].ecoTemperature;
    delete timers[channel].minimumTemperature;
    delete timers[channel].maximumTemperature;
    delete timers[channel].windowOpenTime;
    delete timers[channel].offset;
    delete timers[channel].windowOpenTemperature;
}

function sendTemperature(channel) {
    if (!max) return;
    max.sendDesiredTemperature(
        objects[channel].native.src,
        timers[channel].desiredTemperature,
        timers[channel].mode,
        '00',
        objects[channel].native.type);
    delete timers[channel].mode;
    delete timers[channel].desiredTemperature;
}

function sendInfo(channel) {
    if (!timers[channel]) return;

    if (credits < 120) {
        adapter.log.warn('Not enough credits. Wait for more...');
        timers[channel].timer = setTimeout(function () {
            sendInfo(channel);
        }, 5000);
        return;
    }

    timers[channel].timer = null;

    if (timers[channel].mode !== undefined || timers[channel].desiredTemperature !== undefined) {
        var count1 = 0;
        if (timers[channel].mode === undefined) {
            count1++;
            adapter.getForeignState(channel + '.mode', function (err, state) {
                if (!state || state.val === null || state.val === undefined) {
                    state = state || {};
                    state.val = 0;
                }
                timers[channel].mode = state.val;
                if (!--count1) sendTemperature(channel);
            });
        }
        if (timers[channel].desiredTemperature === undefined) {
            count1++;
            adapter.getForeignState(channel + '.desiredTemperature', function (err, state) {
                if (!state || state.val === null || state.val === undefined) {
                    state = state || {};
                    state.val = 21;
                }
                timers[channel].desiredTemperature = state.val;
                if (!--count1) sendTemperature(channel);
            });
        }
        if (!count1) sendTemperature(channel);
    }
    // comfortTemperature, ecoTemperature, minimumTemperature, maximumTemperature, offset, windowOpenTime, windowOpenTemperature
    if (timers[channel].comfortTemperature      !== undefined ||
        timers[channel].ecoTemperature          !== undefined ||
        timers[channel].minimumTemperature      !== undefined ||
        timers[channel].maximumTemperature      !== undefined ||
        timers[channel].offset                  !== undefined ||
        timers[channel].windowOpenTime          !== undefined ||
        timers[channel].windowOpenTemperature   !== undefined) {
        var count2 = 0;
        if (timers[channel].comfortTemperature === undefined) {
            count2++;
            adapter.getForeignState(channel + '.comfortTemperature', function (err, state) {
                if (!state || state.val === null || state.val === undefined) {
                    state = state || {};
                    state.val = 21;
                }
                timers[channel].comfortTemperature = state.val;
                if (!--count2) sendConfig(channel);
            });
        }
        if (timers[channel].ecoTemperature === undefined) {
            count2++;
            adapter.getForeignState(channel + '.ecoTemperature', function (err, state) {
                if (!state || state.val === null || state.val === undefined) {
                    state = state || {};
                    state.val = 21;
                }
                timers[channel].ecoTemperature = state.val;
                if (!--count2) sendConfig(channel);
            });
        }
        if (timers[channel].minimumTemperature === undefined) {
            count2++;
            adapter.getForeignState(channel + '.minimumTemperature', function (err, state) {
                if (!state || state.val === null || state.val === undefined) {
                    state = state || {};
                    state.val = 4.5;
                }
                timers[channel].minimumTemperature = state.val;
                if (!--count2) sendConfig(channel);
            });
        }
        if (timers[channel].maximumTemperature === undefined) {
            count2++;
            adapter.getForeignState(channel + '.maximumTemperature', function (err, state) {
                if (!state || state.val === null || state.val === undefined) {
                    state = state || {};
                    state.val = 30.5;
                }
                timers[channel].maximumTemperature = state.val;
                if (!--count2) sendConfig(channel);
            });
        }
        if (timers[channel].offset === undefined) {
            count2++;
            adapter.getForeignState(channel + '.offset', function (err, state) {
                if (!state || state.val === null || state.val === undefined) {
                    state = state || {};
                    state.val = 0;
                }
                timers[channel].offset = state.val;
                if (!--count2) sendConfig(channel);
            });
        }
        if (timers[channel].windowOpenTime === undefined) {
            count2++;
            adapter.getForeignState(channel + '.windowOpenTime', function (err, state) {
                if (!state || state.val === null || state.val === undefined) {
                    state = state || {};
                    state.val = 0;
                }
                timers[channel].windowOpenTime = state.val;
                if (!--count2) sendConfig(channel);
            });
        }
        if (timers[channel].windowOpenTemperature === undefined) {
            count2++;
            adapter.getForeignState(channel + '.windowOpenTemperature', function (err, state) {
                if (!state || state.val === null || state.val === undefined) {
                    state = state || {};
                    state.val = 12;
                }
                timers[channel].windowOpenTemperature = state.val;
                if (!--count2) sendConfig(channel);
            });
        }
        if (!count2) sendConfig(channel);
    }
}

var tasks = [];

function processTasks() {
    if (tasks.length) {
        var task = tasks.shift();
        if (task.type === 'state') {
            adapter.setForeignState(task.id, task.val, true, function () {
                setTimeout(processTasks, 0);
            });
        } else if (task.type === 'object') {
            adapter.getForeignObject(task.id, function (err, obj) {
                if (!obj) {
                    objects[task.id] = task.obj;
                    adapter.setForeignObject(task.id, task.obj, function (err, res) {
                        adapter.log.info('object ' + adapter.namespace + '.' + task.id + ' created');
                        setTimeout(processTasks, 0);
                    });
                } else {
                    var changed = false;
                    if (JSON.stringify(obj.native) !== JSON.stringify(task.obj.native)) {
                        obj.native = task.obj.native;
                        changed = true;
                    }

                    if (changed) {
                        objects[obj._id] = obj;
                        adapter.setForeignObject(obj._id, obj, function (err, res) {
                            adapter.log.info('object ' + adapter.namespace + '.' + obj._id + ' created');
                            setTimeout(processTasks, 0);
                        });
                    } else {
                        setTimeout(processTasks, 0);
                    }
                }
            });
        } else {
            adapter.log.error('Unknown task: ' + task.type);
            setTimeout(processTasks, 0);
        }
    }
}

function setStates(obj) {
    var id = obj.serial;
    var isStart = !tasks.length;

    for (var state in obj.data) {
        if (!obj.data.hasOwnProperty(state)) continue;
        if (state === 'src') continue;
        if (state === 'serial') continue;

        var oid  = adapter.namespace + '.' + id + '.' + state;
        var meta = objects[oid];
        var val  = obj.data[state];
        if (meta) {
            if (meta.common.type === 'boolean') {
                val = val === 'true' || val === true || val === 1 || val === '1' || val === 'on';
            } else if (meta.common.type === 'number') {
                if (val === 'on'  || val === 'true'  || val === true)  val = 1;
                if (val === 'off' || val === 'false' || val === false) val = 0;
                val = parseFloat(val);
            }
        }
        if (objects[oid]) {
            tasks.push({type: 'state', id: oid, val: val});
        }
    }
    if (isStart) processTasks();
}

function syncObjects(objs) {
    var isStart = !tasks.length;
    for (var i = 0; i < objs.length; i++) {
        if (objs[i].native && objs[i].native.type && !devices[objs[i].native.src]) {
            devices[objs[i].native.src] = objs[i];
        }
        tasks.push({type: 'object', id: objs[i]._id, obj: objs[i]});
    }
    if (isStart) processTasks()
}

function hex2a(hexx) {
    var hex = hexx.toString();//force conversion
    var str = '';
    for (var i = 0; i < hex.length; i += 2)
        str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
    return str;
}

function createThermostat(data) {
    //var t = {
    //    "src": "160bd0",
    //    "mode": 1,                   // <==
    //    "desiredTemperature": 30.5,  // <==
    //    "valvePosition": 100,        // <==
    //    "measuredTemperature": 22.4, // <==
    //    "dstSetting": 1,             // <==
    //    "langateway": 1,             // <==
    //    "panel": 0,                  // <==
    //    "rfError": 0,                // <==
    //    "batteryLow": 0,             // <==
    //    "untilString": ""
    //};

    // comfortTemperature, ecoTemperature, minimumTemperature, maximumTemperature, offset, windowOpenTime, windowOpenTemperature
    if (!data.serial && data.raw) {
        data.serial = hex2a(data.raw.substring(data.raw.length - 20));
    }

    if (!data.serial) data.serial = data.src.toUpperCase();

    var obj = {
        _id: adapter.namespace + '.' + data.serial,
        common: {
            role: 'thermostat',
            name: 'Thermostat ' + data.serial
        },
        type: 'channel',
        native: data
    };
    var objs = [obj];
    obj = {
        _id: adapter.namespace + '.' + data.serial + '.mode',
        common: {
            name: 'Thermostat ' + data.serial + ' mode',
            type: 'number',
            role: 'level.mode',
            read: true,
            write: true,
            states: {
                0: 'auto',
                1: 'manual',
                3: 'boost'
            }
        },
        type: 'state',
        native: data
    };
    objs.push(obj);

    obj = {
        _id: adapter.namespace + '.' + data.serial + '.measuredTemperature',
        common: {
            name: 'Thermostat ' + data.serial + ' current temperature',
            type: 'number',
            read: true,
            write: false,
            role: 'value.temperature',
            unit: '°C'
        },
        type: 'state',
        native: data
    };
    objs.push(obj);

    obj = {
        _id: adapter.namespace + '.' + data.serial + '.desiredTemperature',
        common: {
            name: 'Thermostat ' + data.serial + ' set temperature',
            type: 'number',
            read: true,
            write: true,
            min: 4.5,
            max: 30.5,
            role: 'level.temperature',
            unit: '°C'
        },
        type: 'state',
        native: data
    };
    objs.push(obj);

    obj = {
        _id: adapter.namespace + '.' + data.serial + '.valvePosition',
        common: {
            name: 'Thermostat ' + data.serial + ' valve',
            type: 'number',
            read: true,
            write: false,
            role: 'value.valve',
            unit: '%',
            min: 0,
            max: 100
        },
        type: 'state',
        native: data
    };
    objs.push(obj);

    obj = {
        _id: adapter.namespace + '.' + data.serial + '.rfError',
        common: {
            name: 'Thermostat ' + data.serial + ' error',
            type: 'boolean',
            read: true,
            write: false,
            role: 'indicator.reachable'
        },
        type: 'state',
        native: data
    };
    objs.push(obj);

    obj = {
        _id: adapter.namespace + '.' + data.serial + '.batteryLow',
        common: {
            name: 'Thermostat ' + data.serial + ' low battery',
            type: 'boolean',
            read: true,
            write: false,
            role: 'indicator.battery'
        },
        type: 'state',
        native: data
    };
    objs.push(obj);

    // comfortTemperature,
    // ecoTemperature,
    // minimumTemperature,
    // maximumTemperature,
    // offset,
    // windowOpenTime,
    // windowOpenTemperature
    obj = {
        _id: adapter.namespace + '.' + data.serial + '.config.comfortTemperature',
        common: {
            name: 'Thermostat ' + data.serial + ' comfort temperature',
            type: 'number',
            read: true,
            write: true,
            min: 4.5,
            max: 30.5,
            role: 'level.temperature',
            unit: '°C'
        },
        type: 'state',
        native: data
    };
    objs.push(obj);

    obj = {
        _id: adapter.namespace + '.' + data.serial + '.config.ecoTemperature',
        common: {
            name: 'Thermostat ' + data.serial + ' eco temperature',
            type: 'number',
            read: true,
            write: true,
            min: 4.5,
            max: 30.5,
            role: 'level.temperature',
            unit: '°C'
        },
        type: 'state',
        native: data
    };
    objs.push(obj);

    obj = {
        _id: adapter.namespace + '.' + data.serial + '.config.minimumTemperature',
        common: {
            name: 'Thermostat ' + data.serial + ' minimum temperature',
            type: 'number',
            read: true,
            write: true,
            min: 4.5,
            max: 30.5,
            role: 'level.temperature',
            unit: '°C'
        },
        type: 'state',
        native: data
    };
    objs.push(obj);

    obj = {
        _id: adapter.namespace + '.' + data.serial + '.config.maximumTemperature',
        common: {
            name: 'Thermostat ' + data.serial + ' maximum temperature',
            type: 'number',
            read: true,
            write: true,
            min: 4.5,
            max: 30.5,
            role: 'level.temperature',
            unit: '°C'
        },
        type: 'state',
        native: data
    };
    objs.push(obj);

    obj = {
        _id: adapter.namespace + '.' + data.serial + '.config.offset',
        common: {
            name: 'Thermostat ' + data.serial + ' maximum temperature',
            type: 'number',
            read: true,
            write: true,
            min: 4.5,
            max: 30.5,
            role: 'level.temperature',
            unit: '°C'
        },
        type: 'state',
        native: data
    };
    objs.push(obj);

    obj = {
        _id: adapter.namespace + '.' + data.serial + '.config.windowOpenTemperature',
        common: {
            name: 'Thermostat ' + data.serial + ' window open temperature',
            type: 'number',
            read: true,
            write: true,
            min: 4.5,
            max: 30.5,
            role: 'level.temperature',
            unit: '°C'
        },
        type: 'state',
        native: data
    };
    objs.push(obj);

    obj = {
        _id: adapter.namespace + '.' + data.serial + '.config.windowOpenTime',
        common: {
            name: 'Thermostat ' + data.serial + ' window open time',
            type: 'number',
            read: true,
            write: true,
            role: 'level.interval',
            unit: 'sec'
        },
        type: 'state',
        native: data
    };
    objs.push(obj);

    obj = {
        _id: adapter.namespace + '.' + data.serial + '.rssi',
        common: {
            name: 'Thermostat ' + data.serial + ' signal strength',
            type: 'number',
            read: true,
            write: false,
            role: 'value.rssi',
            unit: 'dBm'
        },
        type: 'state',
        native: data
    };
    objs.push(obj);

    syncObjects(objs);
}

function createButton(data) {
    //var t = {
    //    "src": "160bd0",
    //    "isOpen": 1,                   // <==
    //    "rfError": 30.5,  // <==
    //    "batteryLow": 100
    //};

    if (!data.serial && data.raw) {
        data.serial = hex2a(data.raw.substring(data.raw.length - 20));
    }

    if (!data.serial) data.serial = data.src.toUpperCase();

    var obj = {
        _id: adapter.namespace + '.' + data.serial,
        common: {
            role: 'button',
            name: 'Push button ' + data.serial
        },
        type: 'channel',
        native: data
    };
    var objs = [obj];
    obj = {
        _id: adapter.namespace + '.' + data.serial + '.pressed',
        common: {
            name: 'Push button ' + data.serial + ' pressed',
            type: 'boolean',
            role: 'button',
            read: true,
            write: false
        },
        type: 'state',
        native: data
    };
    objs.push(obj);

    obj = {
        _id: adapter.namespace + '.' + data.serial + '.rfError',
        common: {
            name: 'Push button ' + data.serial + ' error',
            type: 'boolean',
            read: true,
            write: false,
            role: 'indicator.reachable'
        },
        type: 'state',
        native: data
    };
    objs.push(obj);

    obj = {
        _id: adapter.namespace + '.' + data.serial + '.batteryLow',
        common: {
            name: 'Push button ' + data.serial + ' low battery',
            type: 'boolean',
            read: true,
            write: false,
            role: 'indicator.battery'
        },
        type: 'state',
        native: data
    };
    objs.push(obj);

    obj = {
        _id: adapter.namespace + '.' + data.serial + '.rssi',
        common: {
            name: 'Push button ' + data.serial + ' signal strength',
            type: 'number',
            read: true,
            write: false,
            role: 'value.rssi',
            unit: 'dBm'
        },
        type: 'state',
        native: data
    };
    objs.push(obj);
    
    syncObjects(objs);
}

function createContact(data) {
    //var t = {
    //    "src": "160bd0",
    //    "isOpen": 1,                   // <==
    //    "rfError": 30.5,  // <==
    //    "batteryLow": 100
    //};

    if (!data.serial && data.raw) {
        data.serial = hex2a(data.raw.substring(data.raw.length - 20));
    }

    if (!data.serial) data.serial = data.src.toUpperCase();

    var obj = {
        _id: adapter.namespace + '.' + data.serial,
        common: {
            role: 'indicator',
            name: 'Push button ' + data.serial
        },
        type: 'channel',
        native: data
    };
    var objs = [obj];
    obj = {
        _id: adapter.namespace + '.' + data.serial + '.isOpen',
        common: {
            name: 'Contact ' + data.serial + ' opened',
            type: 'boolean',
            role: 'button',
            read: true,
            write: false
        },
        type: 'state',
        native: data
    };
    objs.push(obj);

    obj = {
        _id: adapter.namespace + '.' + data.serial + '.rfError',
        common: {
            name: 'Contact ' + data.serial + ' error',
            type: 'boolean',
            read: true,
            write: false,
            role: 'indicator.reachable'
        },
        type: 'state',
        native: data
    };
    objs.push(obj);

    obj = {
        _id: adapter.namespace + '.' + data.serial + '.batteryLow',
        common: {
            name: 'Contact ' + data.serial + ' low battery',
            type: 'boolean',
            read: true,
            write: false,
            role: 'indicator.battery'
        },
        type: 'state',
        native: data
    };
    objs.push(obj);

    obj = {
        _id: adapter.namespace + '.' + data.serial + '.rssi',
        common: {
            name: 'Contact ' + data.serial + ' signal strength',
            type: 'number',
            read: true,
            write: false,
            role: 'value.rssi',
            unit: 'dBm'
        },
        type: 'state',
        native: data
    };
    objs.push(obj);
    
    syncObjects(objs);
}

function connect() {
    adapter.setState('info.connection', false, true);
	if (!adapter.config.serialport) {
        adapter.log.warn('Please define the serial port.');
        return;
    }
	
    var env = {
        logger: adapter.log
    };

    var Max = require(__dirname + '/lib/maxcul')(env);

    max = new Max(adapter.config.baseAddress, true, adapter.config.serialport, parseInt(adapter.config.baudrate, 10) || 9600);

    setInterval(function () {
        max.getCredits();
    }, 5000);

    max.on('creditsReceived', function (creidt, credit1) {
        if (!connected) {
            connected = true;
            adapter.setState('info.connection', true, true);
        }

        credits = parseInt(creidt, 10);
        if (credits < 120) {
            if (!limitOverflow) {
                limitOverflow = true;
                adapter.setState('info.limitOverflow', true, true);
            }
        } else {
            if (limitOverflow === null || limitOverflow) {
                limitOverflow = false;
                adapter.setState('info.limitOverflow', false, true);
            }
        }
        adapter.setState('info.quota', credits, true);
    });

    max.on('ShutterContactStateRecieved', function (data) {
        if (!connected) {
            connected = true;
            adapter.setState('info.connection', true, true);
        }
        if (limitOverflow) {
            limitOverflow = false;
            adapter.setState('info.limitOverflow', false, true);
        }
        adapter.log.debug('ShutterContactStateRecieved: ' + JSON.stringify(data));
        if (devices[data.src]) {
            setStates({serial: devices[data.src].native.serial, data: data});
        } else {
            adapter.log.warn('Unknown device: ' + JSON.stringify(data));
            createButton(data);
        }
    });

    max.on('culFirmwareVersion', function (data) {
        adapter.setState('info.version', data, true);
        if (!connected) {
            connected = true;
            adapter.setState('info.connection', true, true);
        }
    });

    max.on('ThermostatStateRecieved', function (data) {
        if (!connected) {
            connected = true;
            adapter.setState('info.connection', true, true);
        }
        if (limitOverflow) {
            limitOverflow = false;
            adapter.setState('info.limitOverflow', false, true);
        }
        //ThermostatStateRecieved: {"src":"160bd0","mode":1,"desiredTemperature":30.5,"valvePosition":100,"measuredTemperature":22.4,"dstSetting":1,"lanGateway":1,"panel":0,"rfError":0,"batteryLow":0,"untilString":""}
        if (devices[data.src]) {
            setStates({serial: devices[data.src].native.serial, data: data});
        } else {
            adapter.log.warn('Unknown device: ' + JSON.stringify(data));
            createThermostat(data);
        }
        adapter.log.debug('ThermostatStateRecieved: ' + JSON.stringify(data));
    });

    max.on('PushButtonStateRecieved', function (data) {
        if (!connected) {
            connected = true;
            adapter.setState('info.connection', true, true);
        }
        if (limitOverflow) {
            limitOverflow = false;
            adapter.setState('info.limitOverflow', false, true);
        }
        adapter.log.debug('PushButtonStateRecieved: ' + JSON.stringify(data));
        if (devices[data.src]) {
            setStates({serial: devices[data.src].native.serial, data: data});
        } else {
            adapter.log.warn('Unknown device: ' + JSON.stringify(data));
            createButton(data);
        }
    });

    max.on('checkTimeIntervalFired', function () {
        if (!connected) {
            connected = true;
            adapter.setState('info.connection', true, true);
        }
        if (limitOverflow) {
            limitOverflow = false;
            adapter.setState('info.limitOverflow', false, true);
        }

        adapter.log.info('checkTimeIntervalFired');
        adapter.logger.debug("Updating time information for deviceId");
        max.sendTimeInformation(adapter.config.baseAddress);
    });

    max.on('deviceRequestTimeInformation', function (src) {
        if (!connected) {
            connected = true;
            adapter.setState('info.connection', true, true);
        }
        if (limitOverflow) {
            limitOverflow = false;
            adapter.setState('info.limitOverflow', false, true);
        }
        adapter.log.info('deviceRequestTimeInformation: ' + JSON.stringify(src));
        adapter.log.debug("Updating time information for deviceId " + src);
        if (devices[src]) {
            max.sendTimeInformation(src, devices[src].native.type);
        }
    });

    max.on('LOVF', function () {
        if (!connected) {
            connected = true;
            adapter.setState('info.connection', true, true);
        }
        adapter.log.debug('LOVF: credits=' + credits);
        if (!limitOverflow) {
            limitOverflow = true;
            adapter.setState('info.limitOverflow', true, true);
        }
    });

    max.on('PairDevice', function (data) {
        if (!connected) {
            connected = true;
            adapter.setState('info.connection', true, true);
        }
        if (limitOverflow) {
            limitOverflow = false;
            adapter.setState('info.limitOverflow', false, true);
        }
        adapter.log.info('PairDevice: ' + JSON.stringify(data));
        if (data.type === 1 || data.type === 2 || data.type === 3) {
            createThermostat(data);
        } else if (data.type === 4) {
            createContact(data);
        } else if (data.type === 5) {
            createButton(data);
        } else {
            adapter.log.warn('Received unknown type: ' + JSON.stringify(data));
        }
    });

    if (adapter.config.serialport && adapter.config.serialport !== 'DEBUG') {
        max.connect();
    } else if (adapter.config.serialport === 'DEBUG') {
        setTimeout(function () {
            max.emit('PairDevice', {
                src: '160bd0',
                type: 1,
                raw: 'Z17000400160BD0123456001001A04E455130363731393837'
            });
        }, 100);
        
        setTimeout(function () {
            max.emit('ThermostatStateRecieved', {
                src: '160bd0',
                mode: 1,
                desiredTemperature: 30.5,
                valvePosition: 100,
                measuredTemperature: 22.4,
                dstSetting: 1,
                lanGateway: 1,
                panel: 0,
                rfError: 0,
                batteryLow: 0,
                untilString: '',
                rssi: 10
            });
        }, 1200);

        setTimeout(function () {
            max.emit('PairDevice', {
                src: '160bd1',
                type: 5,
                raw: 'Z17000400160BD0123456001001A04E455130363731393839'
            });
        }, 300);

        setTimeout(function () {
            max.emit('PushButtonStateRecieved', {
                src: '160bd1',
                pressed: 1,
                rfError: 1,
                batteryLow: 0,
                rssi: 10
            });
        }, 1400);

        setTimeout(function () {
            max.emit('PairDevice', {
                src: '160bd2',
                type: 4,
                raw: 'Z17000400160BD0123456001001A04E455130363731393838'
            });
        }, 300);

        setTimeout(function () {
            max.emit('ShutterContactStateRecieved', {
                src: '160bd2',
                isOpen: 0,
                rfError: 0,
                batteryLow: 1,
                rssi: 10
            });
        }, 1400);
    } else {
        adapter.log.warn('No serial port defined!');
    }
}

function main() {
    adapter.objects.getObjectView('system', 'channel', {startkey: adapter.namespace + '.', endkey: adapter.namespace + '.\u9999'}, function (err, res) {
        for (var i = 0, l = res.rows.length; i < l; i++) {
            objects[res.rows[i].id] = res.rows[i].value;
        }
        adapter.objects.getObjectView('system', 'state', {startkey: adapter.namespace + '.', endkey: adapter.namespace + '.\u9999'}, function (err, res) {
            for (var i = 0, l = res.rows.length; i < l; i++) {
                objects[res.rows[i].id] = res.rows[i].value;
                if (objects[res.rows[i].id].native && objects[res.rows[i].id].native.src) {
                    devices[objects[res.rows[i].id].native.src] = objects[res.rows[i].id];
                }
            }
            connect();
            adapter.subscribeStates('*');
        });
    });
}


