// TODO be consistent with use of quotation marks (choose single quotes over double)
// TODO this file has too many scripts: use a separate .js file. (ideally, for the styling as well)

// TODO use a unique background color for each user's messages!
// TODO Show list of conversation peers  in side pannel
// TODO implement scrolling in lobby (userlist) or make sure server always limits the number of users to what's visible

////////////////////////// MOBILE  MENU /////////////////////////////
 var chk_send = 0;
		jQuery(document).ready(function () {

			//Open the menu
			jQuery("#hamburger").click(function () {

				jQuery('#content').css('min-height', jQuery(window).height());

				jQuery('nav').css('opacity', 1);

				//set the width of primary content container -> content should not scale while animating
				var contentWidth = jQuery('#content').width();

				//set the content with the width that it has originally
				jQuery('#content').css('width', contentWidth);

				//display a layer to disable clicking and scrolling on the content while menu is shown
				jQuery('#contentLayer').css('display', 'block');

				//disable all scrolling on mobile devices while menu is shown
				jQuery('#container').bind('touchmove', function (e) {
					e.preventDefault()
				});
                if(chk_send ==0){
				//set margin for the whole container with a jquery UI animation
				jQuery("#container").animate({"marginLeft": ["40%", 'easeOutExpo']}, {
					duration: 50
				});
				chk_send = 1;
                }else{
                //enable all scrolling on mobile devices when menu is closed
				jQuery('#container').unbind('touchmove');

				//set margin for the whole container back to original state with a jquery UI animation
				jQuery("#container").animate({"marginLeft": ["-1", 'easeOutExpo']}, {
					duration: 700,
					complete: function () {
						jQuery('#content').css('width', 'auto');
						jQuery('#contentLayer').css('display', 'none');
						jQuery('nav').css('opacity', 0);
						jQuery('#content').css('min-height', 'auto');
					}
					});  	
					chk_send = 0;
                }

			});

		});
/////////////////////////////// MOBILE MENU //////////////////////////
var MAX_UPLOAD_SIZE = 1.5; // in MB

var socket = io.connect('http://ec2-13-124-136-97.ap-northeast-2.compute.amazonaws.com:3000'); 

var my_username;


//  A   SIGN IN
// prompts and sets username, then sends it to server
signIn(1);

socket.on('name taken', function(){
    signIn(2);
});

function signIn(attempt){
    
    if (attempt === 1){ 
        my_username = prompt("이름을 입력하시오.");
    }
    else {
        my_username = prompt('\"'+ my_username + '\"은 불가능합니다. \n 다른 이름을 입력하세요');
    }
    // TODO: limit username length to something reasonable (that won't break the display)
    // TODO: limit character set to letters,numbers and spaces/underscore/dash/etc. But no '\'. 
    
    //  check that username is valid: /\S/ checks that there is at least one none blank character in the name provided
    while (my_username === null || my_username === '' || !(/\S/.test(my_username)) ) {

        if ( !(/\S/.test(my_username)) ) {

            my_username = prompt("빈칸을 이름으로 할 수 없어요 \n 다시 이름을 입력해주세요");
        }
        else
        {
            my_username = prompt("이름 없이 접근할 수 없습니다.\n 다시 이름을 입력해주세요.");
        }
    }
    socket.emit('sign in', my_username);
    $('#myName').empty();
	$('#myName').append('<strong>'+my_username+'</strong> 님');
	//$('#userTitle').append('Name : '+my_username);
}


//  B   UPDATE LOBBY (automatic upon signing in)
//      lobby = list of online users
socket.on('update lobby', function(users_list,total_users){
    
    $('#users').empty(); // clean lobby

    //  add users to lobby 
    for(var i=0; i < users_list.length; i++){
        if(users_list[i] != my_username) 
        $('#users').append($('<li draggable="true" ondragstart="drag(event)">').text(users_list[i]));
    }
    // refresh the number of users signed in
    $('#tally').empty();
    $('#tally').append(total_users +'명 접속중');  
});


//  C   SEARCH  USERS
// search for other users online (refreshed for every keystroke in search box event) 
$("#search").on("input", function() {
    socket.emit('search',$('#search').val()); // emit search event and pass query/content of search box
});

$('#searchfriend').submit(function(){
    return false;
});


