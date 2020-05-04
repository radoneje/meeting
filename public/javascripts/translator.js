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
    var micStream = null;
    var micTracks = [];
    var audio = [];
    var app = new Vue({
        el: "#app",
        data: {
            sect: [
                {
                    title: "Чат",
                    isActive: true,
                    id: 2,
                    logo: '/images/logochat.svg',
                    logoactive: '/images/logochatactive.svg'
                },
                {
                    title: "Люди",
                    isActive: false,
                    id: 3,
                    logo: '/images/logousers.svg',
                    logoactive: '/images/logousersa.svg'
                },
                //  {title:"Файлы", isActive:false, id:7, logo:'/images/logofiles.svg', logoactive:'/images/logofilesa.svg'}
            ],
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
            avaibleLangs: [],
            lang: [{}, {}],
            showLang: [false, false],
            isStarted: false,
            activeLang: 0,
            langCh: [],
            showLangCh: false,
        },
        methods: {
            meetchatTextOnPaste: function (e) {
                var _this = this;
                var items = event.clipboardData.items;
                if (items == undefined)
                    return;

                for (var i = 0; i < items.length; i++) {
                    if (items[i].type.indexOf("image") == -1) continue;
                    if (items[i].kind === 'file') {
                        _this.uploafFilesToChat(items[i].getAsFile())
                    }
                }
            },
            chatFileClick: function () {
                var _this = this;
                var elem = document.createElement("input");
                elem.type = "file"
                elem.style.display = "none";
                elem.accept = "video/*;capture=camcorder";
                elem.onchange = function () {
                    _this.uploafFilesToChat(elem.files[0], function () {
                        elem.parentNode.removeChild(elem)
                    })

                }
                document.body.appendChild(elem);
                elem.click();
            },
            uploafFilesToChat: function (file, clbk) {
                var _this = this;
                if (!(file.type.indexOf('image/') == 0 || file.type.indexOf('video/') == 0))
                    return alert("Можно загрузить только фото или видео")
                var fd = new FormData();
                fd.append('file', file);

                var xhr = new XMLHttpRequest();
                var progressElem = document.querySelector(".fileLoadProgress")
                xhr.upload.onprogress = function (event) {
                    console.log(parseFloat(event.loaded / event.total));
                    if (progressElem)
                        progressElem.style.width = parseFloat(event.loaded / event.total) * 100 + "%"
                }
                xhr.onload = xhr.onerror = function () {

                    if (this.status == 200) {
                        setTimeout(function () {
                            var ret = JSON.parse(xhr.response)
                            console.log("chatFileUpload", ret.id)
                            socket.emit("chatFileUpload", {id: ret.id, meetid: meetid});
                            var objDiv = document.getElementById("chatBox");
                            objDiv.scrollTop = objDiv.scrollHeight;
                            _this.chatText = "";
                        }, 100)
                        setTimeout(() => {
                            var progressElem = document.querySelector(".fileLoadProgress")
                            if (progressElem)
                                progressElem.style.width = 0;
                        }, 4 * 1000)
                    } else {
                        if (progressElem) {
                            progressElem.style.width = "100%";
                            progressElem.classList.add('error')
                        }
                        setTimeout(() => {
                            var progressElem = document.querySelector(".fileLoadProgress")
                            if (progressElem) {
                                progressElem.style.width = 0;
                                progressElem.classList.remove('error')
                            }
                        }, 4 * 1000)
                        console.warn("error " + this.status);
                    }
                    if (clbk)
                        clbk(this.status)
                };
                xhr.open("POST", '/rest/api/meetfileUpload/' + eventid + "/" + meetRoomid + "/" + user.id, true,);
                //xhr.setRequestHeader("Content-Type", "multipart/form-data")
                xhr.setRequestHeader("X-data", encodeURI(JSON.stringify({name: file.name || "", type: file.type})))

                xhr.send(fd);


            },
            meetchattextChange: function (e) {
                if (e.keyCode == 13 && this.chatText.length > 0) {
                    this.meetChattextSend(this)
                }
            },
            meetChattextSend: function () {
                if (this.chatText.length > 0)
                    socket.emit("chatAdd", {text: this.chatText, meetid: meetRoomid});
                this.chatText = '';

            },
            chatAddSmile: function () {
                this.chatText += " :) ";
                document.getElementById("chatText").focus();
            },
            sectActive: function (item) {
                var _this = this;
                this.sect.forEach(function (e) {

                    e.isActive = (item.id == e.id);
                    if (e.isActive)
                        _this.activeSection = e.id
                    // return e;
                })
                if (window.innerWidth < 1024)
                    setTimeout(function () {
                        window.scrollTo(0, document.body.scrollHeight);
                    }, 0)
            },
            hideDesktop: function () {
                var _this = this;
                var v = arrVideo.filter(r => r.isMyVideo && r.isDesktop);
                if (v.length > 0) {

                    _this.isMyDtShow = false;
                    socket.emit("closeStream", {streamid: v[0].streamid});
                }


            },

            selectLang: function (g, item) {
                this.lang[g] = item;
                this.showLang = [false, false];
            },

            mute: function () {
                this.isMyMute = !this.isMyMute;
                micTracks.forEach(t => {
                    t.enabled = !this.isMyMute;
                })
                console.log(micTracks);
            },
            stop: function () {
                if (!this.lang[0].id || !this.lang[1].id)
                    return
                this.isStarted = false;
            },
            activateLang: function (i) {
                if (this.isStarted) {
                    this.activeLang = i;
                    this.switchAudioChannels();
                } else {
                    this.showLang = [i == 0, i == 1]
                }
            },
            startTranslate: async function () {
                var _this = this;
                if (this.isStarted) {
                    audio.forEach(a => {
                        socket.emit("langChClose", {id: a.id});
                    })
                    return this.isStarted = false;
                }
                if (!this.lang[0].id || !this.lang[1].id)
                    return this.isStarted = false;
                else {
                    audio = [];
                    var a = [0, 1]
                    for (i of a) {
                        console.log("AudioContext", i)
                        var ac = new AudioContext();
                        var source = ac.createMediaStreamSource(micStream);
                        var gainNode = ac.createGain();

                        var merger = ac.createChannelMerger(32);
                        var dest = ac.createMediaStreamDestination();
                        source.connect(gainNode);
                        gainNode.connect(merger, 0, 0);
                        merger.connect(dest);
                        gainNode.gain.value = this.activeLang == i ? 1 : 0;
                        var id = await axios.get("/rest/api/guid");
                        var item = {
                            id: id.data,
                            ac,
                            gainNode,
                            merger,
                            dest,
                            stream: dest.stream,
                            lang: this.lang[i],
                            origs: []
                        }
                        /* arrVideo.forEach(v=>{
                             var orgigSource= ac.createMediaStreamSource(v.elem.srcObject)
                             var origGainNode = ac.createGain();
                             orgigSource.connect(origGainNode);
                             origGainNode.connect(merger, 0,item.origs.length+1);
                             item.origs.push({id:v.streamid,gainNode:origGainNode });
                         })*/
                        audio.push(item)

                        dest.stream.label = JSON.stringify(this.lang[i]);
                        await publishVideoToWowzaAsync(id.data, dest.stream, WowzaCfg.data, BitrateCfg.data);

                        this.isStarted = true;
                        socket.emit("newLangCh", {lang: _this.lang[i], id: id.data});

                    }
                    arrVideo.forEach(receiverItem => {
                        console.log("startTranslate", receiverItem)
                        this.addOriginalToAudio(receiverItem.elem.srcObject, receiverItem.streamid)
                    })


                }
            },
            switchAudioChannels: function () {
                if (audio.length == 0)
                    return;
                console.log("switchAudioChannels",this.activeLang );

                for (i = 0; i <= 1; i++) {
                    console.log("switch ch:"+i,this.activeLang, audio[i].gainNode.gain.value);
                    audio[i].gainNode.gain.value = this.activeLang == i ? 1 : 0;
                    audio[i].origs.forEach(o => {
                        o.gainNode.gain.value = this.activeLang == i ? 0 : 1;
                    })
                }
                console.log("switchAudioChannels", audio)
            },
            addOriginalToAudio: function (stream, id) {
                if (audio.length == 0)
                    return;
                for (i = 0; i <= 1; i++) {
                    var source = audio[i].ac.createMediaStreamSource(stream);
                    var gainNode = audio[i].ac.createGain();
                    source.connect(gainNode);
                    gainNode.connect(audio[i].merger, 0, audio[i].origs.length);
                    var item = {id, source, gainNode}
                    audio[i].origs.push(item);
                }
                this.switchAudioChannels()
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
                            v.muted = false
                    });
                } else {
                    arrAudio.forEach(a => {
                        _this.removeAudio(a.id);
                    })
                    var audio = document.createElement("audio");
                    audio.id = item.id
                    audio.autoplay = "autoplay";
                    //  audio.controls="controls";
                    document.body.appendChild(audio);
                    var ret = await getVideoFromWowzaAync(item.id, audio, WowzaCfg.data, BitrateCfg.data);
                    var audioItem = {id: item.id, elem: audio, peerConnection: ret.peerConnection}
                    arrAudio.push(audioItem)
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
                var items = arrAudio.filter(r => r.id == id);
                if (items.length > 0) {
                    if (items[0].peerConnection) {
                        items[0].peerConnection.close();
                        items[0].peerConnection = null;

                        if (items[0].elem)
                            items[0].elem.parentNode.removeChild(items[0].elem);
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
            document.getElementById("app").style.opacity = 1;
            document.addEventListener("keydown", (e) => {
                if (e.code.indexOf("Enter") == 0) {
                    if (_this.isStarted)
                        _this.stop();
                    else
                        _this.startTranslate();
                }
                if (e.code.indexOf("Space") == 0) {
                    _this.mute();
                }
                if (e.code.indexOf("Arrow") == 0) {
                    _this.activeLang = _this.activeLang == 0 ? 1 : 0;
                }
            })
            var dt = await axios.get("/rest/api/translateLang");
            this.avaibleLangs = dt.data.languages;

            console.log(this.avaibleLangs);
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


            serverUrl = document.location.protocol + "//" + myHostname;//+"/meeting/socket";
            console.log('Connecting to server:' + serverUrl, {path: '/meeting/socket'});
            socket = io(serverUrl, {path: '/meeting/socket'});
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


                    var stream = await navigator.mediaDevices.getUserMedia({audio: true});

                    micTracks = stream.getAudioTracks();
                    micStream = new MediaStream();
                    micTracks.forEach(t => {
                        micStream.addTrack(t);
                    })


                    //  document.getElementById("myAudio").srcObject = stream;
                    var analiserElem = document.getElementById("analiserElem")
                    await createAudioAnaliser(micStream, (val) => {
                        // console.log(val, parseFloat((val/100)*100));
                        analiserElem.style.height = parseFloat((val / 100) * 100) + "%"
                    })


                    setTimeout(() => {
                        socket.emit("getMeetingVideos");
                    }, 100);
                    socket.on('newLangCh', async (data) => {
                        if (_this.langCh.length == 0) {
                            _this.langCh.push({lang: {title: "original", id: 0}, isActive: true})
                        }
                        var find = _this.langCh.filter(f => f.lang.id == data.lang.id)
                        if (find.length == 0) {
                            data.isActive = false;
                            _this.langCh.push(data);

                        }
                        console.log("newLangCh received", data)
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
                        console.log('newStream', data.streamid)

                        if (meetRoomid != data.meetid)
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
                            getVideoFromWowza(receiverItem, WowzaCfg.data, BitrateCfg.data,
                                async (ret) => {

                                    console.log('getVideoFromWowza', WowzaCfg.data)
                                    _this.addOriginalToAudio(receiverItem.srcObject, receiverItem.streamid);

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
                        }, 100);


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
                    socket.on('userDisconnnect', async (data) => {
                        arrVideo = arrVideo.filter(v => v.streamid != data.streamData.streamid)
                        removeVideo(data.streamData.streamid)
                        videoLayout();
                    })

                    socket.on('userLogin', async (data) => {
                        if (_this.users.filter(u => u.id == data.user.id).length == 0)
                            _this.users.push(data.user)
                        else
                            _this.users.forEach(u => {
                                if (u.id == data.user.id) u.isActive = true
                            })

                    })
                    socket.on('userLogOut', async (data) => {
                        _this.users.forEach(u => {
                            if (u.id == data.user.id) u.isActive = false
                        })
                    })
                    socket.on('chatAdd', async (data) => {
                        console.log("chatAdd", data);

                        data.forEach(dt => {
                            if (_this.chat.filter(c => c.id == dt.id).length == 0)
                                _this.chat.push(dt);
                        })
                        setTimeout(function () {
                            var objDiv = document.getElementById("chatBox");
                            objDiv.scrollTop = objDiv.scrollHeight;
                        }, 0)

                    })
                    var el = document.getElementById("app")
                    el.addEventListener('dragover', function (e) {
                        e.stopPropagation();
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'copy';
                    });
                    el.addEventListener('drop', function (e) {
                        e.stopPropagation();
                        e.preventDefault();
                        console.log("drop")
                        var files = e.dataTransfer.files; // Array of all files
                        for (var i = 0, file; file = files[i]; i++) {
                            if (file.type.match(/image.*/)) {
                                _this.activeSection = 2,
                                    _this.uploafFilesToQ(file, "chat")
                            }
                        }
                    });


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

    function publishVideoToWowzaAsync(p1, p2, p3, p4) {
        return new Promise((res, rej) => {
            publishVideoToWowza(p1, p2, p3, p4, (ret => {
                res(ret);
            }))
        })
    }

    function videoLayout() {
        var trBox = document.getElementById("meetVideoBox");
        trBox.style.position = "relative";
        var fullW = trBox.clientWidth - 20;

        if (arrVideo.length == 1) {
            setVideoLayout(arrVideo[0].id, 0, fullW * .05, fullW * .9)
            trBox.style.height = ((fullW / 1.777) + 20) + "px"
        }
        if (arrVideo.length == 2) {
            setVideoLayout(arrVideo[0].id, 15, 0, fullW * .5 - 5)
            setVideoLayout(arrVideo[1].id, 15, fullW * .5 + 5, fullW * .5 - 5)
            trBox.style.height = ((fullW / 1.777) + 40) + "px"
        }
        if (arrVideo.length == 3) {
            setVideoLayout(arrVideo[0].id, 15, 0, fullW * .5 - 5)
            setVideoLayout(arrVideo[1].id, 15, fullW * .5 + 5, fullW * .5 - 5)
            setVideoLayout(arrVideo[2].id, 15 + (fullW * .5 + 10) / 1.777 + 5, fullW * .25 + 5, fullW * .5 - 5)
            trBox.style.height = ((fullW * .5 + 5 / 1.777) + 20) * 2 + "px"
        }
        if (arrVideo.length == 4) {
            setVideoLayout(arrVideo[0].id, 15, 0, fullW * .5 - 5)
            setVideoLayout(arrVideo[1].id, 15, fullW * .5 + 5, fullW * .5 - 5)
            setVideoLayout(arrVideo[2].id, 15 + (fullW * .5 + 5) / 1.777 + 5, 0, fullW * .5 - 5)
            setVideoLayout(arrVideo[3].id, 15 + (fullW * .5 + 5) / 1.777 + 5, fullW * .5 + 5, fullW * .5 - 5)
            trBox.style.height = (((fullW * .5 + 5) / 1.777) + 20) * 2 + "px"
        }
        if (arrVideo.length == 5) {
            setVideoLayout(arrVideo[0].id, 15, 0, fullW * .3 - 5)
            setVideoLayout(arrVideo[1].id, 15, fullW * .3 + 5, fullW * .3 - 5)
            setVideoLayout(arrVideo[2].id, 15, (fullW * .3 + 5) * 2, fullW * .3 - 10)
            setVideoLayout(arrVideo[3].id, 15 + (fullW * .3 + 10) / 1.777 + 5, 0, fullW * .3 - 5)
            setVideoLayout(arrVideo[4].id, 15 + (fullW * .3 + 10) / 1.777 + 5, (fullW * .3 + 5) * 2, fullW * .3 - 5)
            trBox.style.height = (((fullW * .3 + 10) / 1.777) + 20) * 3 + "px"
        }
        if (arrVideo.length == 6) {
            setVideoLayout(arrVideo[0].id, 15, 0, fullW * .3 - 5)
            setVideoLayout(arrVideo[1].id, 15, fullW * .3 + 5, fullW * .3 - 5)
            setVideoLayout(arrVideo[2].id, 15, (fullW * .3 + 5) * 2, fullW * .3 - 10)
            setVideoLayout(arrVideo[3].id, 15 + (fullW * .3 + 10) / 1.777 + 5, 0, fullW * .3 - 5)
            setVideoLayout(arrVideo[4].id, 15 + (fullW * .3 + 10) / 1.777 + 5, (fullW * .3 + 5) * 1, fullW * .3 - 5)
            setVideoLayout(arrVideo[5].id, 15 + (fullW * .3 + 10) / 1.777 + 5, (fullW * .3 + 5) * 2, fullW * .3 - 5)
            trBox.style.height = (((fullW * .3 + 10) / 1.777) + 20) * 3 + "px"
        }
        arrVideo.forEach(e => {

        })

    }

    function setVideoLayout(id, top, left, width) {
        console.log("meetVideoItem_" + id)
        var elem = document.getElementById("meetVideoItem_" + id);

        elem.style.position = "absolute";
        elem.style.top = top + "px";
        elem.style.left = (10 + left) + "px";
        elem.style.width = width + "px";
    }
}



