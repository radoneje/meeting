window.onload=async ()=> {
    var dt = await axios.get('/rest/api/info/' + eventid + "/0")
    console.log(dt.data);
    if (!dt.data)
        return document.location.href = "/login/" + eventid + "?redirect=" + encodeURI('/meeting/' + eventid + "/" + meetRoomid);
    var user = dt.data;
    var WowzaCfg = null;
    var BitrateCfg = null;
    var arrVideo = [];
    var arrAudio = [];
    var audioSel=false

    var app = new Vue({
        el: "#app",
        data: {
            sect: sect,
            constraints: null,
            activeSection: 2,
            eventRooms: [],
            noWebrtc: false,
            videos: [],
            firstConnect: true,
            user: user,
            isMyDtShow: false,
            isMyMute: false,
            isMyVideoEnabled: false,
            myTracks: [],
            eventRooms: [],
            chat: [],
            chatText: '',
            users: [],
            langCh: [],
            showLangCh: false,
            maxConnect: false,
            audioOutputDevices: [],
            audioOutputDevicesShow:false,
            audioActiveDevice: null,
            novideo:novideo,
            firstButton:true,
            socket:null,

        },
        methods: {
            meetchatTextOnPaste: meetchatTextOnPaste,
            chatFileClick: chatFileClick,
            uploafFilesToChat:uploafFilesToChat,
            meetchattextChange: meetchattextChange,
            meetChattextSend: meetChattextSend,
            chatAddSmile: chatAddSmile,
            sectActive: sectActive,
            firstButtonClick:function(){
                this.firstButton=false;
                this.socket.emit("getMeetingVideos");
            },
            hideDesktop: function () {
                var _this = this;
                var v = arrVideo.filter(r => r.isMyVideo && r.isDesktop);
                if (v.length > 0) {

                    _this.isMyDtShow = false;
                    socket.emit("closeStream", {streamid: v[0].streamid});
                }


            },
            myVideoMute: function () {
                var _this = this;
                var els = arrVideo.filter(r => r.isMyVideo && !r.isDesktop)
                if (els.length == 0)
                    return;
                var item = els[0];
                var tracks = item.stream.getTracks();
                _this.isMyMute = !_this.isMyMute;
                tracks.forEach(tr => {
                    if (tr.kind == "audio") {
                        //tr.muted = _this.isMyMute;
                        tr.enabled = !_this.isMyMute;
                        console.log("find", tr)

                    }
                })

            },
            myVideoBlack: function () {
                var _this = this;
                var els = arrVideo.filter(r => r.isMyVideo && !r.isDesktop)
                console.log("myVideoBlack", els)
                if (els.length == 0)
                    return;
                var item = els[0];
                _this.isMyVideoEnabled = !_this.isMyVideoEnabled;
                item.tracks.forEach(tr => {
                    if (tr.kind == "video") {
                        tr.enabled = !_this.isMyVideoEnabled;
                    }
                })

            },
            showDesktop: async function () {
                var _this = this;
                var stream = await navigator.mediaDevices.getDisplayMedia({video: true, audio: false});
                var videoItem = {id: 2, isMyVideo: true, isDesktop: true, user: user}
                arrVideo.push(videoItem)

                setTimeout(async () => {


                    videoItem.stream = stream;
                    videoItem.streamid = socket.id + "Dt";
                    videoItem.id = socket.id + "Dt";
                    await createVideo(videoItem.id, true, user)
                    videoItem.elem = document.getElementById('video_' + videoItem.id);
                    videoItem.elem.srcObject = stream;
                    videoLayout();

                    videoItem.elem.onplay = async () => {
                    };
                    stream.addEventListener('inactive', e => {
                        _this.isMyDtShow = false;
                        socket.emit("closeStream", {streamid: videoItem.streamid});
                    });

                    publishVideoToWowza(videoItem.streamid, videoItem.stream, WowzaCfg.data, BitrateCfg.data,
                        (ret) => {
                            console.log("my Desktop Published", ret)
                            videoItem.peerConnection = ret.peerConnection;
                            _this.isMyDtShow = true;
                            setTimeout(() => {
                                socket.emit("newStream", {
                                    user: user,
                                    isDesktop: true,
                                    meetid: meetRoomid,
                                    streamid: ret.streamid
                                });

                            }, 1000);
                        },
                        (err) => {
                            console.warn("wowza publish err", err)
                        })


                }, 0);
            },
            changeActiveLang: function (item) {
                this.langCh.forEach(f => {
                    f.isActive = f.lang.id == item.lang.id;
                });
                this.activateLangCh(item);
                this.showLangCh = false
            },
            activateLangCh: async function (item) {
                var _this = this;
                if (item.lang.id == 0) {
                    //removeAudioCh()
                    arrAudio.forEach(a => {
                        _this.removeAudio(a.id);
                    })
                    arrVideo.forEach(v => {
                        if (!v.isMyVideo)
                          //  v.elem.muted = false
                            v.elem.volume=1;
                    });
                } else {
                    arrAudio.forEach(a => {
                        _this.removeAudio(a.id);
                    })
                    var audioContainer = document.createElement("div");
                    audioContainer.id = "audiobox" + item.id;

                    var audio = document.createElement("audio");
                    audio.id = item.id
                    audio.autoplay = "autoplay";
                    //  audio.controls="controls";
                    audioContainer.style.marginBottom = "10px"
                    audioContainer.style.position = "fixed";
                    audioContainer.style.bottom = "20px";
                    audioContainer.style.zIndex = 10000;
                    audioContainer.appendChild(audio);
                    document.body.appendChild(audioContainer);


                        var alabel = document.createElement("div");
                        alabel.innerHTML = item.lang.id;

                        audioContainer.appendChild(alabel);
                        var sel = document.createElement("select");
                        _this.audioOutputDevices.forEach(d => {
                            var o = document.createElement("option");
                            sel.appendChild(o);
                            o.innerHTML = d.label;
                            o.value = d.deviceId;
                            console.log("audio devise", d)
                        })
                        audioContainer.appendChild(sel);
                        sel.addEventListener("change", (e) => {
                            //console.log(e, sel.value);
                            audio.elem.setSinkId(item.deviceId);
                            audioSel=true;
                        })


                    var ret = await getVideoFromWowzaAync(item.id, audio, WowzaCfg.data, BitrateCfg.data);
                    var audioItem = {id: item.id, elem: audio, peerConnection: ret.peerConnection}
                    arrAudio.push(audioItem)
                    console.log("MUST MUTED")
                    arrVideo.forEach(v => {
                        console.log("MUST ", v.elem)
                        try {
                          //  v.elem.muted = true;
                            v.elem.volume=.2;
                        }
                        catch (e) {
                            
                        }
                    });
                    audioItem.peerConnection.onconnectionstatechange = (event) => {
                        var cs = audioItem.peerConnection.connectionState
                        console.log("cs", audioItem.peerConnection.connectionState)
                        if (cs == "disconnected" || cs == "failed" || cs == "closed") {
                            if (audioItem.peerConnection) {
                                audioItem.peerConnection.close();
                                audioItem.peerConnection = null;
                            }
                            _this.removeAudio(audioItem.id)
                            arrAudio = arrAudio.filter(r => r.id != audioItem.id);

                        }

                    }

                }
            },
            removeAudio: function (id) {
                console.log("removeAudio", id)
                var _this=this;
                if(audioSel)
                    return;
                var items = arrAudio.filter(r => r.id == id);
                if (items.length > 0) {
                    if (items[0].peerConnection) {
                        items[0].peerConnection.close();
                        items[0].peerConnection = null;

                        if (items[0].elem)
                            items[0].elem.parentNode.parentNode.removeChild(items[0].elem.parentNode);
                    }

                    if (items[0].isActive) {
                        this.langCh.forEach(f => {
                            f.isActive = f.lang.id == 0;
                        });
                        arrVideo.forEach(v => {
                            if (!v.isMyVideo)
                                v.muted = false
                        });
                    }
                    arrAudio = arrAudio.filter(r => r.id != id);
                }
            },
            changeActiveOutDevice:function (item) {
                this.audioOutputDevicesShow=false;
                this.audioActiveDevice=item;
                arrVideo.forEach(v => {
                    console.log("changeVideoDevice ", v.elem)
                    try {

                        v.elem.setSinkId(item.deviceId);
                        console.log('Audio is being played on ' + v.elem.sinkId);
                    }
                    catch (e) {
                        console.warn("cant changeActiveOutDevice", e)
                    }
                });
            }


        },
        computed: {
            activeLangCh: function () {
                var ret = this.langCh.filter(r => r.isActive == true);
                if (ret.length > 0)
                    return ret[0].lang
                else
                    return 0;
            }
        },
        mounted: async function () {
            var _this = this;

            try {
                _this.audioOutputDevices = (await navigator.mediaDevices.enumerateDevices()).filter(device => device.kind === 'audiooutput');
                _this.audioActiveDevice = _this.audioOutputDevices.filter(device => device.deviceId === 'default')[0];
                console.log()
            }
            catch (e) {
                console.warn("no output aodio devices");
            }


            document.getElementById("app").style.opacity = 1;

            axios.get("/rest/api/eventRooms/" + eventid + "/" + 0)

                .then(function (r) {
                    console.log("eventRooms", r.data)
                    _this.eventRooms = r.data;
                });

            var serverUrl;
            var scheme = "http";
            if (document.location.protocol === "https:") {
                scheme += "s";
            }


            if(!novideo) {
                var videoItem = {id: 0, isMyVideo: true, user: user}
                arrVideo.push(videoItem)
                var video = await createVideo(videoItem.id, videoItem.isMyVideo, user);
                videoLayout();
                setTimeout(async () => {

                }, 0);
            }

            serverUrl = document.location.protocol + "//" + myHostname;//+"/meeting/socket";
            console.log('Connecting to server:' + serverUrl, {path: '/meeting/socket'});
            socket = io(serverUrl, {path: '/meeting/socket'});
            this.socket=socket;
            socket.on('connect', async () => {
                console.log('connect success');
                _this.emit = function (type, data,) {
                    socket.emit(type, data);
                }
                if (_this.firstConnect) {
                    WowzaCfg = await axios.get('/rest/api/meetWowza')
                    BitrateCfg = await axios.get('/rest/api/meetBitrate')

                    _this.firstConnect = false;

                    socket.emit("hello", {userid: user.id, meetid: meetRoomid})
                    var dt = await axios.get('/rest/api/constraints');
                    _this.constraints = dt.data;
                    if (!novideo) {
                        videoItem.streamid = socket.id;
                        videoItem.elem = document.getElementById('video_' + videoItem.id);

                        setTimeout(() => {
                            console.log("getMeetingVideos send");
                            socket.emit("getMeetingVideos");
                        }, 3000);
                    }

                    if (!novideo)
                    {
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
                                var silentTimer = null;
                                var silent = false;
                                videoItem.analiser = await createAudioAnaliser(newStream, (val) => {
                                    // console.log(val, parseFloat((val/100)*100));
                                    if (val > 15) {
                                        if (!silent) {
                                            silent = true;
                                            arrAudio.forEach(a => {
                                                a.elem.volume = .2;
                                            })
                                            arrVideo.forEach(a => {
                                                a.elem.volume = .2;
                                            })
                                            console.log("silent on")
                                        }
                                        if (silentTimer)
                                            clearTimeout(silentTimer);
                                        silentTimer = setTimeout(() => {
                                            arrAudio.forEach(a => {
                                                a.elem.volume = 1;
                                            })
                                            arrVideo.forEach(a => {
                                                a.elem.volume = .2;
                                            })
                                            console.log("silent off")
                                            silent = false;
                                        }, 1000)
                                    }
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
                                console.log("my Stream before Published")

                                await publishVideoToWowza(videoItem.streamid, videoItem.stream, WowzaCfg.data, BitrateCfg.data,
                                    (ret) => {
                                        console.log("my Stream Published", ret)
                                        videoItem.peerConnection = ret.peerConnection;
                                        setTimeout(() => {
                                            socket.emit("newStream", {
                                                user: user,
                                                isDesktop: false,
                                                meetid: meetRoomid,
                                                streamid: ret.streamid
                                            });

                                        }, 3000);


                                    },
                                    (err) => {
                                        console.warn("wowza publish err", err)
                                    })
                            }, 2000)
                        } catch (e) {
                            console.log("no local video allowed");


                        }
                    }

                    //    }
                    socket.on('newLangCh', async (data) => {
                        console.log("newLangCh");
                        if (_this.langCh.length == 0) {
                            _this.langCh.push({lang: {title: "original", id: 0}, isActive: true})
                        }
                        var find = _this.langCh.filter(f => f.lang.id == data.lang.id)
                        if (find.length == 0) {
                            data.isActive = false;
                            _this.langCh.push(data);
                        }
                    });
                    socket.on('maxConnect', async (data) => {
                       // _this.maxConnect=true;
                       // alert("Превышеночисло участников переговорной комнаты")
                    });
                    socket.on('langChClose', async (data) => {

                        var items = _this.langCh.filter(l => l.id == data.id)
                        console.log('langChClose', items, data)
                        if (items.length == 0)
                            return;
                        if (items[0].isActive) {
                            _this.langCh[0].isActive = true;
                            _this.activateLangCh({lang: {id: 0}});
                        }
                        console.log("lang close");
                        _this.langCh = _this.langCh.filter(l => l.id != data.id);
                    });
                    socket.on('newStream', async (data) => {
                        console.log('newStream', data.streamid,meetRoomid != data.meetid, arrVideo )

                        if (meetRoomid != data.meetid && !novideo)
                            return; //видео чужих комнат

                        var ff = arrVideo.filter(v => v.streamid == data.streamid)
                        if (ff.length > 0)
                            return;//убираем повтор моего видео

                        var receiverItem = {
                            id: data.streamid,
                            isMyVideo: false,
                            user: data.user,
                            streamid: data.streamid
                        }
                        arrVideo.push(receiverItem)
                        var video = await createVideo(data.streamid, false, data.user);
                        videoLayout();
                        setTimeout(async () => {
                            receiverItem.elem = document.getElementById('video_' + receiverItem.id);
                            try {
                                if (_this.audioActiveDevice)
                                    receiverItem.elem.setSinkId(_this.audioActiveDevice.deviceId)
                            }
                            catch (e) {
                                console.warn("cant setSinkId ", e);
                            }

                            getVideoFromWowza(receiverItem, WowzaCfg.data, BitrateCfg.data,
                                async (ret) => {
                                    /*(receiverItem.analiser=await createAudioAnaliser(receiverItem.srcObject, (val)=>{
                                         console.log(val, parseFloat((val/100)*100));
                                        receiverItem.audioElem.style.height=parseFloat((val/100)*100)+"%"
                                    })*/

                                    receiverItem.peerConnection = ret.peerConnection;
                                    receiverItem.peerConnection.onconnectionstatechange = (event) => {
                                        var cs = receiverItem.peerConnection.connectionState
                                        console.log("cs", receiverItem.peerConnection.connectionState)
                                        if (cs == "disconnected" || cs == "failed" || cs == "closed") {
                                            if (receiverItem.peerConnection) {
                                                receiverItem.peerConnection.close();
                                                receiverItem.peerConnection = null;
                                            }
                                            removeVideo(receiverItem.streamid)
                                            arrVideo = arrVideo.filter(r => r.streamid != receiverItem.streamid);
                                            videoLayout();
                                        }

                                    }
                                },
                                (data) => {
                                    console.warn("receiver err")
                                })
                        }, 3000);


                    })

                    socket.on('closeStream', async (data) => {
                        var v = arrVideo.filter(v => v.streamid == data.streamid)
                        if (v.length == 0)
                            return;
                        var videoItem = v[0];

                        console.warn("closeStream", data.streamid, videoItem.streamid, videoItem.id);
                        if (videoItem.peerConnection) {
                            videoItem.peerConnection.close();
                            videoItem.peerConnection = null;
                        }
                        arrVideo = arrVideo.filter(r => r.streamid != videoItem.streamid);
                        removeVideo(data.streamid)
                        videoLayout();

                    })

                    initChatAndQ(socket, _this)



                }
            });


        }
    })


    function removeVideo(id) {
        console.log("removeVideo", id)
        var elem = document.getElementById('meetVideoItem_' + id);
        if (elem)
            elem.parentNode.removeChild(elem)
    }

    async function createVideo(id, muted, user) {
        console.log("Create Video")
        var meetVideoBox = document.getElementById("meetVideoBox");
        var meetVideoItem = document.createElement("div");
        meetVideoItem.classList.add("meetVideoItem");
        meetVideoItem.id = 'meetVideoItem_' + id
        var dt = await axios.get('/meeting/videoElem/' + id);
        meetVideoItem.innerHTML = dt.data;
        meetVideoBox.appendChild(meetVideoItem)
        var video = document.getElementById("video_" + id)
        if (muted)
            video.muted = true;
        var cap = document.getElementById("meetVideoCap_" + id)
        cap.innerText = (user.i || "") + " " + (user.f || "")

        var mute = document.getElementById('meetVideoMute' + id)
        var unmute = document.getElementById('meetVideoUnMute' + id)


        unmute.classList.add('btnHidden')
        mute.addEventListener('click', function (e, id) {
            video.muted = true;
            unmute.classList.remove('btnHidden')
            mute.classList.add('btnHidden')
        })
        unmute.addEventListener('click', function (e, id) {
            video.muted = false;
            mute.classList.remove('btnHidden')
            unmute.classList.add('btnHidden')
        })
        if (muted) {
            mute.parentNode.removeChild(mute)
            unmute.parentNode.removeChild(unmute)
        }
        document.getElementById('meetVideoFullScreen' + id).addEventListener("click", function () {

            var video = document.getElementById("video_" + id)

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
        } catch (e) {
            return null
        }
    }

    function draw(v, c, videoTrack, img) {


        if ((!v.paused || !v.ended) && videoTrack.enabled) {
            c.fillStyle = "#282D33";
            c.fillRect(0, 0, c.canvas.width, c.canvas.height);

            if (v.videoWidth > v.videoHeight) {
                var coof = c.canvas.width / v.videoWidth;
                c.drawImage(v, 0, 0, v.videoWidth * coof, v.videoHeight * coof);

            } else {
                var coof = c.canvas.height / v.videoHeight;
                c.drawImage(v, (c.canvas.width - (v.videoWidth * coof)) / 2, 0, v.videoWidth * coof, v.videoHeight * coof);
            }

            //videoWidth
            // drawImageProp(c,v);
        } else {
            var coof = c.canvas.width / img.width;
            c.drawImage(img, 0, 0, img.width * coof, img.height * coof);
        }

        setTimeout(() => {
            draw(v, c, videoTrack, img)
        }, 1000 / 30)


    }

    function videoLayout() {
        var trBox=document.getElementById("meetVideoBox");
        trBox.style.position= "relative";
        var fullW=trBox.clientWidth-20;

        if (arrVideo.length == 1) {
            setVideoLayout(arrVideo[0].id, 0, fullW*.05, fullW*.9)
            trBox.style.height=((fullW/1.777)+20)+"px"
        }
        if (arrVideo.length == 2) {
            setVideoLayout(arrVideo[0].id, 15, 0, fullW*.5-5)
            setVideoLayout(arrVideo[1].id, 15, fullW*.5+5, fullW*.5-5)
            trBox.style.height=((fullW/1.777)+40)+"px"
        }
        if (arrVideo.length == 3) {
            setVideoLayout(arrVideo[0].id, 15, 0, fullW*.5-5)
            setVideoLayout(arrVideo[1].id, 15, fullW*.5+5, fullW*.5-5)
            setVideoLayout(arrVideo[2].id, 15+(fullW*.5+10)/1.777+5, fullW*.25+5, fullW*.5-5)
            trBox.style.height=((fullW*.5+5/1.777)+20)*2+"px"
        }
        if (arrVideo.length == 4) {
            setVideoLayout(arrVideo[0].id, 15, 0, fullW*.5-5)
            setVideoLayout(arrVideo[1].id, 15, fullW*.5+5, fullW*.5-5)
            setVideoLayout(arrVideo[2].id, 15+(fullW*.5+5)/1.777+5, 0, fullW*.5-5)
            setVideoLayout(arrVideo[3].id, 15+(fullW*.5+5)/1.777+5, fullW*.5+5, fullW*.5-5)
            trBox.style.height=(((fullW*.5+5)/1.777)+20)*2+"px"
        }
        if (arrVideo.length == 5) {
            setVideoLayout(arrVideo[0].id, 15, 0, fullW*.3-5)
            setVideoLayout(arrVideo[1].id, 15, fullW*.3+5, fullW*.3-5)
            setVideoLayout(arrVideo[2].id, 15, (fullW*.3+5)*2, fullW*.3-10)
            setVideoLayout(arrVideo[3].id, 15+(fullW*.3+10)/1.777+5, 0, fullW*.3-5)
            setVideoLayout(arrVideo[4].id, 15+(fullW*.3+10)/1.777+5, (fullW*.3+5)*2, fullW*.3-5)
            trBox.style.height=(((fullW*.3+10)/1.777)+20)*3+"px"
        }
        if (arrVideo.length == 6) {
            setVideoLayout(arrVideo[0].id, 15, 0, fullW*.3-5)
            setVideoLayout(arrVideo[1].id, 15, fullW*.3+5, fullW*.3-5)
            setVideoLayout(arrVideo[2].id, 15, (fullW*.3+5)*2, fullW*.3-10)
            setVideoLayout(arrVideo[3].id, 15+(fullW*.3+10)/1.777+5, 0, fullW*.3-5)
            setVideoLayout(arrVideo[4].id, 15+(fullW*.3+10)/1.777+5, (fullW*.3+5)*1, fullW*.3-5)
            setVideoLayout(arrVideo[5].id, 15+(fullW*.3+10)/1.777+5, (fullW*.3+5)*2, fullW*.3-5)
            trBox.style.height=(((fullW*.3+10)/1.777)+20)*3+"px"
        }
        if (arrVideo.length == 7) {
            setVideoLayout(arrVideo[0].id, 15, 0, fullW*.3-5)
            setVideoLayout(arrVideo[1].id, 15, fullW*.3+5, fullW*.3-5)
            setVideoLayout(arrVideo[2].id, 15, (fullW*.3+5)*2, fullW*.3-10)
            setVideoLayout(arrVideo[3].id, 15+(fullW*.3+10)/1.777+5, 0, fullW*.3-5)
            setVideoLayout(arrVideo[4].id, 15+(fullW*.3+10)/1.777+5, (fullW*.3+5)*1, fullW*.3-5)
            setVideoLayout(arrVideo[5].id, 15+(fullW*.3+10)/1.777+5, (fullW*.3+5)*2, fullW*.3-5)
            setVideoLayout(arrVideo[6].id, 15+((fullW*.3+10)/1.777+5)*2, 0, fullW*.3-5)
            trBox.style.height=(((fullW*.3+10)/1.777)+20)*3+"px"
        }
        if (arrVideo.length == 8) {
            setVideoLayout(arrVideo[0].id, 15, 0, fullW*.3-5)
            setVideoLayout(arrVideo[1].id, 15, fullW*.3+5, fullW*.3-5)
            setVideoLayout(arrVideo[2].id, 15, (fullW*.3+5)*2, fullW*.3-10)
            setVideoLayout(arrVideo[3].id, 15+(fullW*.3+10)/1.777+5, 0, fullW*.3-5)
            setVideoLayout(arrVideo[4].id, 15+(fullW*.3+10)/1.777+5, (fullW*.3+5)*1, fullW*.3-5)
            setVideoLayout(arrVideo[5].id, 15+(fullW*.3+10)/1.777+5, (fullW*.3+5)*2, fullW*.3-5)
            setVideoLayout(arrVideo[6].id, 15+((fullW*.3+10)/1.777+5)*2, 0, fullW*.3-5)
            setVideoLayout(arrVideo[7].id, 15+((fullW*.3+10)/1.777+5)*2, (fullW*.3+5)*1, fullW*.3-5)
            trBox.style.height=(((fullW*.3+10)/1.777)+20)*3+"px"
        }
        if (arrVideo.length == 9) {
            setVideoLayout(arrVideo[0].id, 15, 0, fullW*.3-5)
            setVideoLayout(arrVideo[1].id, 15, fullW*.3+5, fullW*.3-5)
            setVideoLayout(arrVideo[2].id, 15, (fullW*.3+5)*2, fullW*.3-10)
            setVideoLayout(arrVideo[3].id, 15+(fullW*.3+10)/1.777+5, 0, fullW*.3-5)
            setVideoLayout(arrVideo[4].id, 15+(fullW*.3+10)/1.777+5, (fullW*.3+5)*1, fullW*.3-5)
            setVideoLayout(arrVideo[5].id, 15+(fullW*.3+10)/1.777+5, (fullW*.3+5)*2, fullW*.3-5)
            setVideoLayout(arrVideo[6].id, 15+((fullW*.3+10)/1.777+5)*2, 0, fullW*.3-5)
            setVideoLayout(arrVideo[7].id, 15+((fullW*.3+10)/1.777+5)*2, (fullW*.3+5)*1, fullW*.3-5)
            setVideoLayout(arrVideo[8].id, 15+((fullW*.3+10)/1.777+5)*2, (fullW*.3+5)*2, fullW*.3-5)
            trBox.style.height=(((fullW*.3+10)/1.777)+20)*3+"px"
        }
        if (arrVideo.length == 10) {

            setVideoLayout(arrVideo[0].id, 15+((fullW*.3+10)/1.777+5)*0, (fullW*.25+5)*0, fullW*.25-5)
            setVideoLayout(arrVideo[1].id, 15+((fullW*.3+10)/1.777+5)*0, (fullW*.25+5)*1, fullW*.25-5)
            setVideoLayout(arrVideo[2].id, 15+((fullW*.3+10)/1.777+5)*0, (fullW*.25+5)*2, fullW*.25-5)
            setVideoLayout(arrVideo[3].id, 15+((fullW*.3+10)/1.777+5)*0, (fullW*.25+5)*3, fullW*.25-5)

            setVideoLayout(arrVideo[4].id, 15+((fullW*.3+10)/1.777+5)*1, (fullW*.25+5)*0, fullW*.25-5)
            setVideoLayout(arrVideo[5].id, 15+((fullW*.3+10)/1.777+5)*1, (fullW*.25+5)*1, fullW*.25-5)
            setVideoLayout(arrVideo[6].id, 15+((fullW*.3+10)/1.777+5)*1, (fullW*.25+5)*2, fullW*.25-5)
            setVideoLayout(arrVideo[7].id, 15+((fullW*.3+10)/1.777+5)*1, (fullW*.25+5)*3, fullW*.25-5)

            setVideoLayout(arrVideo[8].id, 15+((fullW*.3+10)/1.777+5)*2, (fullW*.25+5)*0, fullW*.25-5)
            setVideoLayout(arrVideo[9].id, 15+((fullW*.3+10)/1.777+5)*2, (fullW*.25+5)*1, fullW*.25-5)

            trBox.style.height=(((fullW*.25+10)/1.777)+20)*4+"px"
        }
        if (arrVideo.length == 11) {

            setVideoLayout(arrVideo[0].id, 15+((fullW*.3+10)/1.777+5)*0, (fullW*.25+5)*0, fullW*.25-5)
            setVideoLayout(arrVideo[1].id, 15+((fullW*.3+10)/1.777+5)*0, (fullW*.25+5)*1, fullW*.25-5)
            setVideoLayout(arrVideo[2].id, 15+((fullW*.3+10)/1.777+5)*0, (fullW*.25+5)*2, fullW*.25-5)
            setVideoLayout(arrVideo[3].id, 15+((fullW*.3+10)/1.777+5)*0, (fullW*.25+5)*3, fullW*.25-5)

            setVideoLayout(arrVideo[4].id, 15+((fullW*.3+10)/1.777+5)*1, (fullW*.25+5)*0, fullW*.25-5)
            setVideoLayout(arrVideo[5].id, 15+((fullW*.3+10)/1.777+5)*1, (fullW*.25+5)*1, fullW*.25-5)
            setVideoLayout(arrVideo[6].id, 15+((fullW*.3+10)/1.777+5)*1, (fullW*.25+5)*2, fullW*.25-5)
            setVideoLayout(arrVideo[7].id, 15+((fullW*.3+10)/1.777+5)*1, (fullW*.25+5)*3, fullW*.25-5)

            setVideoLayout(arrVideo[8].id, 15+((fullW*.3+10)/1.777+5)*2, (fullW*.25+5)*0, fullW*.25-5)
            setVideoLayout(arrVideo[9].id, 15+((fullW*.3+10)/1.777+5)*2, (fullW*.25+5)*1, fullW*.25-5)
            setVideoLayout(arrVideo[10].id, 15+((fullW*.3+10)/1.777+5)*2, (fullW*.25+5)*2, fullW*.25-5)

            trBox.style.height=(((fullW*.25+10)/1.777)+20)*4+"px"
        }
        if (arrVideo.length == 12) {

            setVideoLayout(arrVideo[0].id, 15+((fullW*.3+10)/1.777+5)*0, (fullW*.25+5)*0, fullW*.25-5)
            setVideoLayout(arrVideo[1].id, 15+((fullW*.3+10)/1.777+5)*0, (fullW*.25+5)*1, fullW*.25-5)
            setVideoLayout(arrVideo[2].id, 15+((fullW*.3+10)/1.777+5)*0, (fullW*.25+5)*2, fullW*.25-5)
            setVideoLayout(arrVideo[3].id, 15+((fullW*.3+10)/1.777+5)*0, (fullW*.25+5)*3, fullW*.25-5)

            setVideoLayout(arrVideo[4].id, 15+((fullW*.3+10)/1.777+5)*1, (fullW*.25+5)*0, fullW*.25-5)
            setVideoLayout(arrVideo[5].id, 15+((fullW*.3+10)/1.777+5)*1, (fullW*.25+5)*1, fullW*.25-5)
            setVideoLayout(arrVideo[6].id, 15+((fullW*.3+10)/1.777+5)*1, (fullW*.25+5)*2, fullW*.25-5)
            setVideoLayout(arrVideo[7].id, 15+((fullW*.3+10)/1.777+5)*1, (fullW*.25+5)*3, fullW*.25-5)

            setVideoLayout(arrVideo[8].id, 15+((fullW*.3+10)/1.777+5)*2, (fullW*.25+5)*0, fullW*.25-5)
            setVideoLayout(arrVideo[9].id, 15+((fullW*.3+10)/1.777+5)*2, (fullW*.25+5)*1, fullW*.25-5)
            setVideoLayout(arrVideo[10].id, 15+((fullW*.3+10)/1.777+5)*2, (fullW*.25+5)*2, fullW*.25-5)
            setVideoLayout(arrVideo[11].id, 15+((fullW*.3+10)/1.777+5)*2, (fullW*.25+5)*3, fullW*.25-5)

            trBox.style.height=(((fullW*.25+10)/1.777)+20)*4+"px"
        }
        if (arrVideo.length == 13) {

            setVideoLayout(arrVideo[0].id, 15+((fullW*.3+10)/1.777+5)*0, (fullW*.25+5)*0, fullW*.25-5)
            setVideoLayout(arrVideo[1].id, 15+((fullW*.3+10)/1.777+5)*0, (fullW*.25+5)*1, fullW*.25-5)
            setVideoLayout(arrVideo[2].id, 15+((fullW*.3+10)/1.777+5)*0, (fullW*.25+5)*2, fullW*.25-5)
            setVideoLayout(arrVideo[3].id, 15+((fullW*.3+10)/1.777+5)*0, (fullW*.25+5)*3, fullW*.25-5)

            setVideoLayout(arrVideo[4].id, 15+((fullW*.3+10)/1.777+5)*1, (fullW*.25+5)*0, fullW*.25-5)
            setVideoLayout(arrVideo[5].id, 15+((fullW*.3+10)/1.777+5)*1, (fullW*.25+5)*1, fullW*.25-5)
            setVideoLayout(arrVideo[6].id, 15+((fullW*.3+10)/1.777+5)*1, (fullW*.25+5)*2, fullW*.25-5)
            setVideoLayout(arrVideo[7].id, 15+((fullW*.3+10)/1.777+5)*1, (fullW*.25+5)*3, fullW*.25-5)

            setVideoLayout(arrVideo[8].id, 15+((fullW*.3+10)/1.777+5)*2, (fullW*.25+5)*0, fullW*.25-5)
            setVideoLayout(arrVideo[9].id, 15+((fullW*.3+10)/1.777+5)*2, (fullW*.25+5)*1, fullW*.25-5)
            setVideoLayout(arrVideo[10].id, 15+((fullW*.3+10)/1.777+5)*2, (fullW*.25+5)*2, fullW*.25-5)
            setVideoLayout(arrVideo[11].id, 15+((fullW*.3+10)/1.777+5)*2, (fullW*.25+5)*3, fullW*.25-5)

            setVideoLayout(arrVideo[12].id, 15+((fullW*.3+10)/1.777+5)*3, (fullW*.25+5)*0, fullW*.25-5)

            trBox.style.height=(((fullW*.25+10)/1.777)+20)*4+"px"
        }
        if (arrVideo.length == 14) {

            setVideoLayout(arrVideo[0].id, 15+((fullW*.3+10)/1.777+5)*0, (fullW*.25+5)*0, fullW*.25-5)
            setVideoLayout(arrVideo[1].id, 15+((fullW*.3+10)/1.777+5)*0, (fullW*.25+5)*1, fullW*.25-5)
            setVideoLayout(arrVideo[2].id, 15+((fullW*.3+10)/1.777+5)*0, (fullW*.25+5)*2, fullW*.25-5)
            setVideoLayout(arrVideo[3].id, 15+((fullW*.3+10)/1.777+5)*0, (fullW*.25+5)*3, fullW*.25-5)

            setVideoLayout(arrVideo[4].id, 15+((fullW*.3+10)/1.777+5)*1, (fullW*.25+5)*0, fullW*.25-5)
            setVideoLayout(arrVideo[5].id, 15+((fullW*.3+10)/1.777+5)*1, (fullW*.25+5)*1, fullW*.25-5)
            setVideoLayout(arrVideo[6].id, 15+((fullW*.3+10)/1.777+5)*1, (fullW*.25+5)*2, fullW*.25-5)
            setVideoLayout(arrVideo[7].id, 15+((fullW*.3+10)/1.777+5)*1, (fullW*.25+5)*3, fullW*.25-5)

            setVideoLayout(arrVideo[8].id, 15+((fullW*.3+10)/1.777+5)*2, (fullW*.25+5)*0, fullW*.25-5)
            setVideoLayout(arrVideo[9].id, 15+((fullW*.3+10)/1.777+5)*2, (fullW*.25+5)*1, fullW*.25-5)
            setVideoLayout(arrVideo[10].id, 15+((fullW*.3+10)/1.777+5)*2, (fullW*.25+5)*2, fullW*.25-5)
            setVideoLayout(arrVideo[11].id, 15+((fullW*.3+10)/1.777+5)*2, (fullW*.25+5)*3, fullW*.25-5)

            setVideoLayout(arrVideo[12].id, 15+((fullW*.3+10)/1.777+5)*3, (fullW*.25+5)*0, fullW*.25-5)
            setVideoLayout(arrVideo[13].id, 15+((fullW*.3+10)/1.777+5)*3, (fullW*.25+5)*1, fullW*.25-5)

            trBox.style.height=(((fullW*.25+10)/1.777)+20)*4+"px"
        }
        if (arrVideo.length == 15) {

            setVideoLayout(arrVideo[0].id, 15+((fullW*.3+10)/1.777+5)*0, (fullW*.25+5)*0, fullW*.25-5)
            setVideoLayout(arrVideo[1].id, 15+((fullW*.3+10)/1.777+5)*0, (fullW*.25+5)*1, fullW*.25-5)
            setVideoLayout(arrVideo[2].id, 15+((fullW*.3+10)/1.777+5)*0, (fullW*.25+5)*2, fullW*.25-5)
            setVideoLayout(arrVideo[3].id, 15+((fullW*.3+10)/1.777+5)*0, (fullW*.25+5)*3, fullW*.25-5)

            setVideoLayout(arrVideo[4].id, 15+((fullW*.3+10)/1.777+5)*1, (fullW*.25+5)*0, fullW*.25-5)
            setVideoLayout(arrVideo[5].id, 15+((fullW*.3+10)/1.777+5)*1, (fullW*.25+5)*1, fullW*.25-5)
            setVideoLayout(arrVideo[6].id, 15+((fullW*.3+10)/1.777+5)*1, (fullW*.25+5)*2, fullW*.25-5)
            setVideoLayout(arrVideo[7].id, 15+((fullW*.3+10)/1.777+5)*1, (fullW*.25+5)*3, fullW*.25-5)

            setVideoLayout(arrVideo[8].id, 15+((fullW*.3+10)/1.777+5)*2, (fullW*.25+5)*0, fullW*.25-5)
            setVideoLayout(arrVideo[9].id, 15+((fullW*.3+10)/1.777+5)*2, (fullW*.25+5)*1, fullW*.25-5)
            setVideoLayout(arrVideo[10].id, 15+((fullW*.3+10)/1.777+5)*2, (fullW*.25+5)*2, fullW*.25-5)
            setVideoLayout(arrVideo[11].id, 15+((fullW*.3+10)/1.777+5)*2, (fullW*.25+5)*3, fullW*.25-5)

            setVideoLayout(arrVideo[12].id, 15+((fullW*.3+10)/1.777+5)*3, (fullW*.25+5)*0, fullW*.25-5)
            setVideoLayout(arrVideo[13].id, 15+((fullW*.3+10)/1.777+5)*3, (fullW*.25+5)*1, fullW*.25-5)
            setVideoLayout(arrVideo[14].id, 15+((fullW*.3+10)/1.777+5)*3, (fullW*.25+5)*2, fullW*.25-5)
            trBox.style.height=(((fullW*.25+10)/1.777)+20)*4+"px"
        }
        if (arrVideo.length == 16) {

            setVideoLayout(arrVideo[0].id, 15+((fullW*.3+10)/1.777+5)*0, (fullW*.25+5)*0, fullW*.25-5)
            setVideoLayout(arrVideo[1].id, 15+((fullW*.3+10)/1.777+5)*0, (fullW*.25+5)*1, fullW*.25-5)
            setVideoLayout(arrVideo[2].id, 15+((fullW*.3+10)/1.777+5)*0, (fullW*.25+5)*2, fullW*.25-5)
            setVideoLayout(arrVideo[3].id, 15+((fullW*.3+10)/1.777+5)*0, (fullW*.25+5)*3, fullW*.25-5)

            setVideoLayout(arrVideo[4].id, 15+((fullW*.3+10)/1.777+5)*1, (fullW*.25+5)*0, fullW*.25-5)
            setVideoLayout(arrVideo[5].id, 15+((fullW*.3+10)/1.777+5)*1, (fullW*.25+5)*1, fullW*.25-5)
            setVideoLayout(arrVideo[6].id, 15+((fullW*.3+10)/1.777+5)*1, (fullW*.25+5)*2, fullW*.25-5)
            setVideoLayout(arrVideo[7].id, 15+((fullW*.3+10)/1.777+5)*1, (fullW*.25+5)*3, fullW*.25-5)

            setVideoLayout(arrVideo[8].id, 15+((fullW*.3+10)/1.777+5)*2, (fullW*.25+5)*0, fullW*.25-5)
            setVideoLayout(arrVideo[9].id, 15+((fullW*.3+10)/1.777+5)*2, (fullW*.25+5)*1, fullW*.25-5)
            setVideoLayout(arrVideo[10].id, 15+((fullW*.3+10)/1.777+5)*2, (fullW*.25+5)*2, fullW*.25-5)
            setVideoLayout(arrVideo[11].id, 15+((fullW*.3+10)/1.777+5)*2, (fullW*.25+5)*3, fullW*.25-5)

            setVideoLayout(arrVideo[12].id, 15+((fullW*.3+10)/1.777+5)*3, (fullW*.25+5)*0, fullW*.25-5)
            setVideoLayout(arrVideo[13].id, 15+((fullW*.3+10)/1.777+5)*3, (fullW*.25+5)*1, fullW*.25-5)
            setVideoLayout(arrVideo[14].id, 15+((fullW*.3+10)/1.777+5)*3, (fullW*.25+5)*2, fullW*.25-5)
            setVideoLayout(arrVideo[15].id, 15+((fullW*.3+10)/1.777+5)*3, (fullW*.25+5)*3, fullW*.25-5)
            trBox.style.height=(((fullW*.25+10)/1.777)+20)*4+"px"
        }

        arrVideo.forEach(e => {

        })

    }

    function setVideoLayout(id, top, left, width) {
        console.log("meetVideoItem_" + id)
        var elem = document.getElementById("meetVideoItem_" + id);

        elem.style.position = "absolute";
        elem.style.top = top + "px";
        elem.style.left = (10+left) + "px";
        elem.style.width = width+"px";
    }
}