//  D   SEND A CHAT INVITE
//       Drag and drop someone's name in order to send him/her an invite  
function drop(ev,type) { 
    ev.preventDefault();

    var peer_username = ev.dataTransfer.getData("text"); // drag and drop transfers username
    var invite = {}; 

    invite['type'] = type; // type = 'new' or 'current' (chat with this user only, or add user to current chat) 
    invite['to'] = peer_username;
    invite['from'] = my_username; 

    socket.emit('invite', invite); // send invite to chat
}

// functions to enable drag and drop
function allowDrop(ev) {
    ev.preventDefault();
}

function drag(ev) {
    ev.dataTransfer.setData("text", ev.target.innerHTML); // sets username contained in dragged element as transfer data
}


//   E    RSVP TO CHAT INVITE 
//      User gets a chat invite from another user. User sends back yes/no reply (rsvp).
socket.on('invite', function(invite){ // e.g.: invite = {'to':'Nikolay','from':'Ben','type':'new' }  
     
    var rsvp = {}; 
    rsvp['to'] = invite['from']; // swap to and from fields
    rsvp['from'] = invite['to'];
    rsvp['type'] = invite['type'];// server needs to know the invite type to choose the appropriate chat setup procedure

    // prompt user to either accept or turn down the invite 
    // TODO use invite['type'] to tell user if invited to a private or group chat
    // TODO make names bold to make them more readable 
    
    if ( confirm('\"' + invite['from'] + '\"님에게 초대요청이 들어왔습니다. \n 초대에 응하시겠습니까?')) {
    
        rsvp['rsvp'] = true; 
        // TODO: add list of peers to invite, and append to msg board "You are now talking to: [updated list of peers] " 
        $('#userTitle').empty();
	    $('#userTitle').append(invite['from']);
    
    } 
    else 
    {
        rsvp['rsvp'] = false; 
    }
    socket.emit('rsvp', rsvp); // send rsvp to be processed by server
    // ('rsvp' socket event, rsvp associative array, and rsvp.rsvp = true/false. RSVPs everywhere...) 
});

//  F   RECEIPT OF RSVP
socket.on('rsvp', function(rsvp){
    
    if (rsvp['rsvp'] === true){
  
        //alert('\"'+ rsvp['from'] +'\"님께서 당신의 초대에 승낙하셨습니다. ^^');
        /// add
       $('#userTitle').empty();
       $('#messages').empty();
       
       if(my_username != rsvp['from'])
       $('#userTitle').append(rsvp['from']);
       else $('#userTitle').append(rsvp['to']);
		for(var i in rsvp['message']){
			if(rsvp['message'][i].USER_ID == my_username){
				 $('#messages').append('<div class="spc spc1"> <div class="bx pic">'+rsvp['message'][i].MSG_DESC+'</div><div class="time">'+ rsvp['message'][i].REG_TM+'</div></div>' );
			}else {
				$('#messages').append('<div class="spc spc2"> <div class="name">'+rsvp['message'][i].USER_ID + '</div> <div class="bx">' + rsvp['message'][i].MSG_DESC + '</div><div class="time">'+rsvp['message'][i].REG_TM+'</div></div>');
			}
		}
  
    } 
    else 
    {
        alert('\"'+ rsvp['from'] + '\"님께서 당신의 초대에 거절하셨습니다 ㅜㅜ');
       
    } 
    	
});    


function leadingZeros(n, digits) {
  var zero = '';
  n = n.toString();

  if (n.length < digits) {
    for (i = 0; i < digits - n.length; i++)
      zero += '0';
  }
  return zero + n;
}

//  G   SEND MESSAGE 
$(function(){
    $('#sendmessage').click(function(){
    
    var d = new Date();
    // send message to server
    var data = $('#m').val();
    socket.emit('message', data);
    // append user's own message directly to his/her chat window
    $('#messages').append('<div class="spc spc1"> <div class="bx pic">'+data+'</div><div class="time">'+leadingZeros(d.getHours(),2)+':'+leadingZeros(d.getMinutes(),2)+'</div></div>' );
    scrollDown();
    
    $('#m').val(''); // reset message input box
    return false;    // sothat the page doesn't reload
    }); 
		// when the client hits ENTER on their keyboard
		$('#m').keypress(function(e) {
			if(e.which == 13) {
			    
				$('#sendmessage').click();
				
			}
		});
});

