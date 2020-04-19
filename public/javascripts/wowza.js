window.RTCPeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection;
window.RTCIceCandidate = window.RTCIceCandidate || window.mozRTCIceCandidate || window.webkitRTCIceCandidate;
window.RTCSessionDescription = window.RTCSessionDescription || window.mozRTCSessionDescription || window.webkitRTCSessionDescription;

var peerConnectionConfig = {
    iceServers: [
        {
            'urls': 'turn:re.rustv.ru:3478',
            'credential': 'user1',
            'username': "user1"
        }
    ]};



async function publishVideoToWowza(id,stream,wssUrl,bitrate, clbk, err){

    var peerConnection=null;
    var wsConnection = null;
    wsConnection = new WebSocket(wssUrl.url);
    wsConnection.binaryType = 'arraybuffer';
    var streamInfo = {applicationName:wssUrl.applicationName, streamName:id, sessionId:"123"};
    wsConnection.onopen = async () =>{
       // console.log("wsConnection.onopen");
        peerConnection = new RTCPeerConnection(peerConnectionConfig);
        peerConnection.onicecandidate = gotIceCandidate;
        stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));
        var description=await peerConnection.createOffer();
        await gotDescription(description)

    }
    wsConnection.onclose = function () {
        console.log("wsConnection.onclose");
        if(err)
            err();
    }

    wsConnection.onerror = function (evt) {
        console.log("wsConnection.onerror: " + JSON.stringify(evt));
        if(err)
            err();
    }
    wsConnection.onmessage = async (evt)=> {
        // console.log("wsConnection.onmessage: " + evt.data);
        //console.log("wsConnection. onmessage: " + evt.data); console.log("wsConnection. receiver onmessage: " + evt.data);
        var msgJSON = JSON.parse(evt.data);
        var msgStatus = Number(msgJSON['status']);
        var msgCommand = msgJSON['command'];
        if (msgStatus != 200) {
            $("#sdpDataTag").html(msgJSON['statusDescription']);
            console.warn('err 0')
            // stopPublisher();
        }
        else {
            var sdpData = msgJSON['sdp'];
            if (sdpData !== undefined) {
             //   console.log('sdp: ', msgJSON['sdp']);
                var enhanceData = new Object();
                enhanceData.audioBitrate = Number(bitrate.audio);
                enhanceData.videoBitrate = Number(bitrate.video);
                sdpData.sdp = enhanceSDP(sdpData.sdp, enhanceData);
                await peerConnection.setRemoteDescription(new RTCSessionDescription(sdpData))
                if(clbk)
                    clbk({streamid:id, peerConnection:peerConnection});
            }
            var iceCandidates = msgJSON['iceCandidates'];
            if (iceCandidates !== undefined) {
                for (var index in iceCandidates) {
                    peerConnection.addIceCandidate(new RTCIceCandidate(iceCandidates[index]));
                }
            }
        }
    }
    function gotIceCandidate(event) {
    }
    async function gotDescription(description) {
        // Uncomment to debug the SDP if_definst_nformation
       // description.sdp=description.sdp.replace('VP8/90000', 'H264/90000')
        await peerConnection.setLocalDescription(description)
        wsConnection.send('{"direction":"publish", "command":"sendOffer", "streamInfo":' + JSON.stringify(streamInfo) + ', "sdp":' + JSON.stringify(description) + ', "userData":' + JSON.stringify({myDt:1223}) + '}')
    }

}
async function getVideoFromWowza(receiverItem, wssUrl, BitrateCfg, clbk) {
    var peerConnection = null;
    var wsConnection = null;
    var repeaterRetryCount = 0;
    var newAPI = false;
    var doGetAvailableStreams = false;
    var repeaterRetryCount=0;
    var streamInfo = {applicationName:wssUrl.applicationName, streamName:receiverItem.id, sessionId:"123"};
//console.log("streamInfo", streamInfo);
    wsConnection = new WebSocket(wssUrl.url);
 //   console.log(wssUrl.url)
    wsConnection.binaryType = 'arraybuffer';
    wsConnection.onopen = function () {
       // console.log("wsConnection receiver onopen");
        peerConnection = new RTCPeerConnection(peerConnectionConfig);
       // peerConnection.onicecandidate = gotIceCandidate;
        peerConnection.ontrack = gotRemoteTrack;

      //  console.log("wsConnection send");
        sendGetOffer();
         //  wsConnection.send('{"direction":"play", "command":"getOffer"}')
            // wsConnection.send('{"direction":"play", "command":"getOffer", "streamInfo":'+JSON.stringify(streamInfo)+', "userData":'+JSON.stringify({myDt:1223})+'}');
          // wsConnection.send('{"direction":"play", "command":"getOffer", "streamInfo":'+JSON.stringify(streamInfo)+', "userData":'+JSON.stringify({a:111})+'}');

    }
    wsConnection.onmessage = async (evt) => {
     //   console.log("wsConnection.onmessage: " + evt.data);
        var msgJSON = JSON.parse(evt.data);

        var msgStatus = Number(msgJSON['status']);
        var msgCommand = msgJSON['command'];
        if (msgStatus == 514 || msgStatus == 504) // repeater stream not ready
        {
            repeaterRetryCount++;
            if (repeaterRetryCount < 10)
            {
                setTimeout(sendGetOffer, 500);
            }
        }
        else if (msgStatus != 200)
        {
            console.warn("ws receiver error!")
        }
        else{
            var streamInfoResponse = msgJSON['streamInfo'];
            if (streamInfoResponse !== undefined) {
                streamInfo.sessionId = streamInfoResponse.sessionId;
           //     console.log("streamInfo.sessionId",streamInfo.sessionId)
            }
            var sdpData = msgJSON['sdp'];
            if (sdpData !== undefined) {
                //console.log('sdp: ' + JSON.stringify(msgJSON['sdp']));
                await peerConnection.setRemoteDescription(new RTCSessionDescription(msgJSON.sdp));
                var answ= await peerConnection.createAnswer();//WgotDescription, errorHandler);
                await peerConnection.setLocalDescription(answ);
                wsConnection.send('{"direction":"play", "command":"sendResponse", "streamInfo":'+JSON.stringify(streamInfo)+', "sdp":'+JSON.stringify(answ)+', "userData":'+JSON.stringify({myDt:1223})+'}');
                if(clbk)
                    clbk({peerConnection:peerConnection})
            }
            var iceCandidates = msgJSON['iceCandidates'];
            if (iceCandidates !== undefined) {
                for (var index in iceCandidates) {
                    peerConnection.addIceCandidate(new RTCIceCandidate(iceCandidates[index]));
                }
            }
        }


    }
    wsConnection.onerror = async (evt) => {
        console.warn("wsConnection receiver .error: " + evt);
    }
    wsConnection.onclose = function()
    {
     //   console.log("wsConnection receiver .onclose");
    }

    function sendGetOffer() {
      //  console.log("sendGetOffer: ");
        wsConnection.send( JSON.stringify({"direction":"play", "command":"getOffer", "streamInfo": streamInfo , "userData": {myDt: 1223} }));

    }
    function gotRemoteTrack(event) {
      //  console.log('receiver gotRemoteTrack: kind:' + event.track.kind + ' stream:' + event.streams[0]);
        try {
            receiverItem.elem.srcObject = event.streams[0];
        } catch (error) {
            receiverItem.elem.src = window.URL.createObjectURL(event.streams[0]);
        }
    }
    function gotIceCandidate() {
        
    }

}
function getrtpMapID(line) {
    var findid = new RegExp('a=rtpmap:(\\d+) (\\w+)/(\\d+)');
    var found = line.match(findid);
    return (found && found.length >= 3) ? found : null;
}


