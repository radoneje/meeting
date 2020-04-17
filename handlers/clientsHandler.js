const { v4: uuidv4 } = require('uuid');
var axios= require('axios')

class Clients{

    constructor() {
        this.clients=[];
    }
    add(data){
        var _this=this;
        data.id=uuidv4();
        data.isActive=true;
        data.user.isActive=true;
        data.date=new Date();
        data.isVideo=false;
        this.clients.push(data);
        this.emit=this.sendToRoomUsers
        setTimeout(()=>{_this.sendToRoomUsers("userConnnect",  data.user,data.roomid)}, 0);
        return data.id;
    }
    disActive(id){
        var _this=this;
        this.clients.forEach(c=>{
            if(c.socket.id==id) {
                c.isActive = false;
                c.isVideo=false;
                _this.sendToRoomUsers("userDisconnnect", {id:c.user.id,streamData:c.streamData}, c.meetid)
            }
        })
    }
    startVideo(id, socketid) {
        var _this = this;
        this.clients.forEach(c => {
            if (c.id == id) {
                c.isVideo = true;
                _this.sendToRoomAdmins("selfVideoStarted", {id:c.user.id, socketid:socketid}, c.roomid)
            }
        })
    }
    sendToRoomUsers(msg, data, meetid){
        this.clients.forEach(c=>{
            if(c.isActive && c.meetid==meetid)
                c.socket.emit(msg, data);
        });
    }

    sendToUser(msg, data, userid, meetid){
        console.log("sentToUser - ", userid)
        this.clients.forEach(c=>{
            if(c.isActive && c.meetid==meetid &&  c.user.id==userid )
                c.socket.emit(msg, data);
        });
    }
    fwd(msg, data){
        this.clients.forEach(c=>{
            if(c.isActive && c.socket.id==data.to )
                c.socket.emit(msg, data);
        });
    }




}

var clients= new Clients();

module.exports = clients;