package auth

import (
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"net/http"
	"panel/database"
	"sync"
)

var sessions = make(map[string]string)

var lock sync.RWMutex

// 登录

func Login(username, password string) string {

	var hash string

	err :=
		database.DB.QueryRow(
			"SELECT password FROM users WHERE username=?",
			username,
		).Scan(&hash)

	if err != nil {

		return ""

	}

	err =
		bcrypt.CompareHashAndPassword(
			[]byte(hash),
			[]byte(password),
		)

	if err != nil {

		return ""

	}

	sessionID :=
		uuid.New().String()

	lock.Lock()

	sessions[sessionID] = username

	lock.Unlock()

	return sessionID

}

// 检查Cookie

func Check(r *http.Request) bool {

	cookie, err :=
		r.Cookie("session")

	if err != nil {

		return false

	}

	lock.RLock()

	defer lock.RUnlock()

	_, ok :=
		sessions[cookie.Value]

	return ok

}

// 设置Cookie

func SetCookie(
	w http.ResponseWriter,
	session string,
) {

	http.SetCookie(w, &http.Cookie{

		Name: "session",

		Value: session,

		Path: "/",

		HttpOnly: true,

		MaxAge: 86400,

		SameSite: http.SameSiteLaxMode,
	})

}

func GetUser(
	r *http.Request,
) string {

	cookie, err :=
		r.Cookie("session")

	if err != nil {

		return ""

	}

	lock.RLock()

	defer lock.RUnlock()

	return sessions[cookie.Value]

}
func Logout(r *http.Request) {


	cookie,err :=
		r.Cookie("session")


	if err != nil {
		return
	}



	lock.Lock()

	delete(
		sessions,
		cookie.Value,
	)

	lock.Unlock()


}