// H  RECEIVE MESSAGE
// -- displays received message into chat window
// -- can be from either a chat message or a notification from the server 
socket.on('message', function(msg){
    // TODO: assign a different color to each user

    var d = new Date();
    if(msg['from'] === 'SERVER')
    {
        // use italics for server notifications to make them stand out
        var notification =  msg['content'].italics();
        notification =  msg['from'] + ' :\t' + notification;
        $('#messages').append('<div class="spc spc2"> <div class="name">SERVER</div> <div class="bx">' + notification + '</div> <div class="time">'+leadingZeros(d.getHours(),2)+':'+leadingZeros(d.getMinutes(),2)+'</div> </div>');
    }
    else
    {
        $('#messages').append('<div class="spc spc2"> <div class="name">'+msg['from'] + '</div> <div class="bx">' + msg['content'] + '</div><div class="time">'+leadingZeros(d.getHours(),2)+':'+leadingZeros(d.getMinutes(),2)+'</div></div>');
    }
    scrollDown();
});


// I    SHARE FILE
// source: http://www.sitepoint.com/html5-file-drag-and-drop/
var imageReader = new FileReader();
var videoReader = new FileReader();
var file;

$('#fileselect').change(function(e){
    
    // get file object from file selector input
    file = e.target.files[0];   
    $('#upload').submit();
});


$('#upload').submit(function(){

    if (file){
   
        if (file.type.substring(0,5) === 'image' || file.type.substring(0,5) === 'video'){
        
            if (file.size > MAX_UPLOAD_SIZE * 10000 * 10000)
            {
                alert('Sorry, we can only accept files up to ' + MAX_UPLOAD_SIZE + ' MB');
            }
            else if (file.type.substring(0,5) === 'image'){
                
                // upload image  
                imageReader.readAsDataURL(file);
            }
            else if (file.type.substring(0,5) === 'video'){
                
                // uplaod video  
                videoReader.readAsDataURL(file);
            }
        }
        else {
            alert("Sorry, you an only share images or videos");
        }

        // reset select box and file object 
        $('#fileselect').val('');
        file = '';
    }
    else
    {
        alert("You haven't selected any file to share");
    }
    
    return false; // don't reload the page
});


imageReader.onload=function(e){
    
    // append image to own interface
    appendFile(e.target.result,'image','self');
    scrollDown();
    
    // share image
    // TODO try stream?
    socket.emit('file',e.target.result,'image');
};

videoReader.onload=function(e){
    
    // append video to own interface
    appendFile(e.target.result,'video','self');
    scrollDown();
    
    // share video
    socket.emit('file',e.target.result,'video');
};

socket.on('file', function(dataURI,type,from){
    
    appendFile(dataURI,type,from);
    scrollDown();

});


// TODO P2P connection setup

// I've fiddled around with setting up a p2p connection
// I tried isntantiating 1 new socket on each side
// Here, I'm trying to add another connection to the same sockets 
// (docs say they support multiplexing, however that not mean different origins)
// At best I get a "connection refused error" because of same origin policy (Firefox)

// P2P Initiator
socket.on('initiate p2p',function(ip,port){
    
    // if defined, append port # to the ip address  
    if (port !== '') peer_ip = ip + ':' + port;

    console.log('Attempting a P2P connection to: ' + peer_ip);

    socket = io.connect(peer_ip,{'force new connection':true} );// try pssing this option { 'force new connection':true }
    
    p2p_socket.on('connect', function(){
        alert(my_username + ' successfully started a p2p connection with ' + peer_ip );
        
    });
});
socket.on('receive p2p',function(){
    
    console.log('Awaiting a P2P connection...');

    socket.on('connect', function(){
        alert("Client is connected to peer");
    }); 
    
});
///////

// User Diconnected Error 
socket.on('disconnect',function(){
    
    notification = 'SERVER:\t You have been disconnected'.italics();
    $('#messages').append('<li>' + notification + '</li>');
});

