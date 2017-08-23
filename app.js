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

// read and parse app settings
// maybe put the secret stuff in environment variables
var d = fs.readFileSync('settings.json', 'utf8');
if (!d) {
  throw 'Cannot read app settings file.';
}
var settings = JSON.parse(d);

d = fs.readFileSync('security.json', 'utf8');
if (!d) {
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
}

// execute first time
run();

 // this does the work and sets the interval for the next run
function run() {
  // process each user
  for (var u in users) {
    console.log('Processing user: ' + u);
    processUser(users[u]);
  }
  // set an interval for the next check
  setInterval(run, settings.intervalSeconds * 1000);
}

// process affirmations for this user
function processUser(user) {
  var d = new Date();
  // are we past this user's start time?
  if (d.getHours() > user.settings.startHour || (d.getHours() == user.settings.startHour && d.getMinutes() >= user.settings.startMinute)) {
    if (d.getHours() < user.settings.endHour || (d.getHours() == user.settings.endHour && d.getMinutes() <= user.settings.endMinute)) {
      // check if enough time has past since the last message
      if (!user.nextMessage || d.getTime() >= user.nextMessage) {
        var i = Math.floor(Math.random() * user.affirmations.length); 
        // send the affirmation
        var msg = user.affirmations[i];
        sendMsg(user.settings.number, msg);
        // update the user's info
        user.nextMessage = d.getTime() + user.settings.frequencyMinutes * 60 * 1000;
      }
    }
  }
}

function sendMsg(number, msg) {
  console.log(number + ':' + msg);
  nexmo.message.sendSms(
    security.number, number, msg,
      (err, responseData) => {
        if (err) {
          console.log(err);
        } else {
          console.dir(responseData);
        }
      }
   );
}