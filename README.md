kindle-rss
==========

A script for sending new RSS items to my Kindle. I love using my kindle to read long-form content. Sure, there is the [Kindle Chrome extension](http://www.amazon.com/gp/sendtokindle/chrome/), but there are certain blogs that I want sent to my Kindle soon after they publish new content. This script can be run on a regular basis, say every hour, and it will check for new RSS items, and if it finds new items, it will email them to your Kindle with the correct formatting.

This can be run inside a free Azure webjob.

![Kindle RSS Screenshot](screenshot.png)

### Prerequisites

* A Kindle of course
* A [SendGrid](http://sendgrid.com) account - have your email address, API user, and key ready
* A DocumentDB instance (this isn't implmented yet)

### Installation

* Rename `config.jsonSAMPLE` to `config.json`
* Edit the values in `config.json` with your own information
	* kindleEmail: The email address [assigned to your kindle](https://www.amazon.com/mn/dcw/myx.html#/home/settings/payment).
	* SendGrid*: Your SendGrid account information
	* Feeds: An array of RSS feed URLs to monitor

#### Be sure to whitelist the sender email address in your [Amazon account](https://www.amazon.com/mn/dcw/myx.html#/home/settings/payment)