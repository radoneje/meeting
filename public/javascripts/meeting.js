window.onload=async ()=> {
var dt=await axios.get('/rest/api/info/'+eventid+"/0")
    console.log(dt.data);
    if(!dt.data)
        return document.location.href="/login/"+eventid+"?redirect="+encodeURI('/meeting/'+eventid+"/"+meetRoomid);
    var user=dt.data;
    var WowzaCfg=null;
    var BitrateCfg=null;
    console.log("user", user)
    var app=new Vue({
        el:"#app",
        data:{
            sect:[
                {title:"Лента", isActive:false, id:0, logo:'/images/logofeed.svg', logoactive:'/images/logofeeda.svg'},
                {title:"Чат", isActive:true, id:2, logo:'/images/logochat.svg', logoactive:'/images/logochatactive.svg'},
                {title:"Люди", isActive:false, id:3, logo:'/images/logousers.svg', logoactive:'/images/logousersa.svg'},
                {title:"Файлы", isActive:false, id:7, logo:'/images/logofiles.svg', logoactive:'/images/logofilesa.svg'}
            ],
            constraints:null,
            activeSection:2,
            eventRooms:[],
            noWebrtc:false,
            videos:[],
            firstConnect:true,
            user:user,
            isMyDtShow:false,
            isMyMute:false,
            isMyVideoEnabled:false,
            myTracks:[],

        },
        methods:{
            sectActive:function (item) {
                var _this=this;
                this.sect.forEach(function (e) {

                    e.isActive=(item.id==e.id);
                    if(e.isActive)
                        _this.activeSection=e.id
                    // return e;
                })
            },
            hideDesktop:function(){
                var _this=this;
                var v=_this.videos.filter(r=>r.isMyVideo && r.isDesktop);
                if(v.length>0)
                {

                    _this.isMyDtShow=false;
                    socket.emit("closeStream", {streamid:v[0].streamid});
                }


            },
            myVideoMute:function(){
                var _this=this;
                var els=_this.videos.filter(r=>r.isMyVideo && !r.isDesktop)
                if(els.length==0)
                    return;
                var item=els[0];
                var tracks=item.stream.getTracks();
                _this.isMyMute=!_this.isMyMute;
                tracks.forEach(tr=>{
                    if(tr.kind=="audio") {
                        //tr.muted = _this.isMyMute;
                        tr.enabled = !_this.isMyMute;
                        console.log("find",tr)

                    }
                })

            },
            myVideoBlack:function(){
                var _this=this;
                var els=_this.videos.filter(r=>r.isMyVideo && !r.isDesktop)
                console.log("myVideoBlack", els)
                if(els.length==0)
                    return;
                var item=els[0];
                _this.isMyVideoEnabled=!_this.isMyVideoEnabled;
                item.tracks.forEach(tr=>{
                    if(tr.kind=="video") {
                        tr.enabled = !_this.isMyVideoEnabled;
                    }
                })

            },
            showDesktop:async function () {
                var _this=this;
                var stream = await  navigator.mediaDevices.getDisplayMedia({ video: true,audio: false});
                var videoItem={id:1, isMyVideo:true, isDesktop:true, user:user}
                this.videos.push(videoItem)

                setTimeout(async ()=>{
                    videoItem.elem=document.getElementById('video_'+videoItem.id);


                    videoItem.elem.srcObject=stream;
                    videoItem.stream=stream;
                    videoItem.streamid=socket.id+"Dt";
                    videoItem.elem.onplay=async ()=>{};
                    stream.addEventListener('inactive', e => {
                        _this.isMyDtShow=false;
                        socket.emit("closeStream", {streamid:videoItem.streamid});
                    });

                    publishVideoToWowza(videoItem.streamid,videoItem.stream,WowzaCfg.data, BitrateCfg.data,
                        (ret)=>{
                            console.log("my Desktop Published", ret)
                            videoItem.peerConnection=ret.peerConnection;
                            _this.isMyDtShow=true;
                            setTimeout(()=> {
                                socket.emit("newStream", {
                                    user: user,
                                    isDesktop: true,
                                    meetid: meetRoomid,
                                    streamid: ret.streamid
                                });

                            }, 0);
                        } ,
                        (err)=>{console.warn("wowza publish err", err)})


                },0);
            }


        },

        mounted:function () {
            var _this=this;
            document.getElementById("app").style.opacity=1;

            var serverUrl;
            var scheme = "http";
            if (document.location.protocol === "https:") {
                scheme += "s";
            }


            var videoItem={id:0, isMyVideo:true, user:user}
            this.videos.push(videoItem)
            setTimeout(async ()=>{

            },0);

            serverUrl = document.location.protocol + "//" + myHostname;//+"/meeting/socket";
            console.log('Connecting to server:' + serverUrl, { path: '/meeting/socket'});
            socket = io(serverUrl, { path: '/meeting/socket'});
            socket.on('connect', async() =>{
                console.log('connect success');
                _this.emit=function (type, data, ) {
                    socket.emit(type, data);
                }
                if(_this.firstConnect){
                     WowzaCfg=await axios.get('/rest/api/meetWowza')
                     BitrateCfg=await axios.get('/rest/api/meetBitrate')

                    _this.firstConnect=false;

                    socket.emit("hello",{userid:user.id, meetid:meetRoomid})
                    var dt= await axios.get('/rest/api/constraints');
                    _this.constraints=dt.data;
                    videoItem.streamid=socket.id;
                    videoItem.elem=document.getElementById('video_'+videoItem.id);
                    var stream = await  navigator.mediaDevices.getUserMedia(_this.constraints);


                 //   videoItem.elem.onplay=async ()=>{
                        videoItem.tracks=stream.getTracks();
                        var newStream= new MediaStream();
                        videoItem.tracks.forEach(t=>newStream.addTrack(t))
                        videoItem.stream=newStream;
                        videoItem.elem.srcObject=newStream;
                        publishVideoToWowza(videoItem.streamid,videoItem.stream,WowzaCfg.data, BitrateCfg.data,
                            (ret)=>{
                            console.log("my Stream Published", ret)
                                videoItem.peerConnection=ret.peerConnection;
                                setTimeout(()=> {
                                    socket.emit("newStream", {
                                        user: user,
                                        isDesktop: false,
                                        meetid: meetRoomid,
                                        streamid: ret.streamid
                                    });
                                    socket.emit("getMeetingVideos");
                                }, 0);
                                

                        } ,
                            (err)=>{console.warn("wowza publish err", err)})
                //    }
                    socket.on('newStream', async(data) =>{
                        console.log('OnNewStream', data, _this.videos)

                        if(meetRoomid!=data.meetid)
                            return; //видео чужих комнат

                        var  ff=_this.videos.filter(v=>v.streamid==data.streamid)
                        if(ff.length>0)
                            return;//убираем повтор моего видео

                        var receiverItem={id:data.streamid, isMyVideo:false, user:data.user, streamid:data.streamid}
                        this.videos.push(receiverItem)
                        setTimeout(async ()=>{
                            receiverItem.elem=document.getElementById('video_'+receiverItem.id);
                            getVideoFromWowza(receiverItem, WowzaCfg.data, BitrateCfg.data,
                                 (ret)=> {
                                     receiverItem.peerConnection=ret.peerConnection;
                                     receiverItem.peerConnection.onconnectionstatechange=(event)=>{
                                         var cs=receiverItem.peerConnection.connectionState
                                         if(cs=="disconnected" || cs=="failed" || cs=="closed")
                                         {
                                             _this.videos=_this.videos.filter(v=>v.streamid !=data.streamid)
                                         }

                                     }
                                     },
                                (data)=> {
                                    console.warn("receiver err")
                                })
                        },3000);


                    })

                    socket.on('closeStream', async(data) =>{
                        console.log("closeStream");
                        var v=_this.videos.filter(v=>v.streamid !=data.streamid)
                        if(v.length==0)
                            return;
                        var videoItem=v[0];
                        if(videoItem.peerConnection) {
                            videoItem.peerConnection.close();
                            videoItem.peerConnection = null;
                        }
                        _this.videos=_this.videos.filter(r=>r.streamid!==videoItem.streamid);

                    })
                    socket.on('userDisconnnect', async(data) =>{
                        console.log('userDisconnnect', data);
                        _this.videos=_this.videos.filter(v=>v.streamid !=data.streamData.streamid)
                    })


                }
            });



        }
    })

}



