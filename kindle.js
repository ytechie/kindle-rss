var Q = require("q");
var fs = require('fs');
var request = require('request');
var exec = require('child_process').exec;
var FeedParser = require('feedparser');

var articleExporter = require('./articleExporter.js');
var fileDatabase = require('./fileDatabase.js');

//Q.longStackSupport = true;

run();

function run() {
	var config;
	var cache;
	var newItems = [];

	fileDatabase.loadFileCache()
		.then(function(loadedCache) {
			cache = loadedCache;
		})
		.then(loadConfig)
		.then(function(loadedConfig) {
			config = loadedConfig;
		})
		.then(articleExporter.initialize)
		.then(function() {
			return processAllFeeds({feeds: config.Feeds, cache: cache});
		})
		.then(function(feedsResults) {
			feedsResults.forEach(function(feedResult) {
				if(feedResult.state === 'fulfilled') {
					newItems = newItems.concat(feedResult.value);
				}
				
            });
            return emailRssItems(newItems, config);
		})
		.then(function() {
			fileDatabase.saveFileCache(cache);
		})
		.catch(function(error) {
			console.log(error.stack);
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

//returns array of promises
function processAllFeeds(options) {
	//options.feeds
	//options.cache

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
				feedCache: cache.feeds[feedUrl] //passed by ref
			});
	}

	return Q.allSettled(feedPromises);
}

function processFeed(options) {
	var feedUrl = options.feedUrl,
		feedCache = options.feedCache,

		deferral = Q.defer(),
		req = request(feedUrl),
		feedparser = new FeedParser({}),
		newItems = [],
		stream,
		i,
		item;

	req.on('error', function (error) {
		deferral.reject(error);
	}).on('response', function (res) {
		stream = this;

		if (res.statusCode != 200) {
			deferral.reject(new Error('Bad status code'));
		}

		stream.pipe(feedparser);

		stream.on('end', function() {
			//Update our last pub date cache
			for(i = 0; i < newItems.length; i++) {
				if(!feedCache.lastPubDateSent || newItems[i].pubDate > feedCache.lastPubDateSent) {
					feedCache.lastPubDateSent = newItems[i].pubDate;
				}
			}

			console.log('Done processing ' + feedUrl);
			deferral.resolve(newItems);
		});
	});

	feedparser.on('error', function(error) {
		deferral.reject(error);
	});
	feedparser.on('readable', function() {
		stream = this
		, meta = this.meta // **NOTE** the "meta" is always available in the context of the feedparser instance
		, item;

		while (item = stream.read()) {
			if(feedCache.lastPubDateSent) {
				if(item.pubDate > feedCache.lastPubDateSent) {
					newItems.push(item);
				}
			} else {
				//If we've never sent an email before, let's send the latest item

				if(newItems.length === 0) {
					newItems.push(item);
				} else if(item.pubDate > newItems[0].pubDate) {
					newItems[0] = item;
				}
			}
		}  
	});

	return deferral.promise;
}

function emailRssItems(newItems, config) {
	newItems.forEach(function(newItem) {
		articleExporter.exportArticle(newItem.title, newItem.description)
			.then(function(exportFileName) {
				emailRssItem({feedItem: newItem, file: exportFileName, config: config});
			});
	});
}

function emailRssItem(options) {
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