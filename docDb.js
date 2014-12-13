/* A work in progress... */

/*
var DocumentClient = require('documentdb').DocumentClient;





var settings = {
    host: [hostendpoint],
    masterKey: [database account masterkey],
},
client = new DocumentClient(host, {masterKey: masterKey});

function initializeDatabase(callback) {
    var collectionDefinition = { id: "sample collection" };
    var documentDefinition = { id: "hello world doc", content: "Hello World!" };

    client.createDatabase({ id: "KindleRssDatabase" }, function(err, database) {
        if(err) return console.log(err);
        console.log('created db');

        client.createCollection(database._self, collectionDefinition, function(err, collection) {
            if(err) return console.log(err);

            console.log('created collection');

            client.createDocument(collection._self, documentDefinition, function(err, document) {
                if(err) return console.log(err);

                console.log('Created Document with content: ', document.content);
            });
        });
    });
}
 * */