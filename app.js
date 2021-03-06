// Author: Kwon Seok Hwan
// Created: 11 July 2017 
// last edited:  19 Nov 2017

// TASKLIST

// TODO store user directory in a database (Mongo db)
// ----> can remove .socket field from User object and use an  associative array instead

// TODO implement ban 
// ----> a. add registration process (with email verification)
// ----> b. backlist IP (pb: public space IPs such as university campuses, coffee shops, etc...)

// TODO add server crash recovery function: restore(socket) or restore(socket.id), returns user nickname and peer 
// ----> requires use of a database

// TODO redirect console.log into a log file


// GLOBAL VARIABLES 

var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);


//******************************* MY SQL **************************//

var mysql = require("mysql");
var connection = mysql.createConnection({
    host : 'localhost',
    port : 3306,
    user : 'root',
    password : 'seoil13',
    database : 'messenger'
});



connection.connect(function(err) {
  if (err) {
    console.error('error connecting: ' + err.stack);
    return;
  }
  console.log("successfully connected");
  console.log('connected as id ' + connection.threadId);
});

//var user_msg = ['사용자 ID','받는자 ID',getTimeStamp(),'내용1','파일명','실파일명'];
//connection.query('insert into PT_USER_MSG values(?,?,?,?,?,?)', user_msg, function (error, result) {
//     if(!error){ console.log(result); } 
//  });
//connection.query('create table local (area varchar(100) character set utf8, idx int) default charset = utf8',function(error, rows, fields){ if(error) throw error;	else{ console.log(rows); } });
//var data = ['서울특별시 종로구',1]; 
//connection.query('insert into local values(?,?)',data, function(error, result){ if(!error){ console.log(result); } });
//connection.query('select area, idx from local', function(error, rows, fields){ if(error) throw error;	else{ console.log(rows); } });
//var data = ['서울특별시 중구', 1]; connection.query('update local set area = ? where idx=?',data,function(error, rows){ if(error) throw error;	else{ console.log(rows); } });
//connection.query('select area, idx from local', function(error, rows, fields){ if(error) throw error;	else{ console.log(rows); } });
//var data = [1]; connection.query('delete from local where idx=?',data,function(error, rows){ if(error) throw error;	else{ console.log(rows); } });



//*****************  MONGO DB *******************************// 
//var mongoose = require('mongoose');
//mongoose.connect('mongodb://localhost:27017/test'); // 기본 설정에 따라 포트가 상이 할 수 있습니다.
//var db = mongoose.connection;
//db.on('error', console.error.bind(console, 'connection error:'));
//db.once('open', function callback () {
//	console.log("mongo db connection OK.");
//});



var dir = {};           // directory of all User objects, using their respective usernames as keys.
var online_users = [];  // list of all online users, identified by their usernames

var ip_blacklist = [];  // list of blacklisted IPs used to enforce ban

var MAX_PEERS = 4;      // limits group chat size 


// HTTP SERVER
// setup server to listen for requests at the environement's IP, and the specified port (defaults to 3000)

var port = process.env.PORT || 3000;

http.listen(port, function () {
    
    var addr = http.address();
    console.log('listening on http://' + addr.address + ':' + addr.port);
});

app.use(express.static(__dirname + '/public', {index: false}));
// URL routing
app.get('/', function(req, res){       
    res.status(200).sendFile(__dirname + '/index.html'); // chat UI 
});
app.get('/admin', function(req, res){               
    res.status(200).sendFile(__dirname + '/admin.html');   
});
app.get('/test',function(req,res){
   res.status(200).sendFile(__dirname + '/test.html'); 
});
app.get('/dbtest',function(req,res){
   res.status(200).sendFile(__dirname + '/dbtest.html'); 
});
app.get('*', function(req, res){               
    res.status(404).sendFile(__dirname + '/404.html');
    res.status(505).sendFile(__dirname + '/404.html');  
});

