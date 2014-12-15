var Q = require("q");
var fs = require('fs');

var dbFileName = "cache.json";

function loadFileCache() {
    var deferred = Q.defer(),
        db;

	console.log('Loading local database...');

    fs.readFile(dbFileName, function (err, data) {
		if (err) {
			saveFileCache({feeds:{}})
				.then(loadFileCache)
				.then(deferred.resolve);
		} else {
			console.log('Database Loaded');
		  
		  	try {
                db = JSON.parse(data);

                for (var key in db.feeds) {
                    db.feeds[key].lastPubDateSent = new Date(db.feeds[key].lastPubDateSent);
                }
			} catch(err2) {
				deferred.reject(err2);
			}
			//console.log(db);
			deferred.resolve(db);			
		}
	});

	return deferred.promise;
}

function saveFileCache(cache) {
	var deferred = Q.defer();

	//console.log('Saving local database...');
	//console.log(JSON.stringify(db));

	//This is a bottneck since it's sync
	fs.writeFile(dbFileName, JSON.stringify(cache), function() {
		console.log('Database saved');
		deferred.resolve();
	});

	return deferred.promise;
}

exports.loadCache = loadFileCache;
exports.saveCache = saveFileCache;