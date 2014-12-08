var fs = require('fs');
var request = require('request');
var exec = require('child_process').exec;
//var process = require('process');

loadConfig(function(config) {
	loadDatabase(config, function(db) {
		getPanDoc(config, function() {
			checkFeeds(config, db);
		});
	});
});

//loadConfig(function() {console.log('here')});

function loadConfig(callback) {
	console.log('Loading configuration...');
	fs.readFile('config.json', function (err, data) {
	  if (err) throw err;
	  console.log('Config Loaded: ');
	  
	  var config = JSON.parse(data);
	  console.log(config);
	  callback(config);
	});
}

function loadDatabase(config, callback) {
	/*
	fs.exists(config.DbFile, function(exists) {
		if(!exists) {
			console.log('Creating local database...');
			saveDatabase({feeds: []}, function() {
				loadDatabase(config, callback);
			});
		} else {*/
	console.log('Loading local database...');

	fs.readFile(config.DbFile, function (err, data) {
		if (err) {
			saveDatabase(config, {feeds: {}}, function() {
				//Try again after creating
				loadDatabase(config, callback);
			});
			return;
		}
	
		console.log('Database Loaded: ');
	  
		var db = JSON.parse(data);
		//console.log(db);
		callback(db);
	});
}

function saveDatabase(config, db, callback) {
	//console.log('Saving local database...');
	//console.log(JSON.stringify(db));

	//This is a bottneck since it's sync
	fs.writeFileSync(config.DbFile, JSON.stringify(db));//, function() {
		console.log('Database saved');
		if(callback) callback();
	//});
}

function download(url, dest, cb) {	
  var file = fs.createWriteStream(dest);
  request(url).on('end', function() {
  	file.close(cb);
  }).pipe(file);
}

function getPanDoc(config, callback) {
	fs.exists('Pandoc\\pandoc.exe', function(exists) {
		if(exists) {
			callback();
		} else {
			var msi = process.env['TEMP'] + '\\pandoc.msi';
		console.log('Downloading PanDoc MSI from ' + config.PanDocMSIUrl);
		//download msi
		download(config.PanDocMSIUrl, msi, function() {
			console.log('Pandoc download complete');
			//extract MSI
			var cmd = 'msiexec /a ' + msi + ' /qn TARGETDIR="' + __dirname + '"';
			console.log('Extracting MSI using ' + cmd);
			exec(cmd).on('exit', function() {
				console.log('PanDoc Extracted');
				callback();
			});
		});	
		}
	});
}

function checkFeeds(config, db) {

	var feedUrl;
	var feedDb;

	for(var i = 0; i < config.Feeds.length; i++) {
		feedUrl = config.Feeds[i];
		console.log('Processing ' + feedUrl);


		if(db.feeds[feedUrl]) {
	    	//console.log('Feed was found in database');
	    } else {
	    	//console.log('Feed was not found in database')
	    	db.feeds[feedUrl] = {};
	    }
	    feedDb = db.feeds[feedUrl];

		checkFeed(config, feedDb, feedUrl, function() {
			saveDatabase(config, db);
		});

	}
}

function checkFeed(config, feedDb, feedUrl, callback) {
	var FeedParser = require('feedparser')
	  , request = require('request');
	var newestItem;

	var req = request(feedUrl)
	  , feedparser = new FeedParser({});

	req.on('error', function (error) {
	  console.log('Feed read error: ' + error);
	});
	req.on('response', function (res) {
	  var stream = this;

	  if (res.statusCode != 200) return this.emit('error', new Error('Bad status code'));

	  stream.pipe(feedparser);

	  stream.on('end', function() {
	  	console.log('Done processing ' + feedUrl);

	  	//Note: this will send the latest of each feed the first time

	  	feedDb.newestItem = newestItem.pubDate;
	  	if(!feedDb.lastPubDateSent || feedDb.lastPubDateSent < feedDb.newestItem) {
	  		feedDb.lastPubDateSent = feedDb.newestItem;

	  		console.log('sending the user ' + newestItem.title)
	  		
	  		emailRssItem(config, newestItem);
	  	}

		if(callback) callback();
	  });
	});

	feedparser.on('error', function(error) {
	  // always handle errors
	});
	feedparser.on('readable', function() {
	  // This is where the action is!
	  var stream = this
	    , meta = this.meta // **NOTE** the "meta" is always available in the context of the feedparser instance
	    , item;

	  while (item = stream.read()) {
	  	process.stdout.write("*");
	  	//console.log('Processing ' + item.title + '...');
	    //console.log(item.description);

	    //Check if this is the newest (or first) item
	    if(!newestItem || item.pubDate > newestItem.pubDate) {
			newestItem = item;
		}
	  }  
	});
}

function emailRssItem(config, feedItem) {
	var sendgrid  = require('sendgrid')(config.SendGridApiUser, config.SendGridApiKey);

	//wrap the body so Amazon recognizes it
	var body = '<html><head><title>' + feedItem.title + '</title></head><body>' + feedItem.description + '</body></html>';

	//Save the post to a temp file
	var fileName = Math.floor(Math.random() * 1000000000);
	var file = process.env['TEMP'] + "\\" + fileName + '.html';
	fs.writeFile(file, body);

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


	convertRssItem(file, function(outFile) {
		console.log('Converted to ' + outFile);

			var email     = new sendgrid.Email({
		  to:       [config.kindleEmail],
		  from:     config.SendGridFromEmail,
		  replyto: 'jason@ytechie.com', //for troubleshooting
		  subject:  'convert', //Tells the kindle to conver it to it's internal format
			text: 'Your article via RSS as requested.'
		});

		email.addFile({
		 // filename: 'post.docx',
		  //content: body
		  filename: cleanTitle + '.docx',
		  path: outFile,
		});

		console.log('Emailing ' + feedItem.title);
		if(!config.SimulateEmailSend) {
			sendgrid.send(email, function(err, json) {
			  if (err) { return console.error(err); }
			  if(json.message === 'success') {
			  	console.log('Successfully sent to ' + email.to);
			  } else {
			    console.log(json);
			  }
			});
		}
	});


}

function convertRssItem(file, callback) {
	var outFile = file.substring(0, file.lastIndexOf('.')) + '.docx';
	var cmd = 'Pandoc\\pandoc.exe -o "' + outFile + '" "' + file + '"';
	
		console.log('Converting doc using ' + cmd);
		exec(cmd).on('exit', function() {
			console.log('Converted');
			callback(outFile);
		});
}
