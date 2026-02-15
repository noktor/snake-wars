const fs = require('fs')

const MAX_NICKNAME_LENGTH = 30

function normalizeNickname(s) {
    if (s == null || typeof s !== 'string') return ''
    return s.trim().slice(0, MAX_NICKNAME_LENGTH)
}

module.exports = {
    makeId,
    logGameScore,
    scoreBoard,
    normalizeNickname,
    MAX_NICKNAME_LENGTH
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

const SCORES_PATH = __dirname + '/output/gameScores.json'

function logGameScore(winner) {
    if (!winner || !winner.nickName) return
    try {
        let data = { wins: {} }
        try {
            const raw = fs.readFileSync(SCORES_PATH, 'utf8')
            const parsed = JSON.parse(raw)
            if (parsed && typeof parsed.wins === 'object') data = parsed
        } catch (_) {}
        const key = normalizeNickname(winner.nickName)
        if (key) {
            data.wins[key] = (data.wins[key] || 0) + 1
            fs.writeFile(SCORES_PATH, JSON.stringify(data), function (err) {
                if (err) console.log(err)
            })
        }
    } catch (err) {
        console.log('Err registering scores: ', err)
    }
}

function scoreBoard() {
    try {
        const raw = fs.readFileSync(SCORES_PATH, 'utf8')
        const data = JSON.parse(raw)
        const wins = data && typeof data.wins === 'object' ? data.wins : {}
        const list = Object.entries(wins)
            .filter(function (e) { return e[1] > 0 })
            .map(function (e) { return { nickName: e[0], wins: e[1] } })
            .sort(function (a, b) { return (b.wins || 0) - (a.wins || 0) })
        return list
    } catch (_) {
        return []
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
