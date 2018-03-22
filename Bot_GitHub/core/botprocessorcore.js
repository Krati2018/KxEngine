'use strict';

const commonUtil = require('../util/commonutils');
const constants = require('../util/constants');
const sessionManager = require('../util/sessionmanager');
const masterData = require('../configurations/master');
const responseUtil = require('../util/responseutil');

module.exports = {
    processRequest: (req, res) => {
        const event = req.body.entry[0].messaging[0];
        const msgId = req.body.entry[0].id || null;
        const conversationId = req.body.conversationid || event.sender.id;
        let senderId = event.sender.id;
        const recipientId = event.recipient.id;
        const project = masterData.getProjectName(recipientId) ||  req.body.proj;        
        const projectDetails = masterData.getProjectDetails(project);
        if (event.message) {
			try {
				event.message.text = decodeURI(event.message.text);
			} catch(e) {
				event.message.text = event.message.text;
			}
		}
        let msg = (event.message) ? event.message.text : (event.postback) ? event.postback.payload : null;
        console.log("BotProcessorCore:::msg:" + JSON.stringify(msg));
        let messagePartsArray = [];
        let messagePayloadValuePart = null;
        let userSession = null;
        let context = null;
        let lat = null;
        let lng = null;
        let imageUri = null;
        if (msg) {
            messagePartsArray = msg.split(constants.MESAGE_SEPARATOR);
            msg = messagePartsArray[0];
            if (messagePartsArray.length > 1) messagePayloadValuePart = messagePartsArray[1];
            console.log("BotProcessorCore:::messagePayloadValuePart:" + messagePayloadValuePart);
            if (event.message) {
                event.message.text = msg;
                console.log("BotProcessorCore:::event.message.text:" + msg);
            } else if (event.postback) {
                event.postback.payload = msg;
                console.log("BotProcessorCore:::event.postback.payload:" + msg);
            }
        }

        // msg is NULL, then it means neither text nor postback information is coming from client
        // in this case, client is sharing his/her current geo-location or uploading an image
        if (!msg) {
            if (event.message.attachments && event.message.attachments[0].type === 'location') {
                lat = event.message.attachments[0].payload.coordinates.lat;
                lng = event.message.attachments[0].payload.coordinates.long;
                msg = lat + ':' + lng;
                event.message.text = msg;
                console.log("BotProcessorCore:::event.message.text:" + msg);
            }
            if (event.message.attachments && event.message.attachments[0].type === 'image') {
                imageUri = event.message.attachments[0].payload.url;
                msg = imageUri;
                event.message.text = msg;
                console.log("BotProcessorCore:::event.message.text:" + msg);
            }
        }

        let sessionId;

        if (projectDetails.platform === constants.FB) {
            // If platform is Facebook, then retrieve username using facebook graph api
            commonUtil.getFBUserName(senderId, projectDetails.FacebookGraphUri, projectDetails.FacebookPageToken, (userName) => {
                event.user = {"name": userName};
                executeFindOrCreateSession();
            });
        } else if (projectDetails.platform === constants.CALLBACK) {
            if (projectDetails.client === constants.SKYPE) {
                senderId = senderId.split("sip:")[1];
                if (!event.user || !event.user.name) {
                    let sname = senderId.split(".")[0];
					
					let username=sname.charAt(0).toUpperCase()+sname.slice(1);	
                    event.user = {"name": username};
                }
            }
            executeFindOrCreateSession();
        }

        function executeFindOrCreateSession() {
            console.log("BotProcessorCore:::executeFindOrCreateSession:::senderId:" + senderId);
            sessionManager.findOrCreateSession(conversationId, msgId, senderId, res, project)
                .then((sessionIdParam) => {
                    sessionId = sessionIdParam;
                    console.log("BotProcessorCore:::executeFindOrCreateSession:::sessionId:" + sessionId);
                    processNextActions();
                })
                .catch((err) => {
                    console.log('BotProcessorCore:::Got an error during session creation:' + err.stack || err);
                });
        }

        function processNextActions() {
            userSession = sessionManager.getSession(sessionId);
            if (messagePayloadValuePart) userSession.messagePayloadValuePart = messagePayloadValuePart;
            else delete userSession.messagePayloadValuePart;
            if (lat && lng) {
                userSession.latitude = lat;
                userSession.longitude = lng;
            } else {
                delete userSession.latitude;
                delete userSession.longitude;
            }
            if (imageUri) userSession.imageUri = imageUri;
            else delete userSession.imageUri;

            context = userSession.context;
            console.log("BotProcessorCore:::processNextActions:::userSession:" + JSON.stringify(userSession));
            let entities = {"intent": {"value": project}};
            let dataJSON = null;
            let templateJSON = null;
            if (projectDetails.dataConfig) dataJSON = require('../configurations/' + projectDetails.dataConfig);
            if (projectDetails.template) templateJSON = require('../configurations/' + projectDetails.template);
            let parsed = null;
            let requestJSONForKXEngine = commonUtil.prepareRequestJSONForKXEngine(conversationId, context, entities, req.body.entry, dataJSON, templateJSON, parsed, project);
            console.log("\nBotProcessorCore:::requestJSONForKXEngine without intent parsing:" + JSON.stringify(requestJSONForKXEngine));

            // REST call to KXEngine without intent parsing
            let kxEngineUri = constants.KX_ENGINE_URI;
            commonUtil.callKxEngine(kxEngineUri, {'Content-Type': 'application/json'}, requestJSONForKXEngine, (error, response) => {
                if (error) {
                    console.log('BotProcessorCore:::Error while calling KXEngine Service', error || error.stack);
                } else {
                    if (!commonUtil.isNullOrEmpty(response)) {
                        processResponse(response);
                    } else {
                        console.log("BotProcessorCore:::No response is coming from KXEngine for mesage:" + msg);
                    }

                    function processResponse(response) {
                        console.log("BotProcessorCore:::KXEngine response message object:" + JSON.stringify(response.message));
                        let kxEngineResponseValue = (response.message) ? (response.message.text || response.message.attachment || response.message.custom) : null;
                        userSession.context = response.context;
                        sessionManager.saveOrUpdateSession(sessionId, userSession)
                            .then((sessionIdParam) => {
                                console.log('BotProcessorCore:::processResponse:::session object saved successfully');
                                if (!kxEngineResponseValue || commonUtil.isNullOrEmpty(kxEngineResponseValue)) {
                                    // The response from KXEngine is NULL or EMPTY; so no response need to be sent to the client; only save the updated context object into the DB
                                } else {
                                    if (response.message.text && !response.message.attachment) {
                                        let stringSplitArray = commonUtil.parseResponseFromKxEngine(kxEngineResponseValue, constants.STRING_SEPARATOR);
                                        if (stringSplitArray.length > 1) {
                                            //Here the message format is either CALL::AI or CALL::<<externalSystemName>>::<<externalAPIName>>
                                            // Before calling the AI intent parser or external REST Uri, store the updated context object coming from KXEngine into a local variable
                                            context = response.context;
                                            if (stringSplitArray[0] && stringSplitArray[0].toLowerCase() === constants.CALL_OTHER_SYSTEM.toLowerCase()) {
                                                if (stringSplitArray[1] && stringSplitArray[1].toLowerCase() === constants.AI.toLowerCase()) {

                                                    // the response from KXEngine is CALL::AI
                                                    executeIntentParsing();
                                                } else {
                                                    // Call external system REST Service
                                                    let externalSystemService = projectDetails.externalSystemService;
                                                    let services = externalSystemService.services;
													let methodName = commonUtil.parseServiceMethodName(stringSplitArray[2]);

                                                    // parameters will be returned as arrays if any exists
													let parametersArray = commonUtil.parseServiceParameters(stringSplitArray[2]); 
            
													commonUtil.callExternalSystemRestService(services, stringSplitArray, req.body, userSession, parametersArray, methodName)
                                                        .then((returnVal) => {
                                                            console.log("BotProcessorCore:::RETURNVAL:::" + JSON.stringify(returnVal));
                                                            //Added to support No Response scenario
                                                            if (!returnVal) {
                                                                console.log("BotProcessorCore:::processResponse:::Typeof value is null:::Blank Object");
                                                                response.isBlank = true;
                                                                processResponseFromKXEngine(response);
                                                            }
                                                            else if (typeof returnVal === 'object') {
                                                                console.log("BotProcessorCore:::processResponse:::Typeof value is object");
																if (projectDetails.platform === constants.CALLBACK && projectDetails.client === constants.CUSTOM) {
																	response.message.text = JSON.stringify(returnVal);
																	delete response.message.attachment;
																} else {
																	response.message.attachment = returnVal;
																	delete response.message.text;
																}
                                                                processResponseFromKXEngine(response);
                                                            }
                                                            else {
                                                                console.log("BotProcessorCore:::processResponse:::Typeof value is not object");
                                                                response.message.text = returnVal;
                                                                processResponseFromKXEngine(response);
                                                            }
                                                        })
                                                        .catch((err) => {
                                                            console.log('BotProcessorCore:::processResponse:::Got an error during external system call:' + err.stack || err);
                                                        });
                                                }
                                            } else {
                                                console.log('BotProcessorCore:::processResponse:::Unable to recognize response message from KXEngine...');
                                            }
                                        } else {
                                            // Here simple string message is returned from KXEngine
                                            if (projectDetails.platform === constants.CALLBACK && projectDetails.client === constants.CUSTOM) {
                                                response.message.text = JSON.stringify(response.message);
                                            }
                                            processResponseFromKXEngine(response);
                                        }
                                    } else if (response.message.attachment) {
                                        // Here template message is returned from KXEngine; so no need to call intent parser like wit.ai or api.ai and send it back to client
                                        if (projectDetails.platform === constants.CALLBACK && projectDetails.client === constants.CUSTOM) {
                                            let msgAttachmentInTextFormat = response.message;
                                            response.message.text = JSON.stringify(msgAttachmentInTextFormat);
                                            delete response.message.attachment;
                                        }
                                        processResponseFromKXEngine(response);
                                    } else if (response.message.custom) {
                                        // Here custom message such as combination of texts and attachments is returned by KXEngine
                                        // So no need to call intent parser like wit.ai or api.ai and send it back to client
                                        delete response.message.custom;
                                        processCustomMessage(response, kxEngineResponseValue, 0);
                                    }
                                }
                            })
                            .catch((err) => {
                                console.log('BotProcessorCore:::processResponse:::Got an error during session saving:' + err.stack || err);
                            });
                    }

                    function processCustomMessage(response, kxEngineResponseValueArray, index) {
                        if (index > (kxEngineResponseValueArray.length - 1)) {
                            return;
                        }
                        console.log("BotProcessorCore:::processCustomMessage:::index:" + index);
                        let responsePartObj = kxEngineResponseValueArray[index];
                        console.log("BotProcessorCore:::processCustomMessage:::responsePartObj:" + JSON.stringify(responsePartObj));
                        if (responsePartObj.text && !responsePartObj.attachment) {
                            let stringSplitArray = commonUtil.parseResponseFromKxEngine(responsePartObj.text, constants.STRING_SEPARATOR);
                            if (stringSplitArray.length > 1) {

                                //Here the message format is CALL::<<externalSystemName>>::<<externalAPIName>>
                                // Before calling the external system api hooks, store the updated context object coming from KXEngine into a local variable
                                context = response.context;
                                if (stringSplitArray[0] && stringSplitArray[0].toLowerCase() === constants.CALL_OTHER_SYSTEM.toLowerCase()) {

                                    // Call external system service API
                                    let externalSystemService = projectDetails.externalSystemService;
                                    let services = externalSystemService.services;
									let methodName = commonUtil.parseServiceMethodName(stringSplitArray[2]);
									let parametersArray = commonUtil.parseServiceParameters(stringSplitArray[2]); // parameters will be returned as arrays if any exists
                                    //commonUtil.callExternalSystemRestService(services, stringSplitArray, req.body, userSession)
									commonUtil.callExternalSystemRestService(services, stringSplitArray, req.body, userSession, parametersArray, methodName)
                                        .then((returnVal) => {
                                            //Added to support No Response scenario
                                            if (!returnVal) {
                                                console.log("BotProcessorCore:::processCustomMessage:::Typeof value is null:::Blank Object");
                                                response.isBlank = true;
                                            }
                                            else if (typeof returnVal === 'object') {
                                                console.log("BotProcessorCore:::processCustomMessage:::Typeof value is object");
												if (projectDetails.platform === constants.CALLBACK && projectDetails.client === constants.CUSTOM) {
													response.message.text = JSON.stringify(returnVal);
													delete response.message.attachment;
												} else {
													response.message.attachment = returnVal;
													delete response.message.text;
												}
                                            }
                                            else {
                                                console.log("BotProcessorCore:::processCustomMessage:::Typeof value is not object");
                                                response.message.text = returnVal;
                                                delete response.message.attachment;
                                            }
                                            processResponseFromKXEngine(response, function () {
                                                index += 1;
                                                processCustomMessage(response, kxEngineResponseValueArray, index);
                                            });
                                        })
                                        .catch((err) => {
                                            console.log('BotProcessorCore:::processCustomMessage:::Got an error during external system call:' + err.stack || err);
                                        });
                                } else {
                                    console.log('BotProcessorCore:::processCustomMessage:::Unable to recognize response message from KXEngine...');
                                }
                            } else {
                                // Here responsePartObj is simple string message; so send it back to client
                                if (projectDetails.platform === constants.CALLBACK && projectDetails.client === constants.CUSTOM) {
                                    response.message.text = JSON.stringify(responsePartObj);
                                } else {
									response.message.text = responsePartObj.text;
								}
                                delete response.message.attachment;
                                processResponseFromKXEngine(response, function () {
                                    index += 1;
                                    processCustomMessage(response, kxEngineResponseValueArray, index);
                                });
                            }
                        } else if (responsePartObj.attachment) {
                            console.log("BotProcessorCore:::processCustomMessage:::attachment found in message");
                            if (projectDetails.platform === constants.CALLBACK && projectDetails.client === constants.CUSTOM) {
                                response.message.text = JSON.stringify(responsePartObj);
                                delete response.message.attachment;
                            } else {
                                response.message = responsePartObj;
                                delete response.message.text;
                            }
                            processResponseFromKXEngine(response, function () {
                                index += 1;
                                processCustomMessage(response, kxEngineResponseValueArray, index);
                            });
                        }
                    }

                    function executeIntentParsing() {
                        // the response from KXEngine is empty i.e. need to call some intent parser with the user query
                        commonUtil.parseIntentAndEntities(sessionId, msg, userSession, projectDetails)
                            .then((parsedIntentAndEntitiesObj) => {
                                parsed = projectDetails.intentParser;
                                parsedIntentAndEntitiesObj.intent = project; // intent name is the default project name
                                entities = {"intent": {"value": parsedIntentAndEntitiesObj.intent}};
                                let parsedEntities = parsedIntentAndEntitiesObj.entities;
                                for (let prop in parsedEntities) {
                                    entities[prop] = {"value": parsedEntities[prop]};
                                }
                                console.log("BotProcessorCore:::executeIntentParsing:::Entities after intent parsing:" + JSON.stringify(entities));
                                requestJSONForKXEngine = commonUtil.prepareRequestJSONForKXEngine(conversationId, context, entities, req.body.entry, dataJSON, templateJSON, parsed, project);
                                console.log("BotProcessorCore:::executeIntentParsing:::requestJSONForKXEngine after intent parsing:" + JSON.stringify(requestJSONForKXEngine));
                                
                                //Now call KXEngine once again to get the response for client
                                commonUtil.callKxEngine(kxEngineUri, {'Content-Type': 'application/json'}, requestJSONForKXEngine, (error, response) => {
                                    if (error) {
                                        console.log('BotProcessorCore:::Error while calling KXEngine Service after intent parsing', error || error.stack);
                                    } else {
                                        if (!commonUtil.isNullOrEmpty(response)) {
                                            processResponse(response);
                                        } else {
                                            console.log("BotProcessorCore:::executeIntentParsing:::Response is coming as NULL or BLANK from KXEngine after intent parsing...");
                                        }
                                    }
                                });
                            })
                            .catch((err) => {
                                console.log('BotProcessorCore:::executeIntentParsing:::Got an error during intent parsing:' + err.stack || err);
                            });
                    }

                    function processResponseFromKXEngine(response, callback) {
                        // send response back to messaging server
                        let kxEngineResponse = null;
                        if (response.message.text) {
                            kxEngineResponse = response.message.text;
                        } else if (response.message.attachment) {
                            kxEngineResponse = response.message;
                        } 

                        console.log('BotProcessorCore:::processResponseFromKXEngine:::Response from KXEngine:' + JSON.stringify(kxEngineResponse));

                        if (response.isBlank) { 
                            delete response.isBlank;
                            if (callback) return callback();
                            return;
                        } else {
                            responseUtil.send(userSession, kxEngineResponse, projectDetails).then((responseBody) => {
                                console.log('BotProcessorCore:::processResponseFromKXEngine:::Successfully sent message to client...');
                                if (callback) {
                                    callback();
                                }
                            })
                            .catch((err) => {
                                console.log('BotProcessorCore:::processResponseFromKXEngine:::Got an error during message sending to client:' + err.stack || err);
                            });
                        }
                    }
                }
            });
        }
    }
};