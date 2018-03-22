'use strict';

const request = require('request');
const constants = require('./constants');
const path = require('path');

module.exports = {
    httpPostCall: (url, headers, body, cb) => {
        //Lets configure and request
        request({
            url: url,
            method: 'POST',
            headers: headers,
            body: JSON.stringify(body)
        }, function (error, response, body) {
            if (error) {
                console.error('Error occurred while connecting to Integration Hub : ' + error);
                return cb(error)
            } else {
                console.log('invokeService response : ' + response.statusCode + '\t BODY : ' + JSON.stringify(body));
                return cb(null, JSON.parse(body));
            }
        });
    },
    prepareRequestJSONForKXEngine: (conversationId, context, entities, entry, dataJSON, templateJSON, parsed, project) => {
        let requestJSONForKXEngine = {};
		if(entry[0].messaging[0].message && entry[0].messaging[0].message.text){
			let userText = entry[0].messaging[0].message.text;
			console.log('\nuser statement before removing extra spaces in between : '+userText);
			let parsedUserText = userText.replace(/\s\s+/g, ' ');
			console.log('\nuser statement after removing extra spaces in between : '+parsedUserText);
			entry[0].messaging[0].message.text = parsedUserText;
			console.log('\nentry[0].messaging[0].message.text is : '+entry[0].messaging[0].message.text);
			entry[0].messaging[0].message.text = encodeURI(entry[0].messaging[0].message.text);
		}
				
        requestJSONForKXEngine.conversationid = conversationId;
        requestJSONForKXEngine.context = context;
        requestJSONForKXEngine.proj = project;
        requestJSONForKXEngine.entities = entities;
        requestJSONForKXEngine.entry = entry;

        if (parsed) requestJSONForKXEngine.parsed = parsed;

        return requestJSONForKXEngine;
    },
    isNullOrEmpty: (value) => {
        return (value === null || value === '');
    },
    callKxEngine: (url, headers, requestJSONForKXEngine, cb) => {
        request({
            url: url,
            method: 'POST',
            json: true,
            body: requestJSONForKXEngine
        }, function (error, response, body) {
            if (error) {
                console.log('CommonUtils:::callKxEngine:::Error occurred while connecting to KX Engine : ' + (error || error.stack));
                return cb(error);
            } else {
                console.log('CommonUtils:::callKxEngine:::KX Engine response : ' + response.statusCode + '\t BODY : ' + JSON.stringify(body));
                return cb(null, body);
            }
        });
    },
    callBOTController: (requestBody) => {
        request({
            url: 'https://generic-botcontroller-dot-xaas-framework.appspot.com/webhook/',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        }, function (error, response, body) {
            if (error) {
                console.log('CommonUtils:::callKxEngine:::Error occurred while connecting to KX Engine : ' + (error || error.stack));
            } else {
                console.log('CommonUtils:::callKxEngine:::KX Engine response : ' + response.statusCode + '\t BODY : ' + JSON.stringify(body));
            }
        });
    },
    parseIntentAndEntities: (sessionId, msg, userSession, projectDetails) => {
        return new Promise(function (resolve, reject) {
            let intentParser = projectDetails.intentParser;
            if (intentParser && intentParser.toLowerCase() === constants.API_AI.toLowerCase()) {
                let apiai = require('apiai');
                console.log('CommonUtils:::parseIntentAndEntities:::apiaiToken:' + projectDetails.apiaiToken);
                let app = apiai(projectDetails.apiaiToken);
                console.log('CommonUtils:::parseIntentAndEntities:::parseIntentUsingApiAI:::API.AI Message:' + msg);

                let options = {
                    sessionId: sessionId
                };

                let request = app.textRequest(msg, options);

                request.on('response', function (response) {
                    console.log('CommonUtils:::parseIntentAndEntities:::parseIntentUsingApiAI:::' + JSON.stringify(response));
                    var resp = response.result.fulfillment.speech.trim();
                    console.log('CommonUtils:::parseIntentAndEntities:::parseIntentUsingApiAI:::Response Message:' + resp);
                    let parsedIntentAndEntitiesObj = {};
                    parsedIntentAndEntitiesObj.intent = response.result.metadata.intentName;
                    parsedIntentAndEntitiesObj.entities = response.result.parameters;
                    return resolve(parsedIntentAndEntitiesObj);
                });

                request.on('error', function (error) {
                    console.log(error);
                    return reject(error);
                });

                request.end();
            }
            if (intentParser && intentParser.toLowerCase() === constants.WIT_AI.toLowerCase()) {
                let witUri = projectDetails.witUri + '?v=20160526&q=' + msg;
                let headers = 'Authorization: Bearer ' + projectDetails.witToken;
                console.log("CommonUtils:::parseIntentAndEntities:::parseIntentUsingWitAI:witUri:" + witUri);
                console.log("CommonUtils:::parseIntentAndEntities:::parseIntentUsingWitAI:witToken:" + projectDetails.witToken);
                request({
                    url: witUri,
                    method: "GET",
                    json: true,
                    headers: {
                        "Authorization": "Bearer " + projectDetails.witToken
                    }
                }, function (error, response, body) {
                    if (error) {
                        console.log('CommonUtils:::parseIntentAndEntities:::parseIntentUsingWitAI:::Error occurred while connecting to Wit.AI:' + (error || error.stack));
                        return reject(error);
                    } else {
                        console.log('CommonUtils:::parseIntentAndEntities:::parseIntentUsingWitAI:::Wit.AI response:' + response.statusCode + '\t BODY:' + JSON.stringify(body));
                        let witEntitiesObj = body.entities;
                        let entities = {};
                        for (let prop in witEntitiesObj) {
                            let valueArray = witEntitiesObj[prop];
                            if (prop !== 'intent') {
                                if (prop !== 'datetime' && valueArray[0].confidence > 0.5) {
                                    entities[prop] = valueArray[0].value;
                                }
                                if (prop === 'datetime') {
                                    entities['fromDate'] = valueArray[0].value.from;
                                    entities['toDate'] = valueArray[1].value.from;
                                }
                            }
                        }
                        let parsedIntentAndEntitiesObj = {};
                        parsedIntentAndEntitiesObj.entities = entities;
                        return resolve(parsedIntentAndEntitiesObj);
                    }
                });
            }
        });
    },
    parseResponseFromKxEngine: (textvalue, separator) => {
        return textvalue.split(separator);
    },
    callExternalSystemRestService: (services, stringSplitArray, requestBody, userSession, parametersArray, methodName) => {
        console.log('CommonUtils:::callExternalSystemRestService:::methodName:' + JSON.stringify(methodName));
        return new Promise(function (resolve, reject) {
            const connector = require(path.join(__dirname, '..', 'connectors', stringSplitArray[1].toLowerCase()));
			connector.executeService(
                methodName, requestBody, userSession, parametersArray
            ).then(param => {
                return resolve(param);
            }).catch(err => {
                return reject(err);
            });
        });
    },
    parseServiceParameters: (serviceMethodWithParams) => {
        // serviceMethodWithParams will contain method name and parameters
        // e.g. "getCaseStatus([client, priority])" will return method parameters as an array [client, priority]
        console.log('CommonUtils:::parseServiceParameters:::serviceMethodWithParams:' + serviceMethodWithParams);
        var startIndex = serviceMethodWithParams.indexOf(constants.ARRAY_START_SYMBOL);
        var endIndex = serviceMethodWithParams.indexOf(constants.ARRAY_END_SYMBOL);
        var parametersArray = [];
        console.log('CommonUtils:::parseServiceParameters:::startIndex:' + startIndex + ' endIndex:' + endIndex);
        if (startIndex !== -1 && endIndex !== -1) {
            var parameters = serviceMethodWithParams.substring(startIndex + 1, endIndex);
            console.log('CommonUtils:::parseServiceParameters:::parameters:' + parameters);
            parametersArray = parameters.split(constants.COMMA);
        }
        console.log('CommonUtils:::parseServiceParameters:::parametersArray:' + JSON.stringify(parametersArray));
        return parametersArray;
    },
    parseServiceMethodName: (serviceMethodWithParams) => {
        // serviceMethodWithParams will contain method name and parameters 
        // e.g. "getCaseStatus([client, priority])" will return method name as "getCaseStatus"
        console.log('CommonUtils:::parseServiceMethodName:::serviceMethodWithParams:' + serviceMethodWithParams);
        var index = serviceMethodWithParams.indexOf(constants.OPEN_PARENTHESIS);
        var methodName = serviceMethodWithParams;
        if (index !== -1) {
            methodName = serviceMethodWithParams.substring(0, index);
        }
        console.log('CommonUtils:::parseServiceMethodName:::methodName:' + methodName);
        return methodName;
    }
};