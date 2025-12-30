<template>
  <div class="editor-container">
    <div v-if="editor" class="toolbar">
      <button @click="editor.chain().focus().toggleBold().run()" :class="{ 'is-active': editor.isActive('bold') }">
        <b>B</b>
      </button>
      <button @click="editor.chain().focus().toggleItalic().run()" :class="{ 'is-active': editor.isActive('italic') }">
        <i>I</i>
      </button>
      <button @click="editor.chain().focus().toggleStrike().run()" :class="{ 'is-active': editor.isActive('strike') }">
        <s>S</s>
      </button>
      
      <button @click="triggerImageUpload" title="插入图片">
        图
      </button>
      
      <input 
        type="file" 
        ref="fileInput" 
        accept="image/*" 
        style="display: none" 
        @change="handleImageSelect"
      />

      <div class="connection-status" :class="{ connected: isConnected }">
        {{ isConnected ? '🟢 已连接' : '🔴 断开' }}
      </div>
    </div>

    <EditorContent :editor="editor" class="editor-content" />
  </div>
</template>

<script setup>
import { ref, onBeforeUnmount } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCursor from '@tiptap/extension-collaboration-cursor'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { useUserStore } from '../stores/user'
import Image from '@tiptap/extension-image'
import { ElMessage } from 'element-plus'
import { uploadFile } from '../api/doc'
const emit = defineEmits(['update-online'])
const fileInput = ref(null)
const props = defineProps({
  docId: { type: Number, required: true }
})

const userStore = useUserStore()
console.log('📌 调试用户信息:', userStore.userInfo)
const isConnected = ref(false)

// ==========================================
// 1. 第一步：先创建 Yjs 文档和 Provider (关键！)
// ==========================================
const ydoc = new Y.Doc()

// 🚑 修复：通过“房间号拼接”的方式强制带上 Token
// 最终生成的 URL 会变成：ws://localhost:xxx/ws/7?token=eyJ...
// 这样 Go 后端就能正确解析出 roomId=7 和 token=...
// 1. 找到这行附近的 new WebsocketProvider 代码
const provider = new WebsocketProvider(
  `ws://${location.host}/ws`,
  
  // 🔴 修改前： `${props.docId}?token=${userStore.token}`, 
  // 🟢 修改后：只传纯数字 ID，确保文件名合法
  String(props.docId), 
  
  ydoc,
  
  // 🟢 新增：通过官方参数传递 Token
  {
    params: {
      token: userStore.token
    }
  }
)


// 监听连接状态
provider.on('status', event => {
  isConnected.value = event.status === 'connected'
  if (isConnected.value) {
    console.log('✅ WebSocket 连接成功！')
  } else {
    console.log('❌ WebSocket 连接断开')
  }
})

// 监听连接状态
provider.on('status', event => {
  isConnected.value = event.status === 'connected'
})

provider.awareness.on('change', () => {
  // getStates() 返回当前所有在线客户端的状态 Map
  const count = provider.awareness.getStates().size
  console.log('👥 当前在线人数变化:', count)
  
  // 发送给父组件 Home.vue
  emit('update-online', count)
})

// ==========================================
// 2. 第二步：再创建编辑器 (此时 provider 绝对不是 null)
// ==========================================
const editor = useEditor({
  content: '', 
  extensions: [
    // ❗重要：必须禁用 StarterKit 自带的历史记录，交给 Yjs 接管，否则无法协同撤销/重做
    StarterKit.configure({
      history: false 
    }),
    Collaboration.configure({
      document: ydoc,
    }),
    CollaborationCursor.configure({
      provider: provider, // 这里传入的一定是已经创建好的对象
      user: {
        name: userStore.userInfo.nickname || '神秘人',
        // 生成一个随机颜色，让你能区分自己和别人
        color: '#' + Math.floor(Math.random()*16777215).toString(16)
      },
    }),
    // 👇 4. 注册图片插件
    Image.configure({
      inline: true,
      allowBase64: true,
      })
  ],
})

// ==========================================
// 3. 销毁资源
// ==========================================
onBeforeUnmount(() => {
  // 必须销毁 provider，否则 WebSocket 会一直连着，越连越多
  provider.destroy()
  ydoc.destroy()
})

