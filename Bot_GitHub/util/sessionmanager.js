'use strict';

const model = require('../dbconnection/model-cloudsql');
const constants = require('./constants');

/*
 This will contain all user sessions.
 Each session has an entry : sessionId -> {
 conversationId: conversationId, senderId: senderId, context: sessionStates, resp: response, project: project
 }
 */
var sessions = {};

module.exports = {
    findOrCreateSession: (conversationId, msgId, senderId, res, project) => {
        return new Promise(function (resolve, reject) {
            let sessionId = conversationId;
            let SQL = 'SELECT * FROM SESSIONINFO WHERE sessionId = ? AND isDeleted = ?';
            let data = [sessionId, false];
            console.log('SessionManager:::SQL:' + SQL);
            model.executeQueryStatement(SQL, data, function (err, entities) {
                if (err) {
                    console.log('SessionManager:::Session data not found:' + err || err.stack);
                    console.log('SessionManager:::New Session Id:' + sessionId);
                    let response = {};
                    sessions[sessionId] = {
                        conversationid: conversationId,
                        messageid: msgId,
                        senderid: senderId,
                        project: project,
                        context: {}
                    };
                } else {
                    if (entities.length > 0) {
                        let sessionInfo = entities[0];
                        let sessionvalue = sessionInfo.sessionvalue;
                        sessions[sessionId] = JSON.parse(sessionvalue);
                    }
                }
                console.log('SessionManager:::Session After Creation:', JSON.stringify(sessions));
                return resolve(sessionId);
            });
        });
    },
    getSession: (sessionId) => {
        return sessions[sessionId];
    },
    removeSession: (sessionId) => {
        delete sessions[sessionId];
    },
    popSession: (sessionId) => {
        let poppedSession = sessions[sessionId];
        delete sessions[sessionId];
        console.log('SessionManager:::Popped session with sessionId:' + sessionId);
        return poppedSession;
    },
    saveOrUpdateSession: (sessionId, sessionObj) => {
        return new Promise(function (resolve, reject) {
            console.log("SessionManager:::saveOrUpdateSession:::sessionId:" + sessionId + " sessionObj:" + JSON.stringify(sessionObj));

            //update the sessions object with the current value of sessionObj
            sessions[sessionId] = sessionObj;

            let SQL = 'SELECT * FROM SESSIONINFO WHERE sessionId = ? AND isDeleted = ?';
            let data = [sessionId, false];
            console.log('SessionManager:::saveOrUpdateSession:::SQL:' + SQL);

            model.executeQueryStatement(SQL, data, function (err, entities) {
                if (err) {
                    console.log('SessionManager:::saveOrUpdateSession:::Session data not found:' + (err || err.stack));
                    let body = {};
                    body.sessionId = sessionId;
                    body.sessionvalue = JSON.stringify(sessionObj);
                    model.create(constants.TABLE_NAME, body, function (err, sessiondata) {
                        if (err) {
                            console.log('SessionManager:::saveOrUpdateSession:::Error while session saving:' + (err || err.stack));
                            return reject(err);
                        } else {
                            return resolve(sessionId);
                        }
                    });
                } else {
                    if (entities.length > 0) {
                        let dbSession = entities[0];
                        dbSession.sessionId = sessionId;
                        dbSession.sessionvalue = JSON.stringify(sessionObj);
                        model.update(constants.TABLE_NAME, dbSession.id, dbSession, function (err, updatedSession) {
                            if (err) {
                                console.error('SessionManager:::saveOrUpdateSession:::Error while session update:' + (err || err.stack));
                                return reject(err);
                            } else {
                                return resolve(sessionId);
                            }
                        });
                    }
                }
            });
        });
    },
	
	isSessionExists: (senderId, cb) => {
		let sessionId = senderId;
		let SQL = 'SELECT sessionId FROM sessiondelete WHERE sessionId = ?';
		let data = [sessionId];
		let isExists;
		console.log('SessionManager:::isSessionExists:::SQL:' + SQL);
		model.executeQueryStatement(SQL, data, function (err, entities) {
			if (err) {
						isExists = 0;
						console.log('SESSION MANAGER:::ERR:::isSessionExists:::NO DATA FOUND: ', isExists);
			} else {
						if (entities.length > 0) {
									isExists = 1;
									console.log('SESSION MANAGER:::isSessionExists:::DATA: ', isExists);
						} else {
									isExists = 0;
									console.log('SESSION MANAGER:::isSessionExists:::DATA LENGTH ZERO: ', isExists);
						}
			}
			return cb(null, isExists);
		});
	},
	addSession: (senderId, cb) => {
		let sessionId = senderId;
		let SQL = 'INSERT INTO sessiondelete (sessionId) VALUES (?)';
		let data = [sessionId];
		let message;
		console.log('SessionManager:::addSession:::SQL:' + SQL);
		model.executeQueryStatement(SQL, data, function (err, entities) {
			if (err) {
						message = 'SESSION MANAGER:::ERR:::addSession:::UNABLE TO ADD SESSION';
			} else {
						message = 'SESSION MANAGER:::ERR:::addSession:::SESSION ADDED SUCCESSFULLY';
						console.log();
			}
			console.log(message);
			return cb(null, message);
		});
	},
	
	removeSession: (senderId, cb) => {
		let sessionId = senderId;
		let SQL = 'DELETE FROM sessiondelete WHERE sessionId = ?';
		let data = [sessionId];
		let message;
		console.log('SessionManager:::removeSession:::SQL:' + SQL);
		model.executeQueryStatement(SQL, data, function (err, entities) {
			if (err) {
				message = 'SESSION MANAGER:::ERR:::removeSession:::UNABLE TO REMOVE SESSION';
			} else {
				message = 'SESSION MANAGER:::ERR:::removeSession:::SESSION REMOVED SUCCESSFULLY';
				console.log();
			}
			console.log(message);
			return cb(null, message);
		});
	},
	
	getProjectName: (senderId, cb) => {
		let sessionId = senderId;
		let SQL = 'SELECT sessionId, projectName FROM iasproject WHERE sessionId = ?';
		let data = [sessionId];
		let projName;
		console.log('SessionManager:::isSessionExists:::SQL:' + SQL);
		model.executeQueryStatement(SQL, data, function (err, entities) {
			if (err) {
				console.log('SESSION MANAGER:::ERR:::isSessionExists:::NO DATA FOUND');
			} else {
				if (entities.length > 0) {
					console.log('SESSION MANAGER:::isSessionExists:::DATA:', JSON.stringify(entities));
					projName = entities[0].projectName;
				} else {
					console.log('SESSION MANAGER:::isSessionExists:::DATA LENGTH ZERO');
				}
			}
			return cb(null, projName);
		});
	},
	updateSession: (senderId, projectName, cb) => {
		let sessionId = senderId;
		let SQL = 'UPDATE iasproject SET projectName = ? WHERE sessionId = ?';
		let data = [projectName, sessionId];
		let message;
		console.log('SessionManager:::updateSession:::SQL:' + SQL);
		model.executeQueryStatement(SQL, data, function (err, entities) {
			if (err) {
				message = 'SESSION MANAGER:::ERR:::updateSession:::UNABLE TO UPDATE SESSION';
			} else {
				message = 'SESSION MANAGER:::ERR:::updateSession:::SESSION UPDATED SUCCESSFULLY';
				console.log();
			}
			console.log(message);
			return cb(null, message);
		});
	},
    // Added to remove session from DB when User closes the Chat Window
    removeContext: (senderId) => {
        console.log("SessionManager:::removeContext:::sessionId:", senderId);

        let SQL = 'SELECT * FROM SESSIONINFO WHERE sessionId = ? AND isDeleted = ?';
        let data = [senderId, false];
        console.log('SessionManager:::removeContext:::SQL:' + SQL);

        model.executeQueryStatement(SQL, data, function (err, entities) {
            if (err) {
                console.log('SessionManager:::removeContext:::Session data not found' + (err || err.stack));
            } else {
                if (entities.length > 0) {
                    let dbSession = entities[0];
                    model.softdelete(constants.TABLE_NAME, dbSession.id, function (err, updatedSession) {
                        if (err) {
                            console.error('SessionManager:::removeContext:::Error while session delete:' + (err || err.stack));
                        } else {
                            console.log('SessionManager:::removeContext:::User Session Deleted');
                            delete sessions[senderId];
                        }
                    });
                }
            }
        });
    }
};