// Appends either an image or a video file to user's chat window
function appendFile(URI,type,user){
    
    if (user === 'self'){
     
        if (type === 'image'){
        $('#messages').append('<div class="spc spc1"> <div class="bx img"><img src="' + URI + '" height="200px" /></div></div>');
    }
    else {
        $('#messages').append('<div class="spc spc1"> <div class="bx img"><video width="320" height="240" controls><source src="' + URI + '"></div></div>');
    }
    
    
    }
    
    else {
        
        if (type === 'image'){
        $('#messages').append('<div class="spc spc2"> <div class="name">'+user+ '</div> <div class="bx img"><img src="' + URI + '" height="200px" /></div></div>');
    }
    else {
        $('#messages').append('<div class="spc spc2"> <div class="name">'+user+ '</div> <div class="bx img"><video width="320" height="240" controls><source src="' + URI + '"></dir></dir>');
    }
    
    }

}
// Autoamtic scroll down message on any kind of chat message (text or file)
function scrollDown(){
   // $('#chat').animate({scrollTop: $('#chat').prop("scrollHeight")}, 500); 
   window.scrollTo(0, document.body.scrollHeight);
}


////////////////////////// slide menu //////////////////////////////////////////////
 
      $(window).ready(function(){

	// toggle box show/hide control
	function tg_control(){
		$('.toggle_bx').each(function(){
			var a = $(this).find('.tg_tit');
			a.on('click',function(){
				var that = $(this).parent('.toggle_bx');
				var view = that.find('.tg_view');
				if(that.hasClass('on')){
					view.slideUp();
					that.removeClass('on');
				}else{
					view.slideDown();
					that.addClass('on');
				}
			})
		})
	}tg_control();

	function tg2(){
		$('.schedule_list>li .total').on('click',function(){
				var that = $(this);
				var view = that.next('.detail');
				if(that.hasClass('on')){
					view.slideUp();
					that.removeClass('on');
				}else{
					that.addClass('on');
					view.slideDown();
				}
			})
	}tg2();
	function tab(){
		$('.tab a').on('click',function(){
				var that = $(this).parent('li');
				var view = that.parents('.tab').next('.tab_view').find('.view');
				var idx = that.index();
				that.addClass('on').siblings().removeClass('on');
				view.eq(idx).addClass('on').siblings().removeClass('on');
			})
	}tab();

	// navmenu : 모바일 네비게이션
	function navmenu(obj){
		// dim
		var $ct = $('#wrap');
		var $dim = $('.dim');

		// menu open/close
		$('.openMenu').click(function(e) {
			e.preventDefault();
			$('._nav').css({'left': '0px',
				'transform': 'translateX(0) translateY(0px)'
			});
			$dim.fadeIn();
			$ct.addClass('ct_fix');
			
		});
		$('.closeMenu').click(function(e) {
			e.preventDefault();
			$('._nav').css({'left': '-100%',
				'transform': 'translateX(0) translateY(0px)'
			});
			$dim.fadeOut();
			$ct.removeClass('ct_fix');
			window.scrollTo(0, document.body.scrollHeight);
		});
	}navmenu();

	// 2017-06-18 추가
	function btn_del() {
		$('input.txt').each(function(){
			var tt = $(this);
			if (! tt.val() == "" ) {
				tt.addClass('active');
			}
		})
		$('input.txt').on("focusin click", function(){
			var tt = $(this).parent();
			tt.find(".btn_del").show();
		})
		$('input.txt').on("focusout", function(){
			var tt = $(this).parent();
			if (tt.find("input").val() == "" ) {
				tt.find(".btn_del").hide();
				tt.find("input").removeClass('active');
			}else{
				tt.find("input").addClass('active');
			}
		});
		$('.btn_del').on("click", function(){
			var tt = $(this).parent();
			if (! tt.find("input").val() == "" ) {
				tt.find("input").val("").focus();
			}
		});
	}btn_del();

	// 2017-06-18 추가
	function swipe_list(){
		$('.swipe_list .dtl_list li .swipe').on('swiperight',function(){
			var swipe = $(this);
			var hidebx = swipe.prev('.hide_st');
			swipe.addClass('right');
			hidebx.css({
				'left':'0',
				'transition-duration':'0.3s'
			});
			swipe.css({
				'transform':'translate3d(60px, 0px, 0px)',
				'transition-duration':'0.3s'
			});
		})
		$('.swipe_list .dtl_list li .swipe').on('swipeleft',function(){
			var swipe = $(this);
			var hidebx = swipe.prev('.hide_st');
			if(swipe.hasClass('right')){
				swipe.css({
					'transform':'translate3d(0, 0px, 0px)',
					'transition-duration':'0.3s'
				});
				hidebx.css({
					'left':'-60px',
					'transition-duration':'0.3s'
				});
				swipe.removeClass('right');
			}
		})
	}swipe_list()
})

