window.onload=async ()=> {
var dt=await axios.get('/rest/api/info/'+eventid+"/0")
    console.log(dt.data);
    if(!dt.data)
        return document.location.href="/login/"+eventid+"?redirect="+encodeURI('/meeting/'+eventid+"/"+meetRoomid);
    var user=dt.data;
    var WowzaCfg=null;
    var BitrateCfg=null;
    var arrVideo=[];
    var app=new Vue({
        el:"#app",
        data:{
            sect:[
                {title:"Лента", isActive:false, id:0, logo:'/images/logofeed.svg', logoactive:'/images/logofeeda.svg'},
                {title:"Чат", isActive:true, id:2, logo:'/images/logochat.svg', logoactive:'/images/logochatactive.svg'},
                {title:"Люди", isActive:false, id:3, logo:'/images/logousers.svg', logoactive:'/images/logousersa.svg'},
              //  {title:"Файлы", isActive:false, id:7, logo:'/images/logofiles.svg', logoactive:'/images/logofilesa.svg'}
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
            eventRooms:[],
            chat:[],
            chatText:'',
            users:[],

        },
        methods:{
            meetchatTextOnPaste:function(e){
                var _this=this;
                var items = event.clipboardData.items;
                if(items == undefined)
                    return;

                for (var i = 0; i < items.length; i++) {
                    if (items[i].type.indexOf("image") == -1) continue;
                    if (items[i].kind === 'file') {
                        _this.uploafFilesToChat(items[i].getAsFile())
                    }
                }
            },
            chatFileClick:function()
            {
                var _this=this;
                var elem= document.createElement("input");
                elem.type="file"
                elem.style.display="none";
                elem.accept="video/*;capture=camcorder";
                elem.onchange=function(){
                    _this.uploafFilesToChat(elem.files[0], function () {
                        elem.parentNode.removeChild(elem)
                    })

                }
                document.body.appendChild(elem);
                elem.click();
            },
            uploafFilesToChat:function(file,  clbk){
                var _this=this;
                if(!(file.type.indexOf('image/')==0 ||file.type.indexOf('video/')==0 ))
                    return  alert("Можно загрузить только фото или видео")
                var fd = new FormData();
                fd.append('file', file );

                var xhr = new XMLHttpRequest();
                var progressElem=document.querySelector(".fileLoadProgress")
                xhr.upload.onprogress = function(event) {
                    console.log(parseFloat(event.loaded/event.total));
                    if(progressElem)
                        progressElem.style.width=parseFloat(event.loaded/event.total)*100+"%"
                }
                xhr.onload = xhr.onerror = function() {

                    if (this.status == 200) {
                        setTimeout(function () {
                            var ret=JSON.parse(xhr.response)
                            console.log("chatFileUpload",ret.id)
                            socket.emit("chatFileUpload",{id:ret.id, meetid:meetid});
                            var objDiv = document.getElementById("chatBox");
                            objDiv.scrollTop = objDiv.scrollHeight;
                            _this.chatText="";
                        }, 100)
                        setTimeout(()=>{
                            var progressElem=document.querySelector(".fileLoadProgress")
                            if(progressElem)
                                progressElem.style.width=0;
                        }, 4*1000)
                    } else {
                        if(progressElem) {
                            progressElem.style.width = "100%";
                            progressElem.classList.add('error')
                        }
                        setTimeout(()=>{
                            var progressElem=document.querySelector(".fileLoadProgress")
                            if(progressElem) {
                                progressElem.style.width = 0;
                                progressElem.classList.remove('error')
                            }
                        }, 4*1000)
                        console.warn("error " + this.status);
                    }
                    if(clbk)
                        clbk(this.status)
                };
                xhr.open("POST", '/rest/api/meetfileUpload/'+eventid+"/"+meetRoomid+"/"+user.id,true, );
                //xhr.setRequestHeader("Content-Type", "multipart/form-data")
                xhr.setRequestHeader("X-data", encodeURI( JSON.stringify({name:file.name||"",type:file.type})))

                xhr.send(fd);


            },
            meetchattextChange:function(e){
                if(e.keyCode==13 && this.chatText.length>0){
                    this.meetChattextSend(this)
                }
            },
            meetChattextSend:function(){
                if(this.chatText.length>0)
                socket.emit("chatAdd", {text:this.chatText, meetid:meetRoomid});
                this.chatText='';

            },
            chatAddSmile:function () {
                this.chatText+=" :) ";
                document.getElementById("chatText").focus();
            },
            sectActive:function (item) {
                var _this=this;
                this.sect.forEach(function (e) {

                    e.isActive=(item.id==e.id);
                    if(e.isActive)
                        _this.activeSection=e.id
                    // return e;
                })
                if(window.innerWidth<1024)
                    setTimeout(function () {
                        window.scrollTo(0,document.body.scrollHeight);
                    },0)
            },
            hideDesktop:function(){
                var _this=this;
                var v=arrVideo.filter(r=>r.isMyVideo && r.isDesktop);
                if(v.length>0)
                {

                    _this.isMyDtShow=false;
                    socket.emit("closeStream", {streamid:v[0].streamid});
                }


            },
            myVideoMute:function(){
                var _this=this;
                var els=arrVideo.filter(r=>r.isMyVideo && !r.isDesktop)
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
                var els=arrVideo.filter(r=>r.isMyVideo && !r.isDesktop)
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
                var videoItem={id:2, isMyVideo:true, isDesktop:true, user:user}
                arrVideo.push(videoItem)

                setTimeout(async ()=>{


                    videoItem.stream=stream;
                    videoItem.streamid=socket.id+"Dt";
                    videoItem.id=socket.id+"Dt";
                    await createVideo(videoItem.id, true, user)
                    videoItem.elem=document.getElementById('video_'+videoItem.id);
                    videoItem.elem.srcObject=stream;

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

        mounted:async function () {
            var _this=this;
            document.getElementById("app").style.opacity=1;

            axios.get("/rest/api/eventRooms/"+eventid+"/"+0)

                .then(function (r) {
                    console.log("eventRooms", r.data)
                    _this.eventRooms = r.data;
                });

            var serverUrl;
            var scheme = "http";
            if (document.location.protocol === "https:") {
                scheme += "s";
            }


            var videoItem={id:0, isMyVideo:true, user:user}
            arrVideo.push(videoItem)
            var video= await createVideo(videoItem.id,videoItem.isMyVideo, user);
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
                    try {
                        var stream = await navigator.mediaDevices.getUserMedia(_this.constraints);
                        videoItem.elem.srcObject = stream;

                        setTimeout(async () => {
                            videoItem.tracks = stream.getTracks();
                            var newStream = new MediaStream();
                            videoItem.tracks.forEach(t => {
                                if (t.kind == "audio") newStream.addTrack(t)
                            })
                            var videoTrack = videoItem.tracks.filter(t => t.kind == "video")[0]
                            videoItem.stream = newStream;

                            videoItem.audioElem = document.getElementById('meetVideoLevel' + videoItem.id)
                            videoItem.analiser = await createAudioAnaliser(newStream, (val) => {
                                // console.log(val, parseFloat((val/100)*100));
                                videoItem.audioElem.style.height = parseFloat((val / 100) * 100) + "%"
                            })

                            var canvas = document.createElement("canvas");
                            canvas.width = 16 * 30;
                            canvas.height = 9 * 30;
                            /* canvas.style.position="fixed"
                             canvas.style.top="0"
                             canvas.style.zIndex="10000"
                             document.body.appendChild(canvas)*/

                            var context = canvas.getContext('2d');
                            var imgElem = document.createElement("img")
                            imgElem.src = "/images/camera.svg"
                            //document.body.appendChild(imgElem)
                            draw(videoItem.elem, context, videoTrack, imgElem)
                            var canvasStream = await canvas.captureStream(30)
                            var canvasTracks = canvasStream.getTracks()

                            canvasTracks.forEach(t => {
                                if (t.kind == "video") newStream.addTrack(t)
                            })


                            publishVideoToWowza(videoItem.streamid, videoItem.stream, WowzaCfg.data, BitrateCfg.data,
                                (ret) => {
                                    //   console.log("my Stream Published", ret)
                                    videoItem.peerConnection = ret.peerConnection;
                                    setTimeout(() => {
                                        socket.emit("newStream", {
                                            user: user,
                                            isDesktop: false,
                                            meetid: meetRoomid,
                                            streamid: ret.streamid
                                        });
                                        socket.emit("getMeetingVideos");
                                    }, 3000);


                                },
                                (err) => {
                                    console.warn("wowza publish err", err)
                                })
                        }, 100)
                    }
                    catch (e) {
                        console.log("no local video allowed");
                        setTimeout(()=>{
                            socket.emit("getMeetingVideos");
                        }, 1000);

                    }


                //    }
                    socket.on('newStream', async(data) =>{
                        console.log('newStream',data.streamid )

                        if(meetRoomid!=data.meetid)
                            return; //видео чужих комнат

                        var  ff=arrVideo.filter(v=>v.streamid==data.streamid)
                        if(ff.length>0)
                            return;//убираем повтор моего видео

                        var receiverItem={id:data.streamid, isMyVideo:false, user:data.user, streamid:data.streamid}
                        arrVideo.push(receiverItem)
                        var video= await createVideo(data.streamid,false,data.user );
                        setTimeout(async ()=>{
                            receiverItem.elem=document.getElementById('video_'+receiverItem.id);
                            getVideoFromWowza(receiverItem, WowzaCfg.data, BitrateCfg.data,
                                 async (ret)=> {
                                     /*(receiverItem.analiser=await createAudioAnaliser(receiverItem.srcObject, (val)=>{
                                          console.log(val, parseFloat((val/100)*100));
                                         receiverItem.audioElem.style.height=parseFloat((val/100)*100)+"%"
                                     })*/

                                     receiverItem.peerConnection=ret.peerConnection;
                                     receiverItem.peerConnection.onconnectionstatechange=(event)=>{
                                         var cs=receiverItem.peerConnection.connectionState
                                         console.log("cs", receiverItem.peerConnection.connectionState)
                                         if(cs=="disconnected" || cs=="failed" || cs=="closed")
                                         {
                                             if(receiverItem.peerConnection) {
                                                 receiverItem.peerConnection.close();
                                                 receiverItem.peerConnection = null;
                                             }
                                             removeVideo(receiverItem.streamid)
                                             arrVideo=arrVideo.filter(r=>r.streamid!=receiverItem.streamid);

                                         }

                                     }
                                     },
                                (data)=> {
                                    console.warn("receiver err")
                                })
                        },3000);


                    })

                    socket.on('closeStream', async(data) =>{
                        var v=arrVideo.filter(v=>v.streamid ==data.streamid)
                        if(v.length==0)
                            return;
                        var videoItem=v[0];

                        console.warn("closeStream", data.streamid,videoItem.streamid,videoItem.id );
                        if(videoItem.peerConnection) {
                            videoItem.peerConnection.close();
                            videoItem.peerConnection = null;
                        }
                        arrVideo=arrVideo.filter(r=>r.streamid!=videoItem.streamid);
                        removeVideo(data.streamid)

                    })
                    socket.on('userDisconnnect', async(data) =>{
                        arrVideo=arrVideo.filter(v=>v.streamid !=data.streamData.streamid)
                        removeVideo(data.streamData.streamid)
                    })

                    socket.on('userLogin', async(data) =>{
                        if(_this.users.filter(u=>u.id==data.user.id).length==0)
                            _this.users.push(data.user)
                        else
                            _this.users.forEach(u=>{if(u.id==data.user.id) u.isActive=true})

                    })
                    socket.on('userLogOut', async(data) =>{
                        _this.users.forEach(u=>{if(u.id==data.user.id) u.isActive=false})
                    })
                    socket.on('chatAdd', async(data) =>{
                        console.log("chatAdd", data);

                        data.forEach(dt=>{
                            if(_this.chat.filter(c=>c.id==dt.id).length==0)
                                _this.chat.push(dt);
                        })
                        setTimeout(function () {
                            var objDiv = document.getElementById("chatBox");
                            objDiv.scrollTop = objDiv.scrollHeight;
                        },0)

                    })
                    var el=document.getElementById("app")
                    el.addEventListener('dragover', function(e) {
                        e.stopPropagation();
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'copy';
                    });
                    el.addEventListener('drop', function(e) {
                        e.stopPropagation();
                        e.preventDefault();
                        console.log("drop")
                        var files = e.dataTransfer.files; // Array of all files
                        for (var i=0, file; file=files[i]; i++) {
                            if (file.type.match(/image.*/)) {
                                _this. activeSection=2,
                                    _this.uploafFilesToQ(file, "chat")
                            }
                        }
                    });



                }
            });



        }
    })

}
function removeVideo(id){
    console.log("removeVideo", id)
    var elem=document.getElementById('meetVideoItem_'+id);
    if(elem)
        elem.parentNode.removeChild(elem)
}

async function  createVideo(id, muted, user) {
    console.log("Create Video")
    var meetVideoBox=document.getElementById("meetVideoBox");
    var meetVideoItem=document.createElement("div");
    meetVideoItem.classList.add("meetVideoItem");
    meetVideoItem.id='meetVideoItem_'+id
    var dt=await axios.get('/meeting/videoElem/'+id);
    meetVideoItem.innerHTML=dt.data;
    meetVideoBox.appendChild(meetVideoItem)
    var video=document.getElementById("video_"+id)
    if(muted)
        video.muted=true;
    var cap=document.getElementById("meetVideoCap_"+id)
    cap.innerText=(user.i || "") + " "+(user.f || "")

    var mute=document.getElementById('meetVideoMute'+id)
    var unmute=document.getElementById('meetVideoUnMute'+id)



    unmute.classList.add('btnHidden')
    mute.addEventListener('click', function (e,id ) {
           video.muted=true;
           unmute.classList.remove('btnHidden')
           mute.classList.add('btnHidden')
    })
    unmute.addEventListener('click', function (e,id ) {
            video.muted=false;
            mute.classList.remove('btnHidden')
            unmute.classList.add('btnHidden')
    })
    if(muted) {
        mute.parentNode.removeChild(mute)
        unmute.parentNode.removeChild(unmute)
    }
    document.getElementById('meetVideoFullScreen'+id).addEventListener("click", function () {

        var video=document.getElementById("video_"+id)

        if (video.requestFullscreen) {
            video.requestFullscreen();
        } else if (video.mozRequestFullScreen) {
            video.mozRequestFullScreen();
        } else if (video.webkitRequestFullscreen) {
            video.webkitRequestFullscreen();
        } else if (video.msRequestFullscreen) {
            video.msRequestFullscreen();
        } else if (video.webkitEnterFullScreen) {
            video.msRequestFullscreen();
        }

    })




    return video

}
async function createAudioAnaliser(stream, clbk) {
    try {
        audioContext = new AudioContext();
        analyser = audioContext.createAnalyser();
        microphone = audioContext.createMediaStreamSource(stream);
        javascriptNode = audioContext.createScriptProcessor(2048, 1, 1);
        analyser.smoothingTimeConstant = 0.8;
        analyser.fftSize = 1024;
        microphone.connect(analyser);
        analyser.connect(javascriptNode);
        javascriptNode.connect(audioContext.destination);
        javascriptNode.onaudioprocess = function () {
            var array = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteFrequencyData(array);
            var values = 0;
            var length = array.length;
            for (var i = 0; i < length; i++) {
                values += (array[i]);
            }
            var average = values / length;
            //console.log(Math.round(average ));
            clbk(average)
        }

        return audioContext;
    }
    catch(e){ return null}
}
function draw(v,c, videoTrack, img){



    if((!v.paused || !v.ended ) && videoTrack.enabled)
    {
        c.fillStyle = "#282D33";
        c.fillRect(0, 0, c.canvas.width, c.canvas.height);

        if(v.videoWidth>v.videoHeight) {
            var coof = c.canvas.width / v.videoWidth;
            c.drawImage(v, 0, 0, v.videoWidth * coof, v.videoHeight * coof);
        }
    else
        {
            var coof = c.canvas.height / v.videoHeight;
            c.drawImage(v, (c.canvas.width-(v.videoWidth * coof))/2, 0, v.videoWidth * coof, v.videoHeight * coof);
        }

        //videoWidth
       // drawImageProp(c,v);
    }
    else
    {
        var coof = c.canvas.width / img.width;
        c.drawImage(img, 0,0,img.width* coof,img.height* coof);
    }

    setTimeout(()=>{draw(v,c, videoTrack,img)},1000/30)
}




