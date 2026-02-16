(function () {
    const NICKNAME_KEY = 'snake_wars_nickname'
    const MAX_NICKNAME_LENGTH = 30

    const nickInput = document.getElementById('nickNameInput')
    const errorEl = document.getElementById('errorMessage')
    const snakeBtn = document.getElementById('playSnakeBtn')
    const brBtn = document.getElementById('playBrBtn')
    const heaveHoBtn = document.getElementById('playHeaveHoBtn')

    function getNickname() {
        if (!nickInput) return ''
        return (nickInput.value || '').trim().slice(0, MAX_NICKNAME_LENGTH)
    }

    function goToGame(path) {
        const nick = getNickname()
        if (!nick) {
            if (errorEl) errorEl.textContent = 'Please enter a nickname (max 30 characters).'
            return
        }
        try {
            sessionStorage.setItem(NICKNAME_KEY, nick)
        } catch (e) {}
        window.location.href = path
    }

    if (nickInput) {
        nickInput.setAttribute('maxlength', String(MAX_NICKNAME_LENGTH))
        try {
            const saved = sessionStorage.getItem(NICKNAME_KEY)
            if (saved) nickInput.value = saved
        } catch (e) {}
    }

    if (snakeBtn) snakeBtn.addEventListener('click', () => goToGame('snake/'))
    if (brBtn) brBtn.addEventListener('click', () => goToGame('br/'))
    if (heaveHoBtn) heaveHoBtn.addEventListener('click', (e) => { e.preventDefault() })

    if (errorEl && nickInput) {
        nickInput.addEventListener('input', () => { errorEl.textContent = '' })
    }
})()