function enhanceSDP(sdpStr, enhanceData) {
        // This is a very simple enhance function.
        // We find the audio and video locations in the SDP file
        // We find the corresponding c= lines and then we add in
        // the bandwidth controls for the selected bitrates.
        //
        //
        var sdpLines = sdpStr.split(/\r\n/);
        var sdpSection = 'header';
        var hitMID = false;
        var sdpStrRet = '';

        sdpLines = sdpStr.split(/\r\n/);

        for (var sdpIndex in sdpLines) {
            var sdpLine = sdpLines[sdpIndex];

            if (sdpLine.length <= 0)
                continue;

            if (sdpLine.includes("transport-cc"))
                continue;
            if (sdpLine.includes("goog-remb"))
                continue;
            if (sdpLine.includes("nack"))
                continue;


            sdpStrRet += sdpLine;

            if (sdpLine.indexOf("m=audio") === 0) {
                sdpSection = 'audio';
                hitMID = false;
            } else if (sdpLine.indexOf("m=video") === 0) {
                sdpSection = 'video';
                hitMID = false;
            } else if (sdpLine.indexOf("a=rtpmap") == 0) {
                sdpSection = 'bandwidth';
                hitMID = false;
            }

            if (sdpLine.indexOf("a=mid:") === 0 || sdpLine.indexOf("a=rtpmap") == 0) {
                if (!hitMID) {
                    if ('audio'.localeCompare(sdpSection) == 0) {
                        if (enhanceData.audioBitrate !== undefined) {
                            sdpStrRet += '\r\nb=CT:' + (enhanceData.audioBitrate);
                            sdpStrRet += '\r\nb=AS:' + (enhanceData.audioBitrate);
                        }
                        hitMID = true;
                    } else if ('video'.localeCompare(sdpSection) == 0) {
                        if (enhanceData.videoBitrate !== undefined) {
                            sdpStrRet += '\r\nb=CT:' + (enhanceData.videoBitrate);
                            sdpStrRet += '\r\nb=AS:' + (enhanceData.videoBitrate);
                            if (enhanceData.videoFrameRate !== undefined) {
                                sdpStrRet += '\r\na=framerate:' + enhanceData.videoFrameRate;
                            }
                        }
                        hitMID = true;
                    } else if ('bandwidth'.localeCompare(sdpSection) == 0) {
                        var rtpmapID;
                        rtpmapID = getrtpMapID(sdpLine);
                        if (rtpmapID !== null) {
                            var match = rtpmapID[2].toLowerCase();
                            if (('vp9'.localeCompare(match) == 0) || ('vp8'.localeCompare(match) == 0) || ('h264'.localeCompare(match) == 0) ||
                                ('red'.localeCompare(match) == 0) || ('ulpfec'.localeCompare(match) == 0) || ('rtx'.localeCompare(match) == 0)) {
                                if (enhanceData.videoBitrate !== undefined) {
                                    sdpStrRet += '\r\na=fmtp:' + rtpmapID[1] + ' x-google-min-bitrate=' + (enhanceData.videoBitrate) + ';x-google-max-bitrate=' + (enhanceData.videoBitrate);
                                }
                            }

                            if (('opus'.localeCompare(match) == 0) || ('isac'.localeCompare(match) == 0) || ('g722'.localeCompare(match) == 0) || ('pcmu'.localeCompare(match) == 0) ||
                                ('pcma'.localeCompare(match) == 0) || ('cn'.localeCompare(match) == 0)) {
                                if (enhanceData.audioBitrate !== undefined) {
                                    sdpStrRet += '\r\na=fmtp:' + rtpmapID[1] + ' x-google-min-bitrate=' + (enhanceData.audioBitrate) + ';x-google-max-bitrate=' + (enhanceData.audioBitrate);
                                }
                            }
                        }
                    }
                }
            }


            sdpStrRet += '\r\n';
        }
        return sdpStrRet;
    }