// ==========================================
// 👇 5. 图片上传逻辑
// ==========================================

// 触发文件选择框
const triggerImageUpload = () => {
  fileInput.value.click()
}

// 处理文件选中
const handleImageSelect = async (event) => {
  const file = event.target.files[0]
  if (!file) return

  // 限制大小 (比如 5MB)
  if (file.size > 5 * 1024 * 1024) {
    ElMessage.warning('图片大小不能超过 5MB')
    return
  }

  const loadingMsg = ElMessage({
    type: 'loading',
    message: '正在上传图片...',
    duration: 0
  })

  try {
    // 1. 获取接口返回的完整对象
    const res = await uploadFile(file)
    
    // 🔍 关键一步：打印出来看看长什么样！
    console.log('📸 上传接口返回数据:', res)

    // 2. 尝试提取真正的 URL (根据你的后端习惯，通常是 .data 或 .url)
    // 假设后端返回结构是 { data: "/files/xxx.jpg" }，那就取 res.data
    // 如果后端直接返回字符串，那 res 本身就是
    const imgUrl = res?.data || res?.url || res 

    // 3. 确保提取出来的是字符串
    if (typeof imgUrl === 'string') {
       let fullUrl = imgUrl
       
       if (imgUrl.startsWith('/')) { 
           fullUrl = `http://localhost:8081${imgUrl}` 
       }

       editor.value.chain().focus().setImage({ src: fullUrl }).run()
       ElMessage.success('图片插入成功')
    } else {
       console.error('无法提取图片 URL，返回格式不对:', res)
       ElMessage.error('图片上传返回格式异常')
    }

  } catch (e) {
    console.error(e)
    ElMessage.error('图片上传失败')
  } finally {
    loadingMsg.close()
    event.target.value = '' // 清空 input 防止重复选同一张没反应
  }
}

</script>

<style scoped>
.editor-container {
  display: flex; flex-direction: column; height: 100%;
  border: 1px solid #ccc; border-radius: 8px; overflow: hidden;
}
.toolbar {
  padding: 10px; background: #f5f5f5; border-bottom: 1px solid #ddd;
  display: flex; gap: 8px; align-items: center;
}
.toolbar button {
  padding: 5px 10px; border: 1px solid #ccc; background: white; cursor: pointer; border-radius: 4px; font-family: serif;
}
.toolbar button.is-active { background: #333; color: white; }
.connection-status { margin-left: auto; font-size: 12px; color: #666; }
.connection-status.connected { color: green; font-weight: bold; }

.editor-content { flex: 1; padding: 20px; overflow-y: auto; outline: none; }

/* Tiptap 内部样式穿透 */
:deep(.ProseMirror) { outline: none; min-height: 100%; }
:deep(p) { margin: 1em 0; line-height: 1.6; }

/* 协同光标样式 */
:deep(.collaboration-cursor__caret) {
  border-left: 1px solid #0d0d0d;
  border-right: 1px solid #0d0d0d;
  margin-left: -1px; margin-right: -1px;
  pointer-events: none; position: relative; word-break: normal;
}
:deep(.collaboration-cursor__label) {
  border-radius: 3px 3px 3px 0; color: #fff; font-size: 12px;
  font-weight: 600; left: -1px; padding: 0.1rem 0.3rem;
  position: absolute; top: -1.4em; user-select: none; white-space: nowrap;
  background-color: inherit; /* 继承光标颜色 */
}
:deep(img) {
  /* 1. 限制最大宽度为 500px (或者 60% 等)，防止图片撑满全屏 */
  max-width: 500px; 
  /* max-width: 80%; */ /* 也可以用百分比 */

  /* 2. 限制最大高度 (可选)，防止长图霸屏 */
  max-height: 400px;
  
  /* 3. 保持比例，多余部分怎么处理？通常 contain 最安全 */
  width: auto;
  height: auto;
  object-fit: contain;

  /* 4. 给点圆角和阴影，看起来更像文档 */
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  margin: 16px 0; /* 上下留白 */
  
  /* 5. 居中显示 (可选) 
  display: block;
  margin-left: auto;
  margin-right: auto;*/
  
  /* 6. 鼠标放上去变小手，暗示它是张图 */
  cursor: pointer;
  transition: transform 0.2s;
}
</style>