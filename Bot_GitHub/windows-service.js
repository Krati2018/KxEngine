'use strict';

const Service = require('node-windows').Service;

// Create a new service object
const svc = new Service({
  	name:'SASOL Bot Controller',
  	description: 'SASOL Bot Controller Service',

  	// Node Script Location - Application Entry point
  	script: './app.js'
});

// Listen for the "install" event, which indicates the
// process is available as a service.
svc.on('install',function() {
  	svc.start();
});

// Listen for the "start" event and let us know when the
// process has actually started working.
svc.on('start',function() {
  	console.log(svc.name + ' started!\n Visit http://127.0.0.1:5000 to see it in action.');
});

// Install the script as a service.
svc.install();