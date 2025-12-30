import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUserStore = defineStore('user', () => {
  // 1. 状态：从 localStorage 读取，防止刷新丢失
  const token = ref(localStorage.getItem('lark-token') || '')
  const userInfo = ref(JSON.parse(localStorage.getItem('lark-user') || '{}'))

  // 2. 动作：登录成功后保存
  function setLoginState(newToken, newUser) {
    token.value = newToken
    userInfo.value = newUser
    // 持久化到浏览器缓存
    localStorage.setItem('lark-token', newToken)
    localStorage.setItem('lark-user', JSON.stringify(newUser))
  }

  // 3. 动作：退出登录
  function logout() {
    token.value = ''
    userInfo.value = {}
    localStorage.removeItem('lark-token')
    localStorage.removeItem('lark-user')
  }

  return { token, userInfo, setLoginState, logout }
})