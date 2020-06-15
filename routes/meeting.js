var express = require('express');
var router = express.Router();

/* GET home page. */

router.get('/videoelem/:videoid',  async (req, res, next) =>{
    res.render("videoElem",{id:req.params.videoid})
})
router.get('/translator/:eventid/:meetingId', async(req, res, next)=> {
    req.params.eventid=parseInt(req.params.eventid)
    if(!Number.isInteger(req.params.eventid))
        return res.send(404);

    var users=await req.knex.select("*").from("t_eventusers").where({isDeleted:false, eventid:req.params.eventid})
    if(users.length<1)
        return res.send(404);

    var user=users[0];

    var curruser=await req.knex.select("*").from("t_eventusers").where({isDeleted:false, id:req.params.meetingId})
    if(curruser.length<1)
        return res.redirect("/login/"+req.params.eventid+"?redirect="+encodeURI('/meeting/translator/'+req.params.eventid+"/"+req.params.meetingId))
    // req.session["user"+user.eventid]  =  curruser[0]
    // if(!req.session["user"+user.eventid])
    //    return res.redirect("/login/"+req.params.eventid+"?redirect="+encodeURI('/meeting/'+req.params.eventid+"/"+req.params.meetingId))
    res.render('translator', { title: 'ON.event Кабина перевода',eventid:req.params.eventid ,meetRoomid:req.params.meetingId});;//, user: req.session["user"+user.eventid]});

});
router.get('/external/:eventid/:meetingId', async(req, res, next)=> {
    req.params.eventid=parseInt(req.params.eventid)
    if(!Number.isInteger(req.params.eventid))
        return res.send(404);


    var users=await req.knex.select("*").from("t_eventusers").where({isDeleted:false, eventid:req.params.eventid})
    if(users.length<1)
        return res.send(404);

    var user=users[0];

    var curruser=await req.knex.select("*").from("t_eventusers").where({isDeleted:false, id:req.params.meetingId})
    if(curruser.length<1)
        return res.redirect("/login/"+req.params.eventid+"?redirect="+encodeURI('/meeting/external/'+req.params.eventid+"/"+req.params.meetingId))
    // req.session["user"+user.eventid]  =  curruser[0]
    // if(!req.session["user"+user.eventid])
    //    return res.redirect("/login/"+req.params.eventid+"?redirect="+encodeURI('/meeting/'+req.params.eventid+"/"+req.params.meetingId))
    res.render('external', { title: 'ON.event Внешние источники',eventid:req.params.eventid ,meetRoomid:req.params.meetingId});;//, user: req.session["user"+user.eventid]});

});

router.get('/:eventid/:meetingId/',  async (req, res, next) =>{
    req.params.eventid=parseInt(req.params.eventid)
    if(!Number.isInteger(req.params.eventid))
        return res.send(404);


    var users=await req.knex.select("*").from("t_eventusers").where({isDeleted:false, eventid:req.params.eventid})
    if(users.length<1)
        return res.send(404);

    var user=users[0];

    var curruser=await req.knex.select("*").from("t_eventusers").where({isDeleted:false, id:req.params.meetingId})
    if(curruser.length<1)
        return res.redirect("/login/"+req.params.eventid+"?redirect="+encodeURI('/meeting/'+req.params.eventid+"/"+req.params.meetingId+(req.query.novideo=="novideo"?"?novideo=novideo":"")))
   // req.session["user"+user.eventid]  =  curruser[0]

   // if(!req.session["user"+user.eventid])
    //    return res.redirect("/login/"+req.params.eventid+"?redirect="+encodeURI('/meeting/'+req.params.eventid+"/"+req.params.meetingId))
    res.render('meeting', { title: 'ON.event Переговорная комната',eventid:req.params.eventid ,meetRoomid:req.params.meetingId, novideo:req.query.novideo=="novideo"?true:false});;//, user: req.session["user"+user.eventid]});

})

module.exports = router;