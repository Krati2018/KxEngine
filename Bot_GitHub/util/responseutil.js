'use strict';

const constants = require('./constants');
const request = require('request');

const prepareCallbackRequestObj = (projectDetails, userSession, msg) => {
    if (projectDetails.client === constants.SKYPE) {
        return {
            'ContactUri': userSession.conversationid,
            'IMText': msg
        }
    }
    if (projectDetails.client === constants.CUSTOM) {
        console.log("inside send responseutil:::"+msg + "user seesion :"+JSON.stringify(userSession,null,2))
        return {
            'conversationid': userSession.conversationid,
            'messageid': userSession.messageid,
            'botid': userSession.senderid,
            'message': msg,
            'proj': userSession.project
        }
    }
};

module.exports = {
    send: (userSession, message, projectDetails) => {
        let platform = projectDetails.platform;
        if (platform === constants.CALLBACK) {
            return new Promise(function (resolve, reject) {
                let callbackRequestObj = prepareCallbackRequestObj(projectDetails, userSession, message);
                console.log('ResponseUtil:::send:::Platform CALLBACK:::Client ' + projectDetails.client + ':::callbackRequestObj:' + JSON.stringify(callbackRequestObj));
                request({
                    url: projectDetails.callbackUri,
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(callbackRequestObj)
                }, function (error, response, body) {
                    if (error) {
                        console.log('ResponseUtil:::Error occurred while connecting to CallbackURL:' + error || error.stack);
                        return reject(error);
                    } else {
                        console.log('ResponseUtil:::CallBack API response:' + response.statusCode + '\t BODY : ' + JSON.stringify(body));
                        return resolve(body);
                    }
                });
            });
        }
        else if (platform === constants.FB) {
            return new Promise(function (resolve, reject) {
                let messageData = '';
                let isTemplate = (message.attachment) ? true : false;
                if (!isTemplate) {
                    messageData = {
                        text: message
                    };
                }
                else {
                    messageData = message;
                }
                request({
                    url: projectDetails.FacebookMessagesUri,
                    qs: {
                        access_token: projectDetails.FacebookPageToken
                    },
                    method: 'POST',
                    json: {
                        recipient: {
                            id: userSession.senderid
                        },
                        message: messageData
                    }
                }, function (error, response) {
                    if (error) {
                        console.log('ResponseUtil:::Error sending message using Facebook message api:', error || error.stack);
                        return reject(error);
                    } else if (response.body.error) {
                        console.log('ResponseUtil:::Error sending message using Facebook api:::response.body.error:', response.body.error);
                        return reject(response.body.error);
                    } else {
                        return resolve(response);
                    }
                });
            });
        }
    }
};