//  SOCKET.IO SERVER 
io.sockets.on('connection', function(socket){
    
    var user; // user Objet for this connection
    
    // TODO insert recover code here

    //  I   SIGN IN
    socket.on('sign in', function(username){
        
        var peers = [];  
        
        // get IP when running ONLINE or LOCALLY
        var ip = socket.request.headers['x-forwarded-for'] || socket.request.connection.remoteAddress;
        var user_port = socket.request.connection.remotePort; //  only works locally

        console.log('New user connected: '+ username +' from: '+ ip);

        if (user_port){
            console.log('Port: '+ user_port); 
        }
        else {
            user_port = '';
        }

        // first check that IP is cleared
        if (ip_blacklist.indexOf(ip) !== -1 ){
            
            console.log(username + ' is blacklisted and was denied access to the server!');  
            socket.emit('message',{'from':'SERVER','content':'We are sorry but it appears you have been banned from our service'}); 
        }
        
        else if ( online_users.indexOf(username) !== -1)
        {
            socket.emit('name taken');
        }
        else
        {
            // sign in user
            user = new User(username,peers,ip,user_port,socket);
            
            dir[username] = user;         // add user to directory
            online_users.push(username);  // add user to list of online users

            console.log(username + ' just signed in!');
            console.log('Number of users online: '+ online_users.length);
            console.log('Online users:' + online_users);
          
            // update lobby (online users list displayed in UI)  
            var newest_users = getMostRecentUsers();
            var total_users = online_users.length;
            io.sockets.emit('update lobby', newest_users,total_users);
            //socket.broadcast.emit('update lobby', online_users ,total_users);
            
            // notify everyone else
            socket.broadcast.emit('message',{'from':'SERVER','content':''+ username +'님께서 접속하셨습니다.'});
        } 
    });
    
    
    //  II  SEARCH ONLINE USERS 
    socket.on('search', function(query){
        
        var matching_users = findOnlineUsers(query,user.username);
        var total_users = online_users.length;
        socket.emit('update lobby', matching_users,total_users);
    });

    
    //  III  FORWARD INVITE
    socket.on('invite', function(invite){  // e.g.: invite = {'to':'Nikolay','from':'Ben','type':'new' } 
        
        // TODO add some kind of request time out to have invites expire (appending a timestamp to the message)
        // unless chat is tabbed,  need to prvent case of user A accepting user B's invitation to private chat 
        // X minutes later, and B is now involved with another conversation
        
        // Prepare notification message from server
        var msg = {};
        msg['from'] = 'SERVER';
        
        if ( online_users.indexOf(invite['to']) === -1 ){  
            
            // other user has already left (outdated lobby)
            msg['content'] = invite['to'] + ' has gone offline and could not be invited.';
            user.socket.emit('message', msg);
        } 

        else if (invite['type'] === 'current' &&  user.peers.length === MAX_PEERS) { 

            // can't invite other person to join group because the maximum number of users has been reached
            msg['content'] = 'Could not invite ' + invite['to'] + ' to this chat. Maximum number of peers reached!';
            user.socket.emit('message', msg); //dir[peers[i]] => user object corresponding to this peer

        } else {
             // forward chat request
            dir[invite['to']].socket.emit('invite',invite);
        }
    });

    
    //  IV.  SETUP CHAT (or not) 
    socket.on('rsvp', function(rsvp){ // rsvp.type = 'new' or 'current' and rsvp.rsvp = boolean 

        var inviter = rsvp['to'];   
        var invited = rsvp['from']; // = user.username
        
        // Prepare notification message from server
        var msg = {};
        msg['from'] = 'SERVER';
        
        // there are 3 cases when no chat is setup
        // --> a. invited turned down request
        // --> b. inviter left
        // --> c. inviter sent a group chat invite but it now group is already full

        if (rsvp['rsvp'] === false){
            
            // a. invited turned down request
            // --> forward rsvp to notify user, after making sure he/she hasn't gone offline
            if ( online_users.indexOf(inviter) !== -1 ) {
                dir[inviter].socket.emit('rsvp', rsvp);
            }
            msg['content'] = ' D';
            
            dir[inviter].socket.emit('message', msg);
            
        }
        else if ( online_users.indexOf(inviter) === -1 ) {  
            
            // b. invited accepted chat invite but in the meantime inviter went offline (expired invite)
            // --> notify invited
            msg['content'] = inviter['to'] + ' has gone offline.';
            dir[invited].socket.emit('message', msg);
            dir[inviter].socket.emit('message', msg);
            
        }

        else if ( rsvp['type'] === 'current' && dir[inviter].peers.length === MAX_PEERS ) {
            
            // c. invited accepted group chat invite but in the meantime inviter's group reached max capacity
            // --> no chat setup, notify both users
            
            msg['content'] = 'Could not invite ' + invited + ' to this chat. Maximum number of peers reached!';
            dir[inviter].socket.emit('message', msg);
            
            msg['content'] = 'Chat invite from ' + inviter + ' canceled by the server. Maximum number of peers reached!';
            dir[invited].socket.emit('message', msg);
        } 
        else
        {
            // SETUP CHAT
            
            dir[inviter].socket.emit('rsvp', rsvp);  // forward rsvp to notify inviter
            
            if( rsvp['type'] === 'new' )
            {
                setupPrivateChat(inviter,invited); // add the two users to a new chat room
            }
            else  // rsvp.type === current  
            {
                setupGroupChat(inviter,invited); // add invited to inviter's current conversation 
            }  
            
            console.log('Chat room updated!  '+ inviter + ',' +  dir[inviter].peers + ' are now chatting together!');
            
            ///////////////////////////////////////////////////////// 2017.07.19 /////////////////////////////////////////////////////////////////////
            connection.query("SELECT  A.USER_ID, A.REC_ID, A.REG_DT, TIME_FORMAT(A.REG_DT,'%H:%i') AS REG_TM, A.MSG_DESC FROM PT_USER_MSG A LEFT JOIN PT_USER B ON A.USER_ID = B.USER_ID LEFT JOIN PT_USER C ON A.REC_ID = C.USER_ID WHERE ((A.REC_ID = \'" + dir[inviter].peers + "\' AND A.USER_ID = \'"+ inviter +"\') OR (A.REC_ID = \'" + inviter + "\' AND A.USER_ID = \'"+ dir[inviter].peers +"\')) ORDER BY A.REG_DT", function(err, rows) {
        
            if(err) throw err;
            rsvp['message'] = rows;
            dir[inviter].socket.emit('rsvp',rsvp);
            dir[invited].socket.emit('rsvp',rsvp);
            //console.log('The solution is: ', rows);
            });
            ///////////////////////////////////////////////////////// 2017.07.19 /////////////////////////////////////////////////////////////////////
        }
    });
    
    // V    DISPATCH MESSAGE
    socket.on('message', function(msg_in){
        
        // structure message
        var msg = {};
        msg['from'] = user.username;
        msg['content'] = msg_in; 
        
        // distribute to all subscribers
        var to = user.peers;
        
        for(var i=0; i < to.length; i++){
            
            dir[to[i]].socket.emit('message', msg);
        }
        console.log(user.username + ' to:' + to);
        console.log('message: ' + msg['content'] + '\n' + getTimeStamp() + '\n');
        
        
        msg['content'] = msg['content'].replace(/\n/g,''); //개행 제거

        var user_msg = [msg['from'], to ,getTimeStamp(),msg['content'],null ,null,'text',1];
        connection.query('insert into PT_USER_MSG values(?,?,?,?,?,?,?,?)', user_msg, function (error, result) {if(error){ console.log(error); }});
       

    });
    
   
    // VI   SHARE AN IMAGE OR A VIDEO
    socket.on('file', function(dataURI,type){
        
        var to = user.peers;
       
        for(var i=0; i < to.length; i++){
            dir[to[i]].socket.emit('file', dataURI,type, user.username);
        }
        console.log(user.username + ' is sharing a file');
        
         var user_msg = [user.username, to ,getTimeStamp(), null , null, dataURI.toString, type,1];
        connection.query('insert into PT_USER_MSG values(?,?,?,?,?,?,?,?)', user_msg, function (error, result) {if(error){ console.log(error); }});
    });

    
    // VII   BAN USER
    socket.on('ban user', function(user){ // user = username 
        console.log('ADMIN: ban ' + user);
        
        try{
            // blacklist user's IP address (prevents next sign in)
            // Note: because users are deleted from the directory as soon as 
            // they disconnect this will not work if the user has alread gone offline
            ip_blacklist.push( dir[user].ip ); 
            
            // kick user from chat server
            dir[user].socket.disconnect();
           
            console.log(user + '  was successfully banned.');
        }
        catch(err){
            console.log('Error when banning ' + user + '. User was not found and could not be banned.');
        }
        console.log('Blacklisted IPs: ' + ip_blacklist);
    });
     
    
    // VIII   USER DISCONNECTS
    // user disconnects. Remove user from online users list and notify peers
    socket.on('disconnect', function(){
        
        try{
            console.log(user.username + ' disconnected');
            // TODO differentiate disconnection from leaving
            
            // notify peers that user disconnected
            leaveCurrentChat(user.username); 

            // delete user from memory 
            var x = online_users.indexOf(user.username);
            online_users.splice(x,1);

            delete dir[user.username];
        } 
        catch(err){
            // this error appears every now and then, but app remains fully fonctional anyhow  
            console.log('Error: error on disconnect event (user.username undefined)');
        }
        console.log('Number of users online: '+ online_users.length);
        console.log('Online users:' + online_users);
    });

    // VIII CATCH POTENTIAL ERROR EVENTS
    // Seen occuring when a user sends a message to the server after server is rebooted
    // TODO  : restore connections after a reboot 
    socket.on('error', function(err){
        console.log('ERROR '+ err);
    });

    // P2P DEBUG 
    socket.on('p2p test', function(){
        console.log('DARN, SERVER INTERCEPTED PEER TO PEER TEST');
        // this happens when trying to setup a p2p connection locally, without using ports
    });
});



