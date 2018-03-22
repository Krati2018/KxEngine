'use strict';

const app = require('express')();
const bodyParser = require('body-parser');
const botprocessorcore = require('./core/botprocessorcore');
const masterData = require('./configurations/master');
const sessionManager = require('./util/sessionmanager');

app.use(bodyParser.json({limit: '10mb'}));


// For Messenger Integration (Any Platform) - Send Message
app.post('/webhook/', (req, res) => {
    console.log('Request Received ->', JSON.stringify(req.body));
    const event = req.body.entry[0].messaging[0];
    console.log("EVENT:::"+JSON.stringify(event));
    const recipientId = event.recipient.id;
    const project = masterData.getProjectName(recipientId) || req.body.proj;

    if (event.close) {
        console.log('User closed the chat session, deleting session from DB', event.sender.id);
        sessionManager.removeContext(event.sender.id);
		sessionManager.removeSession(event.sender.id);
        return;
    }

    if (!project) {
        res.status(500).send({
            error: "Either recipient id or proj name is not correct"
        });
        return;
    }    

    const projectDetails = masterData.getProjectDetails(project);

    // Don't Send response back iff PLATFORM is 'NATIVE'
    if (projectDetails.platform !== 'NATIVE')
        res.status(200).send();

    botprocessorcore.processRequest(req);
});

// Basic 404 handler
app.use((req, res) => {
    res.status(404).send('Not Found');
});

process.on('uncaughtException', err => {
    console.error('Exception : ' + err.stack);
});

const server = app.listen(8080, () => {
    let host = server.address().address;
    let port = server.address().port;
    console.log("app listening at http://%s:%s", host, port)
});