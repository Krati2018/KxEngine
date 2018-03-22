'use strict';

let request = require('request');
let bodyParser = require('body-parser');
const sessionManager = require('./sessionmanager');

function projectName(message) {
	console.log('INSIDE CONNECTOR:::projectName');
	let words = message.split('20');
	console.log('WORDS:', words);
	let projectIndex = words.lastIndexOf('project');
	console.log('INSIDE CONNECTOR:::Project Index', projectIndex);
	let previousWord = words[projectIndex - 1];
	let nextWord = words[projectIndex + 1];
	console.log('PREVIOUS WORD: ', previousWord);
	console.log('NEXT WORD: ', nextWord);
	let projName = '';
	if (previousWord.toLowerCase() != 'id' && previousWord.toLowerCase() != 'detail' && previousWord.toLowerCase() != 'details' && previousWord.toLowerCase() != 'of' && previousWord.toLowerCase() != 'for' && previousWord.toLowerCase() != 'the' && previousWord.toLowerCase() != 'accenture') {
		projName = previousWord;
	} else if (nextWord.toLowerCase() != 'id' && nextWord.toLowerCase() != 'detail' && nextWord.toLowerCase() != 'details' && nextWord.toLowerCase() != 'of' && nextWord.toLowerCase() != 'for' && nextWord.toLowerCase() != 'the' && nextWord.toLowerCase() != 'accenture') {
		projName = nextWord;
	} else {
		projName = 'undefined';
	}
	console.log('PROJECT NAME:', projName);
	return projName;
};

const saveOrUpdateProject = (senderId, projName, cb) => {
	let output = {};
	sessionManager.isSessionExists(senderId, projName, (err, data) => {
		if (err) {
			console.log('INSIDE CONNECTOR:::saveOrUpdateProject');
			console.log(err);
			return resolve(JSON.stringify({
				'text': err
			}));
		} else {
			console.log('INSIDE CONNECTOR:::saveOrUpdateProject:::isExists: ', data);
			if (data === 0) {
				console.log('INSIDE CONNECTOR:::saveOrUpdateProject:::isExists:::INSIDE 0');
				sessionManager.addSession(senderId, projName, (err, data) => {
					if (err) {
						console.log('CONNECTOR:::saveOrUpdateProject:::isExists:::addSession');
						console.log(err);
						return resolve(JSON.stringify({
							'text': err
						}));
					} else {
						console.log('INSIDE CONNECTOR:::saveOrUpdateProject:::addSession:::SESSION ADDED SUCCESSFULLY');
					}
				});
			} else {
				console.log('INSIDE CONNECTOR:::saveOrUpdateProject:::isExists:::INSIDE 1');
				sessionManager.updateSession(senderId, projName, (err, data) => {
					if (err) {
						console.log('CONNECTOR:::saveOrUpdateProject:::isExists:::updateSession');
						console.log(err);
						return resolve(JSON.stringify({
							'text': err
						}));
					} else {
						console.log('INSIDE CONNECTOR:::saveOrUpdateProject:::updateSession:::SESSION ADDED SUCCESSFULLY');
					}
				});
			}
		}
	});
};

const getProjectName = (senderId, cb) => {
	console.log('INSIDE CONNECTOR:::getProjectName');
	sessionManager.getProjectName(senderId, (err, data) => {
		if (err) {
			console.log('CONNECTOR:::getProjectName');
			console.log(err);
			return cb(JSON.stringify({
				'text': err
			}), null);
		} else {
			return cb(null, data);
		}
	});
};

const getAllProjectsWithName = (projName, cb) => {
	console.log('\nUTIL:::IASUTIL:::getAllProjectsWithName:::projectName:', projName);
	let serviceUrl = 'http://localhost:8005/project';
	//let username = 'Animesh.Agarwal';
	//let password = 'Snow@123';
	let payload = {'project':projName};
	let payloadJson = JSON.stringify(payload);

	request({
		url: serviceUrl,
		method: 'POST',
		/*auth: {
			'username': username,
			'password': password
		},*/
		headers: {
			'accept': 'application/json',
			'Content-Type': 'application/json'
		},
		body: payloadJson
	}, function(err, response, body) {
		if (err) {
			console.log('ERROR : ', err);
		} else {
			let json = JSON.parse(body);
			console.log('\nSUCCESS\n\nRESPONSE:', JSON.stringify(json));
			return cb(null, json);
		}
	});
};

module.exports = {
	getProjectName: getProjectName,
	projectName: projectName,
	getAllProjectsWithName: getAllProjectsWithName,
	saveOrUpdateProject: saveOrUpdateProject
};
