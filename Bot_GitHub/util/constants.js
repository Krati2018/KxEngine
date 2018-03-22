'use strict';

module.exports = {
    // Platforms
    FB: 'FB',
    CALLBACK: 'CALLBACK',
    SKYPE: 'SKYPE',
    CUSTOM: 'CUSTOM',
	
	MESSAGE0: 'Create the Batch Header. Enter the fields User Id, Batch Date, No of Documents, Amount Entered Batch Status as “A”.',
	MESSAGE1: 'Once the above update is done, navigate to the following path.',
	MESSAGE2: 'General Accounting  -> Integrity reports and update -> Run Batch to Detail & Out of Bal (Give the batch number and type in the data selection).',
	MESSAGE3: 'Batch will be in actual status after running the program. Post the batch.',
	MESSAGE4: 'If the issue is not resolved please write to electrolux@service-now.com',
	MESSAGE5WIN: 'Is there anything else I can help you with?<br> 1. <b>Yes</b><br> 2. <b>No</b>',
	MESSAGE5NONWIN: 'Is there anything else I can help you with? Type “Yes” or “No”.',

    // KxEngine URI
    //KX_ENGINE_URI: 'http://localhost:3002/kxprocess/',
	 KX_ENGINE_URI: 'https://sasoltestweb.azurewebsites.net/kxprocess/',
    //KX_ENGINE_URI: 'https://bbkxengine-dot-xaas-framework.appspot.com/kxprocess/',

    // Session Data table
    TABLE_NAME: 'SESSIONINFO',

    // KxEngine Response Separator
    STRING_SEPARATOR: '::',
    AI: 'AI',
    CALL_OTHER_SYSTEM: 'CALL',
    MESAGE_SEPARATOR: '#',
    RESPONSE_SEPARATOR: '##',
    JUMP_STATEMENT: 'JUMP',    

    // B4B specific constants
    ARRAY_START_SYMBOL: '[',
    ARRAY_END_SYMBOL: ']',
    COMMA: ',',
    OPEN_PARENTHESIS: '('
};