// FUNCTIONS

// 0 
// User contructor
function User(username,peers,ip,port,socket){
    this.username = username; 
    this.peers = peers;         // peers : ['John','Ben','Mike]  (max of 4)
    this.ip = ip;               // IP address used to ban user if necessary and for P2P comm.
    this.port = port;
    this.socket = socket;   
    // this.status = status; 
    // this.banned = banned  
}

// 1
// return up to 10 of the last users to sign in in an array 
function getMostRecentUsers(){
        var newest_users = [];
          
        for (var i= online_users.length - 1; i >= 0 && i > online_users.length -12; i--){
            newest_users.push(online_users[i]); 
        }
        return newest_users;
}

// 2  
// return the first 10 online users found that match the prefix provided 

// FIXME make search case insensitive  

// TODO: with a large number of online users, a more efficient search algorithm would be:
// 1. sort array
// 2. find first and last matching element
// 3. get slice of array from first to last match
// or even fancier, store online users in a prefix tree  

function findOnlineUsers(query,user){ 
    var matching_users = []
    var string_length = query.length;
    
    for (var i=0; i < online_users.length; i++){
      
        if (online_users[i].substring(0,string_length) === query && online_users[i] !== user){
            matching_users.push(online_users[i]);
        }
        if (matching_users.length === 10) break;
    }
    return matching_users; 
}

