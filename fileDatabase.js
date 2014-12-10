var Q = require("q");
var fs = require('fs');

var dbFileName = "cache.json";

function loadFileCache() {
	var deferred = Q.defer();

	console.log('Loading local database...');

	fs.readFile(dbFileName, function (err, data) {
		if (err) {
			saveFileCache({feeds:{}})
				.then(loadFileCache)
				.then(deferred.resolve);
		} else {
			console.log('Database Loaded');
		  
			var db = JSON.parse(data);
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

exports.loadFileCache = loadFileCache;
exports.saveFileCache = saveFileCache;