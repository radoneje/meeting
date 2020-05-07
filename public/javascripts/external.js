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
            sect: sect,
            constraints: null,
            activeSection: 2,
            eventRooms: [],
            firstConnect: true,
            user: user,
            noWebrtc: false,
            eventRooms: [],
            chat: [],
            chatText: '',
            users: [],
            avaibleLangs: [],
            lang: [{}, {}],
            showLang: [false, false],

            langCh: [],
            showLangCh: false,
            devError: null,
            inputDevices: []
        },
        methods: {
            meetchatTextOnPaste: meetchatTextOnPaste,
            chatFileClick: chatFileClick,
            uploafFilesToChat: uploafFilesToChat,
            meetchattextChange: meetchattextChange,
            meetChattextSend: meetChattextSend,
            chatAddSmile: chatAddSmile,
            sectActive: sectActive,
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
            startTranslate_old: async function () {
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
                console.log("switchAudioChannels", this.activeLang);

                for (i = 0; i <= 1; i++) {
                    console.log("switch ch:" + i, this.activeLang, audio[i].gainNode.gain.value);
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
            },

            showLangDialog: function (item) {

                this.inputDevices.forEach(d => {
                    if (d.id == item.id) {
                        d.showLang = true;
                    }
                });
                this.inputDevices = this.inputDevices.filter(() => {
                    return true
                })
            },
            selectLang(lang, item) {
                this.inputDevices.forEach(d => {
                    if (d.id == item.id) {
                        if (!d.isStarted)
                            d.lang = lang;
                        d.showLang = false;
                    }
                });
                this.inputDevices = this.inputDevices.filter(() => {
                    return true
                })
            },
            startTranslate(item) {
                var _this = this;
                this.inputDevices.forEach(async d => {
                    if (d.id == item.id) {
                        if (d.isStarted) {
                            d.isStarted = false
                            if (d.peerConnection) {
                                d.peerConnection.close();
                                d.peerConnection = null;
                            }
                            socket.emit("langChClose", {id: d.id});
                            _this.inputDevices = this.inputDevices.filter(() => {
                                return true
                            })
                        } else {
                            var ret = await publishVideoToWowzaAsync(d.id, d.stream, WowzaCfg.data, BitrateCfg.data);
                            d.isStarted = true;
                            d.peerConnection = ret.peerConnection;
                            socket.emit("newLangCh", {lang: item.lang, id: d.id});
                            console.log("start Transl", d.isStarted)
                            _this.inputDevices = this.inputDevices.filter(() => {
                                return true
                            })
                        }
                    }
                });

            },
            soloAudio: function (item) {

                this.inputDevices.forEach(d => {
                    if (d.id == item.id) {
                        d.playerMuted = !d.playerMuted;
                        d.elem.muted = d.playerMuted;
                    }
                });
                this.inputDevices = this.inputDevices.filter(() => {
                    return true
                })
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
                    try {
                        var devicesBuf = [];
                        var mediaDevices = await navigator.mediaDevices.enumerateDevices();
                        mediaDevices = mediaDevices.filter(device => device.kind == "audioinput");
                        initAudioDevices(mediaDevices, _this, () => {
                            console.log("devices init complite");
                        });


                    } catch (e) {
                        _this.devError = "ошибка инициализации аудио устройств " + e
                    }

                    /* var stream = await navigator.mediaDevices.getUserMedia({audio: true});

                     micTracks = stream.getAudioTracks();
                     micStream = new MediaStream();
                     micTracks.forEach(t => {
                         micStream.addTrack(t);
                     })*/


                    //  document.getElementById("myAudio").srcObject = stream;
                    /* var analiserElem = document.getElementById("analiserElem")
                     await createAudioAnaliser(micStream, (val) => {
                         // console.log(val, parseFloat((val/100)*100));
                         analiserElem.style.height = parseFloat((val / 100) * 100) + "%"
                     })*/

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

    function initAudioDevices(mediaDevices, _this, clbk) {
        if (mediaDevices.length == 0) {
            clbk();
            return;
        }
        var device = mediaDevices.shift();

        axios.get("/rest/api/guid")
            .then((ret => {
                console.log("guid", ret.data)
                device.id = ret.data
                device.isStarted = false;
                device.error = false;
                device.lang = {};
                device.showLang = false;
                device.playerMuted = true;
                _this.inputDevices.push(device)
                console.log("device", device)
                navigator.mediaDevices.getUserMedia({audio: {deviceId: device.id}})
                    .then((stream) => {
                        device.stream = stream;

                        device.elem = document.getElementById("audioElem" + device.id);
                        device.elem.muted = true;
                        device.elem.srcObject = stream;
                        console.log("stream",stream, stream.getAudioTracks()[0])
                        //console.log("analiserElem", analiserElem, device.id);
                        createAudioAnaliser(stream, (val) => {

                            var analiserElem = document.getElementById("analiserElem" + device.id)
                            analiserElem.style.width = parseFloat((val / 100) * 100) + "%"
                         //   console.log(device.id,analiserElem.id, analiserElem.style.width);
                        })
                            .then(() => {
                                initAudioDevices(mediaDevices, _this, clbk)
                            })
                            .catch((e) => {
                                console.warn("Error create analiser", e)
                                initAudioDevices(mediaDevices, _this, clbk)
                            })
                    })
                    .catch((e) => {
                        console.warn("Error getUserMedia ", e)
                        initAudioDevices(mediaDevices, _this, clbk)
                    })
            }))
            .catch((e) => {
                console.warn("Error get guid ", e)
                initAudioDevices(mediaDevices, _this, clbk)
            })


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
}



