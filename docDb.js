var Q = require("q"),
    DocumentClient = require('documentdb').DocumentClientWrapper,
    client,
    cacheCollection;

function initialize(options) {
    var deferred = Q.defer();

    //options.hostName
    //options.masterKey

    var databaseDefinition,
        collectionDefinition,
        database;

    client = new DocumentClient(options.hostName, {masterKey: options.masterKey});

    databaseDefinition = { id: "KindleRssDatabase" }
    collectionDefinition = { id: "cache" };

    initDatabase(databaseDefinition)
        .then(function (dbRef) {
            database = dbRef;
            return initCollection(database, collectionDefinition);
        })
        .then(function(collRef) {
            cacheCollection = collRef;
            deferred.resolve();
        })
        .fail(function(error) {
            console.log('Error occurred during DocumentDB initialization: ' + error.body);
            deferred.reject(error);
        });

    return deferred.promise;
}

function initDatabase(databaseDefinition) {
    var deferred = Q.defer();

    client.queryDatabases('SELECT * FROM root r WHERE r.id="' + databaseDefinition.id + '"').toArrayAsync()
        .then(function (results) {
            if (results.feed.length === 0) {
                client.createDatabaseAsync(databaseDefinition)
                    .then(function(database) {
                            deferred.resolve(database.resource);
                    });
            } else {
                deferred.resolve(results.feed[0]);
            }
        });

    return deferred.promise;
}

function initCollection(database, collectionDefinition) {
    var deferred = Q.defer();
    
    client.queryCollections(database._self, 'SELECT * FROM root r WHERE r.id="' + collectionDefinition.id + '"').toArrayAsync()
        .then(function (results) {
        if (results.feed.length === 0) {
            client.createCollectionAsync(collectionDefinition)
                    .then(function (collection) {
                        deferred.resolve(collection.resource);
                    });
        } else {
            deferred.resolve(results.feed[0]);
        }
    });
    
    return deferred.promise;
}

function loadCache() {
    var deferred = Q.defer();

    console.log('Loading DocDB database...');

    client.queryDocuments(cacheCollection._self, 'select * from root').toArrayAsync()
        .then(function (results) {
        if (results.feed.length === 0) {
            deferred.resolve({ feeds: {} });
        } else {
            var cache = results.feed[0];
            for (var key in cache.feeds) {
                cache.feeds[key].lastPubDateSent = new Date(cache.feeds[key].lastPubDateSent);
            }
            deferred.resolve(cache);
        }
    });


return deferred.promise;
}

function saveCache(cache) {
    var deferred = Q.defer();
    
    if (cache.id) {
        client.replaceDocumentAsync(cache._self, cache)
        .then(function () {
                console.log('Saved cache to DocDB');
                deferred.resolve();
            })
        .fail(function (error) {
            console.log('Error updating document cache: ' + error.body);
            deferred.reject(error);
        });
    } else {
        cache.id = '1';

        client.createDocumentAsync(cacheCollection._self, cache)
        .then(function () {
            console.log('Saved cache to DocDB');
            deferred.resolve();
        })
        .fail(function (error) {
            console.log('Error saving document cache: ' + error.body);
            deferred.reject(error);
        });
    }

    return deferred.promise;
}

exports.initialize = initialize;
exports.loadCache = loadCache;
exports.saveCache = saveCache;