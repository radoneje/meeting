const sect=[
    {
        title: "Лента",
        isActive: false,
        id: 0,
        logo: '/images/logofeed.svg',
        logoactive: '/images/logofeeda.svg'
    },
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
]
const meetchatTextOnPaste= function (e) {
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
}
const chatFileClick= function () {
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
}
const uploafFilesToChat= function (file, clbk) {
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


}
const meetchattextChange= function (e) {
    if (e.keyCode == 13 && this.chatText.length > 0) {
        this.meetChattextSend(this)
    }
}
const meetChattextSend= function () {
    if (this.chatText.length > 0)
        socket.emit("chatAdd", {text: this.chatText, meetid: meetRoomid});
    this.chatText = '';

}
const chatAddSmile= function () {
    this.chatText += " :) ";
    document.getElementById("chatText").focus();
}
const sectActive= function (item) {
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
}
const initChatAndQ=function (socket, _this) {
    socket.on('userDisconnnect', async (data) => {
        if(arrVideo) {
            arrVideo = arrVideo.filter(v => v.streamid != data.streamData.streamid)
            removeVideo(data.streamData.streamid)
            videoLayout();
        }
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