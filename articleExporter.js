var Q = require("q");
var fs = require('fs');
var request = require('request');
var exec = require('child_process').exec;

var panDocMsiUrl = 'http://github.com/jgm/pandoc/releases/download/1.13.1/pandoc-1.13.1-windows.msi';

// returns file name
function exportArticle(title, body) {
	var deferral = Q.defer();

	createHtmlDoc(title, body)
		.then(convertHtmlDocToDocx)
		.then(function(options) {
			deferral.resolve(options.docxFile);
		})
		.catch(function(error) {
			console.error(error);
		})
		.done();

	return deferral.promise;
}

function download(url, dest) {
	var deferral = Q.defer();

	var file = fs.createWriteStream(dest);
	request(url).on('end', function() {
		file.close(deferral.resolve);
	}).on('error', function(err) {
		deferral.reject(err);
	}).pipe(file);

	return deferral.promise;
}

//This needs to be called before calls to exportArticle. It's
//not part of that method because there could be multiple
//executions happening at the same time and I don't want to create
//a mutex
function installPandoc() {
	var deferral = Q.defer();

	fs.exists('Pandoc\\pandoc.exe', function(exists) {
		if(exists) {
			console.log('PanDoc is already installed');
			deferral.resolve();
		} else {
			var msi = process.env['TEMP'] + '\\pandoc.msi';
			console.log('Downloading PanDoc MSI from ' + panDocMsiUrl);
			//download msi
			download(panDocMsiUrl, msi)
				.then(function() {
					console.log('Pandoc download complete');
					//extract MSI
					var cmd = 'msiexec /a ' + msi + ' /qn TARGETDIR="' + __dirname + '"';
					console.log('Extracting MSI using "' + cmd + '"');
					exec(cmd, function(error, stdout, stderr) {
						if(error) {
							console.error(error);
							deferral.reject(error);
						} else {
							console.log('PanDoc Extracted');
							deferral.resolve();
						}
					});
				});
		}
	});

	return deferral.promise;
}

// returns file name
function createHtmlDoc(title, body) {
	var deferral = Q.defer();

	var body = '<html><head><title>' + title + '</title></head><body>' + body + '</body></html>';

	//Save the post to a temp file
	var fileName = Math.floor(Math.random() * 1000000000);
	var file = process.env['TEMP'] + "\\" + fileName + '.html';
	fs.writeFile(file, body, function(err) {
		if(err) {
			deferral.reject(err);
		} else {
			deferral.resolve({ htmlFile: file });
		}
	});

	return deferral.promise;
}

// returns file name
function convertHtmlDocToDocx(options) {
	var deferral = Q.defer();

	var outFile = options.htmlFile.substring(0, options.htmlFile.lastIndexOf('.')) + '.docx';
	var cmd = 'Pandoc\\pandoc.exe -o "' + outFile + '" "' + options.htmlFile + '"';
	
	console.log('Converting doc using ' + cmd);
	exec(cmd).on('exit', function() {
		console.log('Converted');
		deferral.resolve({ docxFile: outFile });
	});

	return deferral.promise;
}

exports.initialize = installPandoc;
exports.exportArticle = exportArticle;