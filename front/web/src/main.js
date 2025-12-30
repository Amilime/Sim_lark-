import { createApp } from 'vue'
import './style.css' // 这里保留默认样式，或者你可以清空 style.css 的内容
import App from './App.vue'

// 1. 引入 Element Plus 和图标
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'

// 2. 引入 Pinia 和 Router 
import { createPinia } from 'pinia'
import router from './router' 

const app = createApp(App)

// 3. 注册所有图标
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.use(createPinia())
app.use(router)
app.use(ElementPlus)
app.mount('#app')