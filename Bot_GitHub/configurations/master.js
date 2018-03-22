'use strict';

const masterData = {
	'10080': 'SASOL'
};

const projectDetailsMap = {
	'SASOL': {
		'platform': 'CALLBACK',
		'client'  : 'SKYPE',
		'callbackUri': 'http://localhost:8083/api/AccentureChatbot',
		'externalSystemService': {
			'services': []
		}
	}
};

module.exports = {
	getProjectName: (id) => {
		return masterData[id];
	},
	getProjectDetails: (project) => {
		return projectDetailsMap[project];
	}
};