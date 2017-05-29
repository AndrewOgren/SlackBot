import botkit from 'botkit';
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import yelp from 'yelp-fusion';

dotenv.config({ silent: true });

// initialize
const app = express();

// botkit controller
const controller = botkit.slackbot({
  debug: false,
});

 // initialize slackbot
const slackbot = controller.spawn({
  token: process.env.SLACK_BOT_TOKEN,
   // this grabs the slack token we exported earlier
}).startRTM((err) => {
   // start the real time message client
  if (err) { throw new Error(err); }
});


// enable/disable cross origin resource sharing if necessary
app.use(cors());

app.set('view engine', 'ejs');
app.use(express.static('static'));
// enables static assets from folder static
app.set('views', path.join(__dirname, '../app/views'));
// this just allows us to render ejs from the ../app/views directory

// enable json message body for posting data to API
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());


// default index route
app.get('/', (req, res) => {
  res.send('hi');
});

// START THE SERVER
// =============================================================================
const port = process.env.PORT || 9090;
app.listen(port);

console.log(`listening on: ${port}`);


// prepare webhook
// for now we won't use this but feel free to look up slack webhooks
controller.setupWebserver(process.env.PORT || 3001, (err, webserver) => {
  controller.createWebhookEndpoints(webserver, slackbot, () => {
    if (err) { throw new Error(err); }
  });
});

controller.hears(['hello', 'hi', 'howdy'], ['direct_message', 'direct_mention', 'mention'], (bot, message) => {
  bot.api.users.info({ user: message.user }, (err, res) => {
    if (res) {
      bot.reply(message, `Hello, ${res.user.name}!`);
    } else {
      bot.reply(message, 'Hello there!');
    }
  });
});

let yelpClient;
yelp.accessToken(process.env.YELP_CLIENT_ID, process.env.YELP_CLIENT_SECRET)
   .then((res) => {
     yelpClient = yelp.client(res.jsonBody.access_token);
   });


let foodType = '';
let location = '';

const askYelp = (response, convo) => {
  if (yelpClient) {
    convo.say('Pulling up results now. Hold on a sec.');
    yelpClient.search({
      term: foodType,
      location,
    }).then((res) => {
      console.log(res.jsonBody.businesses[0]);
      convo.say(res.jsonBody.businesses[0].name);
      convo.say(`Rating: ${res.jsonBody.businesses[0].rating}`);
      convo.say(res.jsonBody.businesses[0].url);
      convo.next();
    }).catch((e) => {
      convo.say(e);
    });
  } else {
    convo.say('Yelp is not available to help right now. Sorry');
  }
};

const askLocation = (response, convo) => {
  convo.ask('Where are you located?', (res, conv) => {
    convo.say('What a cool place!');
    location = res.text;
    askYelp(res, conv);
    console.log(location);
    conv.next();
  });
};

const askType = (response, convo) => {
  convo.ask('What type of food are you interested in?', (res, conv) => {
    conv.say('Sounds Good!');
    foodType = res.text;
    askLocation(res, conv);
    console.log(foodType);
    conv.next();
  });
};

const askIfRecommend = (response, convo) => {
  convo.ask('Would you like food recommendations nearby?', (res, conv) => {
    console.log(res);
    if (['yes', 'sure', 'okay', 'please', 'yeah'].includes(res.text)) {
      conv.say('Sure!');
      askType(res, conv);
      conv.next();
    }
    conv.next();
  });
};


controller.hears(['hungry', 'food', 'eat'], ['direct_message', 'direct_mention', 'mention'], (bot, message) => {
  bot.startConversation(message, askIfRecommend);
});

controller.hears(['help'], ['direct_mention', 'mention', 'direct_message'], (bot, message) => {
  bot.reply(message, 'Hey, what\'s up? I\'m A$AP Bot, aka lil-bot. Ask me for food or say, "I\'m Hungry" to get suggestions for restaurants.');
});

controller.hears([''], ['direct_mention', 'mention', 'direct_message'], (bot, message) => {
  bot.reply(message, 'Sorry what are you talking about? Try asking for help.');
});

controller.on('outgoing_webhook', (bot, message) => {
  bot.replyPublic(message, 'Shut your mouth.');
});
