<template>
  <el-container class="layout-container">
    <el-header class="header">
      <div class="logo">协同文档系统</div>
      <div class="user-info">
        <span class="username">欢迎，{{ userInfo.nickname || userInfo.username }}</span>
        <el-button type="danger" link @click="handleLogout">退出</el-button>
      </div>
    </el-header>

    <el-container class="body-container">
      <el-aside width="260px" class="left-aside">
        <div class="aside-header">
          <span>我的文档</span>
          <div class="btn-group">
            <el-tooltip content="新建协同文档" placement="top">
              <el-button type="primary" size="small" circle @click="handleCreate">
                <el-icon><Plus /></el-icon>
              </el-button>
            </el-tooltip>
            
            <el-tooltip content="上传本地文件" placement="top">
              <el-button type="success" size="small" circle @click="triggerUpload">
                <el-icon><Upload /></el-icon>
              </el-button>
            </el-tooltip>

            <input 
              type="file" 
              ref="fileInput" 
              style="display: none" 
              @change="handleUpload"
            />
          </div>
        </div>
        
        <el-scrollbar>
          <div v-for="item in docList" :key="item.id" 
               class="doc-item" 
               :class="{ active: currentDocId === item.id }"
               @click="selectDoc(item)">
            <el-icon v-if="item.docType === 0" color="#67C23A"><Picture /></el-icon>
            <el-icon v-else color="#409EFF"><Document /></el-icon>
            <span class="doc-title" :title="item.title">{{ item.title }}</span>
            <el-icon class="del-btn" @click.stop="handleDelete(item.id)"><Delete /></el-icon>
          </div>
        </el-scrollbar>
      </el-aside>

      <el-main class="main-content">
         <div v-if="!currentDocId" class="empty-state">
           <el-empty description="请选择或新建一个文档" />
         </div>
         <div v-else class="editor-wrapper">
           <div class="editor-header">
             <span class="current-title">{{ currentDoc?.title }}</span>
             <div class="online-users">
               <el-tag type="success" size="small" effect="light">{{ onlineCount }}人在线</el-tag>
             </div>
           </div>

           <div class="editor-body">
             <div v-if="currentDoc?.docType === 0" class="image-preview">
                <img :src="formatFileUrl(currentDoc.fileKey)" alt="preview" />
             </div>
             
             <div v-else class="text-editor" style="height: 100%">
                 <TiptapEditor 
                    :docId="currentDoc.id" 
                    :key="currentDoc.id" 
                    @update-online="handleOnlineUpdate" 
                />
            </div>
           </div>
         </div>
      </el-main>
      
      <el-aside width="200px" class="right-aside">
        <div class="aside-header"> 版本历史</div>
      </el-aside>

    </el-container>
  </el-container>
</template>

<script setup>
    
import { ref, onMounted } from 'vue'
import { useUserStore } from '../stores/user'
import { useRouter } from 'vue-router'
// 修改：引入 uploadFile
import { getDocList, createDoc, deleteDoc, uploadFile } from '../api/doc'
import { ElMessage, ElMessageBox } from 'element-plus'
import TiptapEditor from '../components/TiptapEditor.vue'

const userStore = useUserStore()
const router = useRouter()
const userInfo = userStore.userInfo

const docList = ref([])
const currentDocId = ref(null)
const currentDoc = ref(null)
const onlineCount = ref(1)
const handleOnlineUpdate = (count) => {
    onlineCount.value = count
}
// 新增：文件输入框的引用
const fileInput = ref(null)

const loadList = async () => {
  try {
    const res = await getDocList()
    docList.value = res || []
  } catch(e) { console.error(e) }
}

onMounted(() => {
  loadList()
})

// === 新增：触发上传 ===
const triggerUpload = () => {
  // 模拟点击隐藏的 input
  fileInput.value.click()
}

