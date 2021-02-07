const fs = require('fs')

module.exports = {
    makeId,
    logGameScore,
    scoreBoard
}

function makeId(length) {
    var result           = '';
    var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for ( var i = 0; i < length; i++ ) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

function logGameScore(players) {
    try {
        var data = fs.readFileSync(__dirname + '/output/gameScores.json')
        var json = JSON.parse(data)

        for(let player of players) {
            let user = {
                nickName: player.nickName,
                score: player.snake.length,
                date: new Date().toISOString()
            }
            json.push(user);
        }     
        fs.writeFile(__dirname + '/output/gameScores.json', JSON.stringify(json), (err, result) => {
            if(err) {
                console.log(err);
            } else {
                console.log('print results ok')
            }
        })

    } catch(err) {
        console.log('Err registering scores: ', err)
        return
    }
}

function scoreBoard() {
    try {
        var data = fs.readFileSync(__dirname + '/output/gameScores.json')
        var scoreBoard = JSON.parse(data)
        return scoreBoard
    } catch(err) {
        console.log('Err registering scores: ', err)
        return
    }
}


    // let stream = fs.createWriteStream('./output/gameScores.json', {flags:'a'})
    // try {
    //     for(let player of players) {
    //         let user = {
    //             nickName: player.nickName,
    //             score: player.snake.length
    //         }
    //         stream.write(JSON.stringify(user))
    //     }
    // } catch(err) {
    //     console.log('Err registering scores: ', err)
    //     return
    // }
