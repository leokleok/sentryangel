require('dotenv').config()
var morgan  = require('morgan');
var express = require('express');
// var dotenv  = require('dotenv');
var app = express();
var port = process.env.PORT || 3000;
var watson = require('watson-developer-cloud')
var router = express.Router()
var tone_analyzer = watson.tone_analyzer({
  username: process.env.IBM_WATSON_CLIENT_ID,
  password: process.env.IBM_WATSON_CLIENT_PASSWORD,
  version: 'v3',
  version_date: '2016-05-19'
});

var server = require('http').createServer(app)
var Twit   = require('twit');

var Firebase = require('firebase');
var myDatabase = new Firebase("https://sentryangel.firebaseio.com/settings/");

const twitter = new Twit({
  consumer_key: process.env.TWITTER_APP_KEY,
  consumer_secret: process.env.TWITTER_APP_CONSUMER_SECRET,
  access_token: process.env.TWITTER_APP_ACCESS_TOKEN,
  access_token_secret: process.env.TWITTER_APP_ACCESS_TOKEN_SECRET
});

//firebase connection
myDatabase.on("value", function(snapshot) {
  const keyword = snapshot.child("keyword").val()
  const sadness = snapshot.child("sadness").val()
  console.log(sadness); //check keyword intensity
  console.log(keyword); //check keyword
  var userdata = [];
  const stream = twitter.stream('statuses/filter', { track: keyword} ); //get keyword tweets
  io.on('connect', function(socket) {

    stream.on('tweet', function(tweet) {
      var data = {}; //create object for holding tweets
      data.name = tweet.user.name;
      data.screen_name = tweet.user.screen_name;
      data.text = tweet.text;
      data.user_profile_image = tweet.user.profile_image_url;

      tone_analyzer.tone({ text: tweet.text }, //pass twitter text through tone analyzer
      function(err, tone) {
        if (err)
         console.log(err); //return error if any
        else
          data.tone = tone; //else pass returned value to data.tone

          if(tone.document_tone){
        if(tone.document_tone.tone_categories[0].tones[4].score>=sadness){ //if tweet is greater than set sadness
//then execute the below
          console.log(data.screen_name + 'is flagged');
          var options = { screen_name: tweet.user.screen_name, count: 5 }; //set drill-down of last 5 tweet values
          twitter.get('statuses/user_timeline', options , function(err, tweet) { //execute tweets with drill-down
            if(err){
              console.log(err)
            }
            if(userdata.length >= 6){
              userdata.splice(0, 5);
            }

            for (var i = 0; i < tweet.length ; i++) {

              tone_analyzer.tone({ text: tweet[i].text },
              function(err, tone) {
                if (err)
                 console.log(err);
                else
                if(tone.document_tone){
                  userdata.push(tone.document_tone.tone_categories[0].tones[4].score)
                  console.log(userdata.length)
                    // checkdata.push(tone.document_tone.tone_categories[0].tones[4].score);
                  }else{
                    console.log("no document tone")
                  }
              });
            }
            socket.emit('usertweets', userdata);
          })
        }
      }
        socket.emit('tweets', data);
        // console.log(JSON.stringify(tone, null, 2));
      });

    })
  });
}, function (errorObject) {
  console.log("The read failed: " + errorObject.code);
});


server.listen(port)

app.use(express.static(__dirname + '/public'));
app.set('views', './views');
app.set('view engine', 'ejs');

app.use(morgan('dev'));

// checkdata=['1','2','3','4','5'];
router.get('/', function(req, res) {
  res.render('index');
});

router.get('/admin', function(req, res) {
  res.render('admin');
});

app.use('/', router);

server.listen(port); //changed from app to server

console.log('Server started on ' + port);

const io = require('socket.io')(server);



// app.set('views', './public')

// router.get('/', function (res, req) {
//   res.render('index')
// })
