//
// wake up
// read list of affirmations
// pick one and send it
//
// read the API keys and don't put them in code
//
// max length is 160 characters.
//
// will need logging
//
var fs = require('fs');
const Nexmo = require('nexmo');
var users = {};
var status = {};

// write to the log
log('Started');

// read and parse app settings
// maybe put the secret stuff in environment variables
var d = fs.readFileSync('settings.json', 'utf8');
if (!d) {
  log('Cannot read app settings file.')
  throw 'Cannot read app settings file.';
}
var settings = JSON.parse(d);

d = fs.readFileSync('security.json', 'utf8');
if (!d) {
  log('Cannot read app security file.')
  throw 'Cannot read app security file.';
}
var security = JSON.parse(d);

// initialize the sms system
const nexmo = new Nexmo({
  apiKey: security.key,
  apiSecret: security.secret
});

// read in the user information (have to restart everytime we change the user folder)
// read each subdirectory
var files = fs.readdirSync('./users');
for (f in files) {
  var user = files[f];
  users[user] = {};
  // read and parse the affirmations
  var a = fs.readFileSync('./users/' + user + '/affirmations.json');
  users[user].affirmations = JSON.parse(a);
  // read and parse the user's settings
  var s = fs.readFileSync('./users/' + user + '/settings.json');
  users[user].settings = JSON.parse(s);
  // TODO: could reduce this code
  var i = users[user].settings.startTime.indexOf(':');
  var startTime = users[user].settings.startTime;
  users[user].settings.startHour = parseInt(startTime.substr(0, i));
  users[user].settings.startMinute = parseInt(startTime.substring(i + 1));
  i = users[user].settings.endTime.indexOf(':');
  var endTime = users[user].settings.endTime;
  users[user].settings.endHour = parseInt(endTime.substr(0, i));
  users[user].settings.endMinute = parseInt(endTime.substring(i + 1));
  // read in status.json
  try {
    var st = fs.readFileSync('./status.json');
    status = JSON.parse(st);
  } catch (e) {
    if (!e.code || e.code != 'ENOENT') {
      // it was something other than file not found
      throw e;
    }
  }
}

// process each user
for (var u in users) {
  log('Processing user: ' + u);
  processUser(u);
}

// write out the status file
fs.writeFileSync('status.json', JSON.stringify(status), 'utf8');

// program done
log('Exiting');

// process affirmations for this user
function processUser(userId) {
  var user = users[userId];
  var d = new Date();
  // are we past this user's start time?
  if (d.getHours() > user.settings.startHour || (d.getHours() == user.settings.startHour && d.getMinutes() >= user.settings.startMinute)) {
    if (d.getHours() < user.settings.endHour || (d.getHours() == user.settings.endHour && d.getMinutes() <= user.settings.endMinute)) {
      // check if enough time has past since the last message
      if (isTimeForMsg(userId)) {
        var i = Math.floor(Math.random() * user.affirmations.length); 
        // send the affirmation
        var msg = user.affirmations[i];
        sendMsg(user.settings.number, msg);
        // update the user's info 
        setNextTime(userId);
      }
    }
  }
}

function sendMsg(number, msg) {
  log(number + ': ' + msg);
  nexmo.message.sendSms(
    security.number, number, msg,
      (err, responseData) => {
        if (err) {
          log(err);
        } else {
            // this is a success response, do nothing for now
//          console.dir(responseData);
        }
      }
   );
}

// returns true if it is time to send this user a message
function isTimeForMsg(userId) {
    var d = new Date();
    if (status[userId] && d.getTime() < status[userId].nextMessage) {
      return false;
    }
  return true;
}

function setNextTime(userId) {
  var d = new Date();
  if (!status[userId]) {
    status[userId] = {};
  }
  status[userId].nextMessage = d.getTime() + users[userId].settings.frequencyMinutes * 60 * 1000;
}

function log(msg) {
  // writes to a log file
  // there should be one log file per day
  // log entries will be with be in the format date, time, msg
  var d = new Date();
  var sDate = d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate();
  var sTime = d.getHours() + ':' + d.getMinutes() + ':' + d.getSeconds() + '.' + d.getMilliseconds();
  var logFile = sDate + '.log';
  var data = sDate + ',' + sTime + ',' + '"' + msg + '"\n';
  fs.appendFileSync('logs/' + logFile, data, 'utf8');
}