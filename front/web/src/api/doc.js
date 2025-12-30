import request from '../utils/request'

// 1. 获取文档列表
export const getDocList = () => {
  return request.get('/doc/list')
}

// 2. 创建文档 (注意这里是 createDoc)
export const createDoc = (title) => {
  return request.post('/doc/create', {
    title: title,
    docType: 1
  })
}

// 3. 删除文档
export const deleteDoc = (id) => {
  return request.delete(`/doc/delete/${id}`)
}

// 4. 上传静态文件 (发给 Go 后端)
export const uploadFile = (fileObj) => {
  const formData = new FormData()
  formData.append('file', fileObj)

  // 注意：这里需要覆盖 baseURL，因为默认是 /api/java
  return request.post('/api/go/upload', formData, {
    baseURL: '/', // 覆盖默认的 /api/java，让它直接从根路径开始
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })
}