// === 新增：处理文件选择 ===
// === 处理文件选择 ===
const handleUpload = async (event) => {
  const file = event.target.files[0]
  if (!file) return

  // 简单的文件大小限制 (例如 10MB)
  if (file.size > 10 * 1024 * 1024) {
    ElMessage.warning('文件大小不能超过 10MB')
    return
  }

  // 修复点：改用正确的 ElMessage 调用方式
  const loadingMsg = ElMessage({
    type: 'loading',
    message: '正在上传...',
    duration: 0
  })

  try {
    await uploadFile(file)
    ElMessage.success('上传成功')
    loadList() // 刷新列表
  } catch (e) {
    console.error(e)
    ElMessage.error('上传失败')
  } finally {
    loadingMsg.close() // 手动关闭加载提示
    // 清空 input，否则选同一个文件不会触发 change
    event.target.value = ''
  }
}

// === 新增：处理图片 URL ===
// 防止 img src 直接访问 localhost:8081 可能产生的一些混合内容问题(虽然后端做了CORS通常没事)
// 如果后端返回的是 http://localhost:8081/files/xxx.jpg
// 我们可以直接用，或者通过前端代理 /api/go/files/xxx.jpg
const formatFileUrl = (url) => {
  if (!url) return ''
  // 简单处理：如果后端返回的是 8081 的地址，我们在前端直接用即可
  // 因为我们在 start_backend.bat 里并没有配置 Nginx 统一入口，
  // 所以 img src="http://localhost:8081/..." 是最直接的方式。
  return url 
}

// ... 以前的 selectDoc, handleCreate, handleDelete, handleLogout 保持不变 ...
const selectDoc = (doc) => {
  currentDocId.value = doc.id
  currentDoc.value = doc
}

const handleCreate = () => {
  ElMessageBox.prompt('请输入文档标题', '新建文档', {
    confirmButtonText: '创建',
    cancelButtonText: '取消',
  }).then(async ({ value }) => {
    if(!value) return
    await createDoc(value)
    ElMessage.success('创建成功')
    loadList()
  })
}

const handleDelete = (id) => {
  ElMessageBox.confirm('确定要删除该文档吗？', '提示', { type: 'warning' })
  .then(async () => {
    await deleteDoc(id)
    ElMessage.success('删除成功')
    if (currentDocId.value === id) {
      currentDocId.value = null
      currentDoc.value = null
    }
    loadList()
  })
}

const handleLogout = () => {
  userStore.logout()
  router.push('/login')
}
</script>

<style scoped>
.layout-container { height: 100vh; display: flex; flex-direction: column; }
.body-container { flex: 1; overflow: hidden; /* 关键：防止主区域撑破屏幕 */ }

.header {
  height: 60px;
  background: #fff;
  border-bottom: 1px solid #dcdfe6;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
}
.logo { font-weight: bold; color: #409EFF; font-size: 18px; }

.left-aside {
  background: #fcfcfc;
  border-right: 1px solid #e4e7ed;
  display: flex; flex-direction: column;
}

.doc-item {
  padding: 12px 15px;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 14px;
  color: #606266;
  transition: 0.2s;
  position: relative; /* 为了定位删除按钮 */
}
.doc-item:hover { background: #f0f2f5; }
.doc-item.active { background: #ecf5ff; color: #409EFF; border-right: 3px solid #409EFF; }
.doc-title { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* 删除按钮默认隐藏，悬停显示 */
.del-btn { display: none; margin-left: auto; color: #F56C6C; }
.doc-item:hover .del-btn { display: block; }

.main-content {
  padding: 0;
  display: flex;
  flex-direction: column;
  background: #fff;
  min-width: 400px; /* 防止缩放太小 */
}

.editor-header {
  height: 50px;
  border-bottom: 1px solid #eee;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
}

.btn-group {
  display: flex;
  gap: 8px; /* 两个按钮之间的间距 */
}

/* 确保 aside-header 里的内容左右分布 */
.aside-header {
  padding: 15px;
  font-weight: bold;
  border-bottom: 1px solid #eee;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

/* 图片预览样式优化 */
.image-preview {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  background-color: #f5f7fa;
}
.image-preview img {
  max-width: 90%;
  max-height: 90%;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  border-radius: 4px;
}

.editor-body { flex: 1; overflow: auto; padding: 20px; }
.right-aside { border-left: 1px solid #eee; background: #fff; }
.aside-header { padding: 15px; font-weight: bold; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;}
</style>