var Q = require("q");
var fs = require('fs');
var request = require('request');
var exec = require('child_process').exec;
var FeedParser = require('feedparser');

var articleExporter = require('./articleExporter.js');
var fileDatabase = require('./fileDatabase.js');

run();

function run() {
	var config;
	var cache;

	fileDatabase.loadFileCache()
		.then(function(loadedCache) {
			cache = loadedCache;

			console.log('Cache:');
			console.log(JSON.stringify(cache));
		})
		.then(loadConfig)
		.then(function(loadedConfig) {
			config = loadedConfig;
		})
		.then(articleExporter.initialize)
		.then(function() {
			return processAllFeeds(
				{
					feeds: config.Feeds,
					cache: cache,
					send: function(feedItem, file, cb) {
						emailRssItem({feedItem: feedItem, config: config, file: file}, cb);
					}
				});
		})
		.then(function() {
			return fileDatabase.saveFileCache(cache);
		})
		.catch(function(error) {
			console.error(error);
		})
		.done();
}


function loadConfig() {
	var deferral = Q.defer();

	console.log('Loading configuration...');
	fs.readFile('config.json', function (err, data) {
	  if (err) deferral.reject(err);
	  console.log('Config Loaded: ');
	  
	  var config = JSON.parse(data);
	  console.log(config);
	  deferral.resolve(config);
	});

	return deferral.promise;
}


function processAllFeeds(options) {
	//options.feeds
	//options.cache
	//options.send

	var feedUrl;
	var feedDb;
	var feedPromises = [];
	var feeds = options.feeds;
	var cache = options.cache;

	console.log('Processing ' + feeds.length + ' feeds...');

	for(var i = 0; i < feeds.length; i++) {
		feedUrl = options.feeds[i];

		//Initialize our cache for the feed if needed
		if(!cache.feeds[feedUrl]) {
			cache.feeds[feedUrl] = {};
		}

		feedPromises[i] = processFeed(
			{
				feedUrl: feedUrl,
				feedCache: cache.feeds[feedUrl], //passed by ref
				send: options.send
			});
	}

	return Q.allSettled(feedPromises);
}

function processFeed(options) {
	// options.feedUrl
	// options.feedCache
	// options.send

	var deferral = Q.defer();

	var newestItem;
	var req = request(options.feedUrl),
		feedparser = new FeedParser({});

	req.on('error', function (error) {
		deferral.reject(error);
	});
	req.on('response', function (res) {
	  var stream = this;

	  if (res.statusCode != 200) return this.emit('error', new Error('Bad status code'));

	  stream.pipe(feedparser);

	  stream.on('end', function() {
	  	console.log('Done processing ' + options.feedUrl);

	  	//Note: this will send the latest of each feed the first time

	  	if(newestItem) {
		  	options.feedCache.newestItem = newestItem.pubDate;
		  	if(!options.feedCache.lastPubDateSent || options.feedCache.lastPubDateSent < options.feedCache.newestItem) {
		  		console.log('Exporting article "' + newestItem.title + '"...')

		  		articleExporter.exportArticle(newestItem.title, newestItem.body)
		  			.then(function(fileName) {
		  				console.log('Sending article...');
		  				options.send(newestItem, fileName, function() {
		  					//item sent!
		  					options.feedCache.lastPubDateSent = options.feedCache.newestItem;
		  					console.log('Sent successfully');
		  					deferral.resolve();
		  				});
		  			});
		  	} else {
		  		deferral.resolve();
		  	}
		  } else {
		  	console.log('No items in the feed');
		  	deferral.resolve();
		  }
	  });
	});

	feedparser.on('error', function(error) {
	  deferral.reject(error);
	});
	feedparser.on('readable', function() {
	  // This is where the action is!
	  var stream = this
	    , meta = this.meta // **NOTE** the "meta" is always available in the context of the feedparser instance
	    , item;

	  while (item = stream.read()) {
	    //Check if this is the newest (or first) item
	    if(!newestItem || item.pubDate > newestItem.pubDate) {
			newestItem = item;
		}
	  }  
	});

	return deferral.promise;
}

function emailRssItem(options, cb) {
	var feedItem = options.feedItem;
	var file = options.file;
	var config = options.config;

	var sendgrid  = require('sendgrid')(config.SendGridApiUser, config.SendGridApiKey);

	var cleanTitle = feedItem.title
		.replace("<", "")
		.replace(">", "")
		.replace(":", "")
		.replace('"', "")
		.replace("/", "")
		.replace("\\", "")
		.replace("|", "")
		.replace("?", "")
		.replace("*", "");


	var email = new sendgrid.Email({
		to:  [config.kindleEmail],
		from: config.SendGridFromEmail,
		subject: 'convert', //Tells the kindle to conver it to it's internal format
		text: 'Your article via RSS as requested.'
	});

	email.addFile({
		filename: cleanTitle + '.docx',
		path: file,
	});

	console.log('Emailing ' + feedItem.title);
	if(config.SimulateEmailSend) {
		console.log('Simulated sending complete');
	} else {
		sendgrid.send(email, function(err, json) {
		  if (err) { return console.error(err); }
		  if(json.message === 'success') {
		  	console.log('Successfully sent to ' + email.to);
		  } else {
		    console.log(json);
		  }
		});
	}
}