//마스크 띄우기
function wrapWindowByMask() { 

	var mask = $("#lay_mask");

	//화면의 높이와 너비를 구한다. 
	var maskHeight = $(document).height();
	var maskWidth = $(window).width();

	//마스크의 높이와 너비를 화면 것으로 만들어 전체 화면을 채운다. 
	mask.css({'width':maskWidth,'height':maskHeight});
	mask.show();
}
// 사이즈 리사이징
function ResizingLayer() {
	if($(".PopupLayer").css("visibility") == "visible") {
		//화면의 높이와 너비를 구한다. 
		var maskHeight = $(document).height();
		var maskWidth = $(window).width();

		//마스크의 높이와 너비를 화면 것으로 만들어 전체 화면을 채운다. 
		$("#lay_mask").css({'width':maskWidth,'height':maskHeight});
		//$('#header').css({'width':maskWidth}); // 20131119 최창원 수정 헤더의 넓이 값을 우선 빼 봤음.

		$(".PopupLayer").each(function () {
			var left = ( $(window).scrollLeft() + ($(window).width() - $(this).width()) / 2 );
			var top = ( $(window).scrollTop() + ($(window).height() - $(this).height()) / 2 );

			if(top<0) top = 0;
			if(left<0) left = 0;
			
			$(this).css({"left":left, "top":top});
		});
	}
	// 퀵메뉴 팝업
	if($("#pop_setting1").css("visibility") == "visible") {
		//화면의 높이와 너비를 구한다. 
		var maskHeight = $(document).height();
		var maskWidth = $(window).width();

		//마스크의 높이와 너비를 화면 것으로 만들어 전체 화면을 채운다. 
		$("#lay_mask").css({'width':maskWidth,'height':maskHeight});
		//$('#header').css({'width':maskWidth}); // 20131119 최창원 수정 헤더의 넓이 값을 우선 빼 봤음.

		$("#pop_setting1").each(function () {
			var left = ( $(window).scrollLeft() + ($(window).width() - $(this).width()) / 2 );
			var top = ( $(window).scrollTop() + 20 + "px" );

			if(top<0) top = 0;
			if(left<0) left = 0;

			$(this).css({"left":left, "top":top});
		});
	}
}

window.onresize = ResizingLayer;
//레이어 가운데 띄우고 마스크 띄우기
function toggleLayer( obj, s ) {

	var zidx = $("#lay_mask").css("z-index");
	if(s == "on") {
		//화면중앙에 위치시키기
		var left = ( $(window).scrollLeft() + ($(window).width() - obj.width()) / 2 );
		var top = ( $(window).scrollTop() + ($(window).height() - obj.height()) / 2 );
		
		// 높이가 0이하면 0으로 변경
		if(top<0) top = 0;
		if(left<0) left = 0;

		if($(".PopupLayer").length > 1) {
			var layer_idx = Number(zidx) + 10;
		}

		$("#lay_mask").css("z-index", layer_idx);
		// console.log('on일경우 '+ $("#lay_mask").css('z-index'))
		obj.css({"left":left, "top":top, "z-index":layer_idx}).addClass("PopupLayer");
		$("body").append(obj);

		wrapWindowByMask();//배경 깔기
		//obj.show();//레이어 띄우기
		obj.css('visibility','visible');//레이어 띄우기
		obj.css('overflow','visible');
		obj.css({"left":left, "top":top});
	}

	if(s == "off") {
		if($(".PopupLayer").length > 1) {
			//var layer_idx = zidx - 10;
			//$("#lay_mask").css("z-index", layer_idx);
			// console.log('off일경우 '+ $("#lay_mask").css('z-index'))
		} else {
			$("#lay_mask").hide();
			
			
		}

		obj.removeClass("PopupLayer").css('visibility','hidden');
		obj.css('top','-9999px');
	}

	if(s == "off2") { //레이어에서 다른 레이어를 띄울 경우 마스크는 안닫기 위한 처리
		obj.removeClass("PopupLayer").css('visibility','hidden');
		
	}
}