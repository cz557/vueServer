const express=require('express');
const mysql=require('mysql');
const app=express();
const proxy=require('http-proxy-middleware');
const bodyparser=require('body-parser');
const cors=require('cors');
const axios=require('axios');
const session = require('express-session');
var cookieParser = require('cookie-parser');
const multer = require('multer');
const fs = require('fs');
//使用文件上传中间件
app.use(multer({dest:'public/userImg/'}).any())

app.use(cors());
// app.use(cookieParser('scret'))

const jwt = require('jsonwebtoken');

app.use(bodyparser.json()); // 使用bodyparder中间件，
app.use(bodyparser.urlencoded({ extended: true }));

app.use(express.static("public"));

app.listen(8000,()=>{
    console.log("server is listening")
});

//连接数据库
var conn=mysql.createConnection({
    "host":"127.0.0.1",
    "user":"root",
    "password":"",
    "database":"yixi"
});
app.use('/api',proxy({
    target:'https://www.yixi.tv',
    changeOrigin:true
}));


app.post('/send',(req,res)=>{
    let phone=req.body.phone;
    let code=Math.floor(Math.random()*10000);

    axios.post('https://open.ucpaas.com/ol/sms/sendsms',{
        "sid":"c70d8c8eae18ce554eb188e78129541f",
        "token":"f0c5e6e5df92735c88c63b748a975eee",
        "appid":"19011d04d46945de9f16e1971dad6f73",
        "templateid":"492940",
        "param":code,
        "mobile":phone,
    }).then(result=>{
        if(result.status==200){
            let userObj={phone,code}
            fs.writeFile('./userMessage/'+phone+'.txt',JSON.stringify(userObj),(err,result)=>{
                if(err) {console.log(err)}
                else{
                    //一分钟有效期，删除文件
                    setTimeout(()=>{
                        fs.unlink('./userMessage/'+phone+'.txt', ()=>{})
                    },1000*60)
                    
                    res.send(code.toString());  
                }
            })
        }
        console.log(res)
    })
    
})

//添加收藏
app.get('/collect',(req,res)=>{
    let uid=req.query.uid;
    let cid=req.query.cid;
    let arr=[uid,cid];
    console.log(arr);
    let sql="insert into collection values(0,?,?)";
    conn.query(sql,arr,(err,result)=>{
        if(err) throw err;
        res.send("collect success")
    })

})

//获取用户收藏信息
app.get('/getCollect',(req,res)=>{
    console.log(req.query.uid)
    // let sql="select user_id from user where user_name="+req.query.uid;
    let sql="SELECT d.col_id,d.col_uid,d.col_cid FROM user u,collection d WHERE u.user_name=d.col_uid";
    conn.query(sql,(err,result)=>{
        if(err) throw err;
        res.send(result)
    })
    
})

//登录
app.post('/login',(req,res)=>{
    let phone=req.body.phone;
    let nickname=req.body.user_nickname;
    let code =req.body.code;
    console.log(phone,code);
    let userObj=null;
    fs.readFile('./userMessage/'+phone+'.txt',(err,result)=>{
        //一分钟有效期过，文件被删除
        if(err){
            res.json({status:0,mess:'codeError',phone})
        }
        else {
            userObj=JSON.parse(result);
            console.log(userObj);
             //检查短信验证码是否正确
            if(phone==userObj.phone&&code==userObj.code){
                //生成token
            let content ={phone:phone}; // 要生成token的主题信息
            let secretOrPrivateKey="jwt";// 这是加密的key（密钥）
            let token = jwt.sign(content, secretOrPrivateKey, {
                expiresIn: 60*60*1  // 1小时过期
            })
            //根据电话判断数据库中是否有该用户，有则返回token
            //没有则插入数据库登陆返回token
            //取出数据库中所有数据
            let sql="select user_name from user";
            conn.query(sql,(err,result)=>{
                if(err) throw err;
                result=JSON.parse(JSON.stringify(result));
                console.log(result);
                if(result.find(r=>r.user_name==phone)){
                    res.json({status:1,mess:'ok',token,phone})
                }else{
                    sql=`insert into user (user_id,user_name,user_nickname) values(0,'${phone}','${nickname}')`;
                    conn.query(sql,(err,result)=>{
                        if(err) throw err;
                        res.json({status:1,mess:'ok',token,phone})
                    })
                }
            })
        }else{
            res.json({status:0,mess:'codeError',phone})
        }
        }
    })
   
})

//修改时获取用户信息
app.get('/getUser',(req,res)=>{
    let sql='select * from user where user_name='+req.query.phone;
    conn.query(sql,(err,result)=>{
        if(err) throw err;
        res.json(result)
    })
})

//修改更新用户信息
app.post('/saveMessage',(req,res)=>{
    let datas=req.body.data;
    console.log(datas)
    let arr=[];
    arr.push(datas.user_nickname);
    arr.push(datas.user_img);
    arr.push(datas.user_adname);
    arr.push(datas.user_adphone);
    arr.push(datas.user_address);
    arr.push(datas.user_origin);
    arr.push(datas.user_id);
    console.log(arr)
    let sql='update user set user_nickname=?,user_img=?,user_adname=?,user_adphone=?,user_address=?,user_origin=? where user_id=?';
    conn.query(sql,arr,(err,result)=>{
        if(err) throw err;
        res.send("save sucess")
    })
})

//每次切换都去调用此接口 用来判断token是否失效 或者过期
app.post('/checkUser',(req,res)=>{
    // let token = req.get("Authorization"); // 从Authorization中获取token
    let token = req.body.token;
    let secretOrPrivateKey="jwt"; // 这是加密的key（密钥）
    jwt.verify(token, secretOrPrivateKey, (err, decode)=> {
        if (err) {  //  时间失效的时候 || 伪造的token
            res.send({'status':10010,msg:"fail"});
        } else {
            res.send({'status':10000,msg:'success'});
        }
    })
});

//获取用户上传头像
app.post('/saveImg',(req,res)=>{
    let imgUrl = req.files;
    res.send({imgUrl:"http://127.0.0.1:8000/userImg/"+imgUrl[0].filename})
})
