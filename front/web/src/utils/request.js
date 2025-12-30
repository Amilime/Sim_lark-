import axios from 'axios'
import { ElMessage } from 'element-plus'
import { useUserStore } from '../stores/user'

// 创建 axios 实例
const service = axios.create({
  // 这里的 /api/java 会触发 vite.config.js 里的代理
  baseURL: '/api/java', 
  timeout: 5000
})

// 1. 请求拦截器
service.interceptors.request.use(
  (config) => {
    const userStore = useUserStore()
    if (userStore.token) {
      config.headers['Authorization'] = userStore.token
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 2. 响应拦截器
service.interceptors.response.use(
  (response) => {
    const res = response.data

    // 🚑 修复：同时兼容 Java 的 code=200 和 Go 的 status='success'
    // 只要满足其中一个，就认为是成功
    if (res.code === 200 || res.status === 'success') {
      return res.data || res // Java 通常在 data 里，Go 有时候直接返回对象，这里做一个兼容
    } 
    
    // 如果都不满足，才报错
    else {
      ElMessage.error(res.msg || '系统错误')
      
      if (res.code === 401) {
        const userStore = useUserStore()
        userStore.logout()
        location.reload()
      }
      return Promise.reject(new Error(res.msg || 'Error'))
    }
  },
  (error) => {
    // ... 错误处理不变 ...
    ElMessage.error(error.message || '网络请求失败')
    return Promise.reject(error)
  }
)
// 👇👇👇 绝对不能漏掉这一行 👇👇👇
export default service