// 3
// sets up a new, private chat between two users
function setupPrivateChat(user1,user2){
    
    // unplugg both users from their current  
    // TODO make sure that these execute asynchronously (don't go onward before their completion)
    leaveCurrentChat(user1);  
    leaveCurrentChat(user2);

    // subscribe them to each other
    dir[user1].peers = [user2];
    dir[user2].peers = [user1]; // because: user === dict[invited]
}

// 4 
// "unplugg" a user 
// --> notifies current peers that user has left their conversation
// --> unsubscribe user from each peer's list of subscribers 
// --> clear user's list of peers/subscribers

function leaveCurrentChat(username){
    
    // prepare notification message
    var msg = {};
    msg['from'] = 'SERVER';
    msg['content'] = username + ' left this conversation';
    
    var peers = dir[username].peers;

    for(var i = 0; i < peers.length; i++){
        
        // unconnect user and peer
        // note: dir[peers[i]] => user object corresponding to this peer
        var j = dir[peers[i]].peers.indexOf(username);  
        dir[peers[i]].peers.splice(j,1);

        // notify  peer
        dir[peers[i]].socket.emit('message', msg);
    }
    // clear user's set of peers 
    dir[username].peers = [];
}

// 5
// adds user2 to user1's current chat group.
                
function setupGroupChat(user1,user2){ // user1 = inviter, user2 = invited
                
    //  1. disconnect invited/user2 from his or her current peers
    leaveCurrentChat(user2);

    //  2. connect user2 to user1's peers 
    
    // prepare notification message 
    var msg = {};
    msg['from'] = 'SERVER';
    msg['content'] = user1 + ' added ' + user2 + ' to this conversation.';

    for (var i = 0; i < dir[user1].peers.length; i++){
        
        var username = dir[user1].peers[i]; 
        
        // cross-update subscribers lists
        dir[user2].peers.push(username); 
        dir[username].peers.push(user2);

        // notify peer
        dir[username].socket.emit('message', msg);
    }

    // 3. finally, pair user1 and user2
    dir[user2].peers.push(user1);
    dir[user1].peers.push(user2);
}

function getTimeStamp() {
  var d = new Date();

  var s =
    leadingZeros(d.getFullYear(), 4) + '-' +
    leadingZeros(d.getMonth() + 1, 2) + '-' +
    leadingZeros(d.getDate(), 2) + ' ' +

    leadingZeros(d.getHours(), 2) + ':' +
    leadingZeros(d.getMinutes(), 2) + ':' +
    leadingZeros(d.getSeconds(), 2);

  return s;
}

function leadingZeros(n, digits) {
  var zero = '';
  var i;
  n = n.toString();

  if (n.length < digits) {
    for (i = 0; i < digits - n.length; i++)
      zero += '0';
  }
  return zero + n;
}
