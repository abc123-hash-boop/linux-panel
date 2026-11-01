package websocket

import "strings"

// TitlePromptCommand 让 bash 在每次显示提示符前，通过 OSC 0 转义序列
// (ESC ] 0 ; <title> BEL) 上报窗口标题，格式与 Debian/Ubuntu 默认的
// xterm 标题一致：user@host: cwd。
//
// 前端 xterm.js 通过 onTitleChange 接收这个序列，所以标签上显示的
// 就是 shell 真正设置的标题；vim、htop、ssh 等程序自己设置的标题
// 也会原样显示。
const TitlePromptCommand = `printf '\033]0;%s@%s: %s\007' "${USER:-$(id -un)}" "${HOSTNAME%%.*}" "${PWD/#$HOME/\~}"`

// TerminalEnv 在给定环境变量的基础上：
//   - 设置 TERM=xterm-256color（服务进程本身没有 TERM，bash 会当作哑终端）
//   - 如果没有 PROMPT_COMMAND，就注入 TitlePromptCommand
//
// 用户在 ~/.bashrc 里自己设置的 PROMPT_COMMAND 会在启动后覆盖这里的值。
func TerminalEnv(base []string) []string {
	env := make([]string, 0, len(base)+2)
	hasPrompt := false

	for _, kv := range base {
		switch {
		case strings.HasPrefix(kv, "TERM="):
			continue
		case strings.HasPrefix(kv, "PROMPT_COMMAND="):
			hasPrompt = true
		}
		env = append(env, kv)
	}

	env = append(env, "TERM=xterm-256color")
	if !hasPrompt {
		env = append(env, "PROMPT_COMMAND="+TitlePromptCommand)
	}
	return env
}
