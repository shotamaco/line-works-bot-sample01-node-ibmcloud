const express = require('express');
const app = express();
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const request = require('request');
const log4js = require('log4js')

log4js.configure({
  appenders : {
    system : {type : 'file', filename : 'system.log'}
  },
  categories : {
    default : {appenders : ['system'], level : 'debug'},
  }
});

// ロガー
const logger = log4js.getLogger();
logger.level = 'debug';

// -- ハンズオン編集箇所１ -- start
const API_ID = 'アプリケーションID';
const CONSUMER_KEY = 'Server API Consumer Key';
const SERVER_ID = 'Server ID';
const PRIVATE_KEY = 'Server認証キー';
const BOT_NO = 'BotNo';
// -- ハンズオン編集箇所１ -- end

// デフォルトで http 3000ポートで受付
var port = process.env.PORT || 3000
app.listen(port, function() {
    console.log('To view your app, open this link in your browser: http://localhost:' + port);
});

app.use(express.json({verify:(req, res, buf, encoding) => {
  // メッセージの改ざん防止
  const data = crypto.createHmac('sha256', API_ID).update(buf).digest('base64');
  const signature = req.headers['x-works-signature'];

  if (data !== signature) {
    logger.error(`リクエストが改ざんされています！`);
    throw 'NOT_MATCHED signature';
  }
}}));

/* 
* 疎通確認API
*/
app.get('/', function (req, res) {
  res.send('起動してます！');
  logger.info(`ログ`);
});

/**
 * LINE WORKS からのメッセージを受信するAPI
 */
app.post('/callback', function (req, res) {
  logger.info(`callback`);
  /*
   req.bodyに下記のJSON形式のデータが受診されます。
   ---------
   {
     "type": "message",
     "source": {
       "accountId": "<アカウントID>",
       "roomId": "<ルームID>"
     },
     "createdTime": <作成日時>,
     "content": {
       "type": "text",
       "text": "<受信したチャットのテキストデータ>"
     }
   }
   ---------
   詳細は、https://developers.worksmobile.com/kr/document/100500901?lang=ja
   を参照してください。
  */
  const message = req.body.content.text;
  const roomId = req.body.source.roomId;
  const accountId = req.body.source.accountId;

  logger.info(`message:${message}`);
  logger.info(`roomId:${roomId}`);
  logger.info(`accountId:${accountId}`);

  res.sendStatus(200);

  createJWT((jwtData) => {
    getServerTokenFromLineWorks(jwtData, (serverToken) => {
      sendMessageToLineWorks(serverToken, accountId, roomId, message);
    });
  });
});

/** 
 * JWTを作成します。
 * @param {object} callbackFunc コールバック関数
 */
function createJWT(callbackFunc) {
  const iss = SERVER_ID;
  const iat = Math.floor(Date.now() / 1000);
  // JWTの有効期間は1時間
  const exp = iat + (60 * 60);　
  const cert = PRIVATE_KEY;
  const jwtData = jwt.sign({ iss: iss, iat: iat, exp: exp }, cert, { algorithm: 'RS256' }, (err, jwtData) => {
    if (err) {
      console.log(err);
    } else {
      callbackFunc(jwtData);
    }
  });
}

/**
 * LINE WORKS から Serverトークンを取得します。
 * @param {string} jwtData JWTデータ
 * @param {object} callbackFunc コールバック関数
 */
function getServerTokenFromLineWorks(jwtData, callbackFunc) {
  // 注意:
  // このサンプルでは有効期限1時間のServerトークンをリクエストが来るたびに LINE WORKS から取得しています。
  // 本番稼働時は、取得したServerトークンを NoSQL データベース等に保持し、
  // 有効期限が過ぎた場合にのみ、再度 LINE WORKS から取得するように実装してください。
  const postdata = {
    url: `https://authapi.worksmobile.com/b/${API_ID}/server/token`,
    headers : {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    },
    form: {
      grant_type: encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer'),
      assertion: jwtData
    }
  };

  // LINE WORKS から Serverトークンを取得リクエスト
  request.post(postdata, (error, response, body) => {
    if (error) {
      console.log(error);
      logger.error(body);
    } else {
      callbackFunc(JSON.parse(body).access_token);
    }
  });
}

/**
 * LINE WORKS にメッセージを送信します。
 * @param {string} serverToken Serverトークン
 * @param {string} accountId アカウントID
 * @param {string} roomId トークルームID
 * @param {string} message 送信するメッセージ
 */
function sendMessageToLineWorks(serverToken, accountId, roomId, reqMessage) {
  let resMessage = botImpl(reqMessage);

  // 送信するJSONデータ
  let sendData = {
    url: `https://apis.worksmobile.com/${API_ID}/message/sendMessage/v2`,
    headers: {
      'Content-Type': 'application/json;charset=UTF-8',
      consumerKey: CONSUMER_KEY,
      Authorization: `Bearer ${serverToken}`
    },
    json: {
      botNo: Number(BOT_NO),
      content: {
        type: 'text',
        text: resMessage
      }
    }
  };

  if (roomId) {
    // 受信したデータにトークルームIDがある場合は、送信先にも同じトークルームIDを指定します。
    sendData.json.roomId = roomId;
  } else {
    // トークルームIDがない場合はBotとユーザーとの1:1のチャットです。
    sendData.json.accountId = accountId;
  }

  // LINE WORKS にメッセージを送信するリクエスト
  request.post(sendData, (error, response, body) => {
      if (error) {
        console.log(error);
      }
      logger.info(body);
      console.log(body);
  });
}

/**
 * Bot実装部
 * @param {string} reqMessage リクエストメッセージ
 * @return {string} レスポンスメッセージ
 */
function botImpl(reqMessage) {
  // -- ハンズオン編集箇所2 -- start
  // ※リクエストメッセージを元に条件分岐をしたり、他システムからデータを取得してレスポンスメッセージを決定します。
  /*
  if (reqMessage.indexOf('botくん') >= 0) {
    return 'はい';
  }
  if (reqMessage.indexOf('名前') >= 0) {
    return '初めての LINE WORKS Botです';
  }
  */
  // -- ハンズオン編集箇所2 -- end
  return reqMessage;
}