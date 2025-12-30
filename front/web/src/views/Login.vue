<template>
  <div class="login-container">
    <el-card class="box-card">
      <template #header>
        <div class="card-header">
          <span>🚀 Lark 在线协同</span>
        </div>
      </template>
      
      <el-form :model="form" label-width="0px">
        <el-form-item>
          <el-input v-model="form.username" placeholder="请输入用户名" prefix-icon="User" />
        </el-form-item>
        
        <el-form-item>
          <el-input v-model="form.password" type="password" placeholder="请输入密码" prefix-icon="Lock" show-password />
        </el-form-item>

        <el-form-item v-if="isRegister">
          <el-input v-model="form.nickname" placeholder="您的昵称 (可选)" prefix-icon="Star" />
        </el-form-item>

        <el-form-item>
          <el-button type="primary" style="width: 100%;" @click="handleSubmit" :loading="loading">
            {{ isRegister ? '立即注册' : '登 录' }}
          </el-button>
        </el-form-item>
        
        <div class="footer-links">
          <el-link type="primary" @click="toggleMode">
            {{ isRegister ? '已有账号？去登录' : '没有账号？去注册' }}
          </el-link>
        </div>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/user'
import request from '../utils/request'
import { ElMessage } from 'element-plus'
import { jwtDecode } from "jwt-decode"; // 需安装: npm install jwt-decode

const router = useRouter()
const userStore = useUserStore()

const isRegister = ref(false)
const loading = ref(false)

const form = reactive({
  username: '',
  password: '',
  nickname: ''
})

// 切换登录/注册模式
const toggleMode = () => {
  isRegister.value = !isRegister.value
  form.username = ''
  form.password = ''
  form.nickname = ''
}

// 提交表单
// 提交表单
const handleSubmit = async () => {
  if(!form.username || !form.password) {
    ElMessage.warning('请输入用户名和密码')
    return
  }

  loading.value = true
  try {
    if (isRegister.value) {
      // === 注册逻辑 (不变) ===
      await request.post('/user/register', {
        username: form.username,
        password: form.password,
        nickname: form.nickname || '新用户'
      })
      ElMessage.success('注册成功，请登录')
      isRegister.value = false 
    } else {
      // === 登录逻辑 (重点修改这里) ===
      const res = await request.post('/user/login', {
        username: form.username,
        password: form.password
      })
      
      console.log('登录成功，后端返回:', res)

      // 1. 直接提取 Token
      const tokenStr = res.token
      
      if (!tokenStr) {
        ElMessage.error('登录失败：后端未返回 Token')
        return
      }

      // 2. 直接组装用户信息 (不需要手动解析 Token 了，后端都给了！)
      const userInfo = {
        id: res.userId,        // 后端传回的 userId
        nickname: res.nickname,// 后端传回的 nickname
        username: form.username// 表单里的 username
      }

      // 3. 存入 Pinia 和 LocalStorage
      userStore.setLoginState(tokenStr, userInfo)
      
      ElMessage.success('登录成功')
      router.push('/') // 跳转主页
    }
  } catch (e) {
    console.error('登录出错:', e)
    // 错误在 request.js 里弹窗了，这里不用处理
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  background-color: #f0f2f5;
  background-image: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
}
.box-card {
  width: 400px;
  border-radius: 10px;
}
.card-header {
  text-align: center;
  font-size: 20px;
  font-weight: bold;
  color: #333;
}
.footer-links {
  text-align: center;
  margin-top: 10px;
}
</style>