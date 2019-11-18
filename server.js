const express = require("express");
const app = express();
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const request = require("request");
const log4js = require('log4js')
log4js.configure({
  appenders : {
    system : {type : 'file', filename : 'system.log'}
  },
  categories : {
    default : {appenders : ['system'], level : 'debug'},
  }
});
const logger = log4js.getLogger();
logger.level = 'debug';

const API_ID = 'アプリケーションID';
const SERVER_ID = 'Server ID';
const CONSUMER_KEY = 'Server API Consumer Key';
const PRIVATE_KEY = 'Server認証キー';
const BOT_NO = 'BotNo';


// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))

// parse application/json
app.use(bodyParser.json())

/* Bot起動確認
* 
*/
app.get("/", function (request, response) {
  response.send("起動してます！");
  logger.info(`ログ`);
});

/* Botからのメッセージ受信
* {
*   "type": "message",
*   "source": {
*     "accountId": "アカウントID",
*     "roomId": "ルームID"
*   },
*   "createdTime": 1470902041851,
*   "content": {
*     "type": "text",
*     "text": "hello"
*   }
* }
*/
app.post("/callback", function (req, res) {
  const message = req.body.content.text;
  const roomId = req.body.source.roomId;
  const accountId = req.body.source.accountId;

  logger.info(`message:${message}`);
  logger.info(`roomId:${roomId}`);
  logger.info(`accountId:${accountId}`);

  res.sendStatus(200);

  getJWT((jwttoken) => {
    getServerToken(jwttoken, (newtoken) => {
        sendMessage(newtoken, accountId, roomId, message);
    });
  });
});

function getJWT(callback){
  const iss = SERVER_ID;
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + (60 * 60);　//JWTの有効期間は1時間
  const cert = PRIVATE_KEY;
  const token = [];
  const jwttoken = jwt.sign({"iss":iss, "iat":iat, "exp":exp}, cert, {algorithm:"RS256"}, (err, jwttoken) => {
      if (!err) {
          callback(jwttoken);
      } else {
          console.log(err);
      }
  });
}


function getServerToken(jwttoken, callback) {
  const postdata = {
      url: 'https://authapi.worksmobile.com/b/' + API_ID + '/server/token',
      headers : {
          'Content-Type' : 'application/x-www-form-urlencoded; charset=UTF-8',
      },
      form: {
          "grant_type" : encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer"),
          "assertion" : jwttoken
      }
  };
  request.post(postdata, (error, response, body) => {
      if (error) {
          console.log(error);
          callback(error);
      } else {
          const jsonobj = JSON.parse(body);
          const AccessToken = jsonobj.access_token;
          callback(AccessToken);
      }
  });
}

function sendMessage(token, accountId, roomId, message) {
  let postdata = {
      url: 'https://apis.worksmobile.com/' + API_ID + '/message/sendMessage/v2',
      headers : {
        'Content-Type' : 'application/json;charset=UTF-8',
        'consumerKey' : CONSUMER_KEY,
        'Authorization' : "Bearer " + token
      },
      json: {
          "botNo" : Number(BOT_NO),
          "content" : {
              "type" : "text",
              "text" : message
          }
      }
  };

  if (roomId) {
    postdata.json.roomId = roomId;
  } else {
    postdata.json.accountId = accountId;
  }

  request.post(postdata, (error, response, body) => {
      if (error) {
        console.log(error);
      }
      console.log(body);
  });
}

var port = process.env.PORT || 3000
app.listen(port, function() {
    console.log("To view your app, open this link in your browser: http://localhost:" + port);
});