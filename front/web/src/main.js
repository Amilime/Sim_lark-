import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { QuillBinding } from 'y-quill'
import Quill from 'quill'

const JAVA_API = 'http://localhost:8080'
const GO_API = 'http://localhost:8081'
const WS_URL = 'ws://localhost:8081/ws'

// ==========================================
// 1. 全局变量 (修复 binding 报错)
// ==========================================
let ydoc = null
let provider = null
let quill = null
let binding = null // 【修复】之前漏了这行
let currentUser = null
let currentDocId = null

// ==========================================
// 2. 工具函数
// ==========================================
function parseJwt (token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        
        const claims = JSON.parse(jsonPayload);
        console.log("🔍 [调试] 解析 Token 成功:", claims); // 【新增】看这里！
        return claims;
    } catch (e) {
        console.error("Token 解析失败", e);
        return null;
    }
}

function log(msg) {
    const logDiv = document.getElementById('log')
    if(logDiv) {
        const time = new Date().toLocaleTimeString()
        logDiv.innerHTML = `<div><span style="color:#888">[${time}]</span> ${msg}</div>` + logDiv.innerHTML
    } else {
        console.log(msg)
    }
}

// ==========================================
// 3. 页面初始化
// ==========================================
window.onload = () => {
    const storedUser = localStorage.getItem('lark_user')
    if (storedUser) {
        try {
            currentUser = JSON.parse(storedUser)
            showLoginState(true)
            setTimeout(() => window.loadDocList(), 100)
        } catch (e) {
            localStorage.removeItem('lark_user')
        }
    }
}

function showLoginState(isLoggedIn) {
    const loginSection = document.getElementById('loginSection')
    const userBar = document.getElementById('userBar')
    const mainApp = document.getElementById('mainApp')
    
    if (isLoggedIn && currentUser) {
        if(loginSection) loginSection.style.display = 'none'
        if(userBar) {
            userBar.style.display = 'flex'
            // 如果昵称也是 undefined，我们暂时显示用户名
            const name = currentUser.nickname || currentUser.username || "用户"
            const uid = currentUser.id || "?"
            document.getElementById('displayNickname').innerText = name
            document.getElementById('displayUserId').innerText = uid
        }
        if(mainApp) mainApp.style.display = 'block'
    } else {
        if(loginSection) loginSection.style.display = 'block'
        if(userBar) userBar.style.display = 'none'
        if(mainApp) mainApp.style.display = 'none'
    }
}

function getHeaders() {
    if (!currentUser || !currentUser.token) {
        alert("登录失效")
        window.logout()
        throw new Error("Unauthorized")
    }
    return { 'Authorization': currentUser.token }
}

// ==========================================
// 4. 业务逻辑
// ==========================================

// 登录
// ==========================================
// 1. 用户认证 (万能兼容版)
// ==========================================
window.login = async () => {
    const username = document.getElementById('username').value
    const password = document.getElementById('password').value

    try {
        log(`>>> 正在登录: ${username}...`)
        const res = await fetch(`${JAVA_API}/user/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        })
        const result = await res.json()
        
        // 🔍【关键调试】看看后端到底回了什么
        console.log("后端返回数据:", result);

        if (result.code === 200 && result.data) {
            let tokenString = "";
            let userId = null;
            let nickname = "";

            // 🟢 情况 A: 后端返回的是 Result<String> (纯 Token)
            if (typeof result.data === 'string') {
                tokenString = result.data;
            } 
            // 🔵 情况 B: 后端返回的是 Result<Map> (对象)
            else if (typeof result.data === 'object' && result.data.token) {
                tokenString = result.data.token;
                userId = result.data.userId;     // 顺便拿 ID
                nickname = result.data.nickname; // 顺便拿昵称
            }

            if (!tokenString) {
                alert("登录成功，但在响应中未找到 Token！请看控制台日志。");
                return;
            }

            // 解析 Token 获取信息
            const claims = parseJwt(tokenString);
            if (!claims) {
                alert("Token 解析失败，格式不正确");
                return;
            }

            // 优先用后端直接返回的 ID，如果没有，再从 Token 里解
            currentUser = {
                id: userId || claims.uid || claims.id || claims.userId,
                nickname: nickname || claims.sub || claims.username || username,
                token: tokenString
            }

            // 保存并跳转
            localStorage.setItem('lark_user', JSON.stringify(currentUser))
            showLoginState(true)
            log("✅ 登录成功！")
            window.loadDocList()
            
        } else {
            alert(result.msg || "登录失败")
        }
    } catch (e) {
        log(`❌ 登录错误: ${e.message}`)
        console.error(e);
    }
}

window.logout = () => {
    currentUser = null
    localStorage.removeItem('lark_user')
    showLoginState(false)
    if (provider) provider.destroy()
    if (binding) binding.destroy()
}

// 上传静态文件
window.uploadStaticFile = async () => {
    const fileInput = document.getElementById('fileInput')
    const file = fileInput.files[0]
    if (!file) return alert("请选择文件")

    const formData = new FormData()
    formData.append('file', file)

    try {
        log(`>>> 正在上传...`)
        const res = await fetch(`${GO_API}/upload`, {
            method: 'POST',
            headers: { 'Authorization': currentUser.token }, 
            body: formData
        })
        const data = await res.json()
        
        if (data.status === 'success') {
            log(`✅ 上传成功! ID: ${data.docId}`)
            document.getElementById('uploadResult').innerHTML = 
                `<a href="${data.url}" target="_blank">${data.url}</a>`
            window.loadDocList()
        } else {
            log(`❌ 上传失败: ${data.error}`)
        }
    } catch (e) {
        log(`❌ 网络错误: ${e.message}`)
    }
}

// 加载列表
window.deleteDoc = async (id) => {
    if(!confirm("确定要删除这个文档吗？")) return;

    try {
        const res = await fetch(`${JAVA_API}/doc/delete/${id}`, {
            method: 'DELETE',
            headers: getHeaders()
        })
        const result = await res.json()
        if(result.code === 200 || result.msg === "OK!") { // 适配你的 Result
            log(`🗑️ 删除成功 ID:${id}`)
            window.loadDocList() // 刷新列表
            // 如果删的是当前正在编辑的，清理编辑器
            if(currentDocId == id) {
                if(provider) provider.destroy();
                if(ydoc) ydoc.destroy();
                document.querySelector('.ql-editor').innerHTML = '';
                document.getElementById('currentRoomId').innerText = '-';
            }
        } else {
            alert("删除失败: " + result.msg)
        }
    } catch(e) {
        log(`❌ 删除请求错误: ${e.message}`)
    }
}

// 修改 loadDocList 渲染逻辑
window.loadDocList = async () => {
    try {
        const res = await fetch(`${JAVA_API}/doc/list`, {
            method: 'GET',
            headers: getHeaders()
        })
        const result = await res.json()
        const list = result.data || []
        
        const listDiv = document.getElementById('docList')
        if(!listDiv) return

        if (list.length === 0) {
            listDiv.innerHTML = '<div style="padding:10px; color:#888;">暂无文档</div>'
            return
        }

        // 按时间倒序排列 (新的在上面)
        list.sort((a, b) => new Date(b.createTime) - new Date(a.createTime));

        listDiv.innerHTML = list.map(doc => {
            const isStatic = doc.docType === 0
            const clickAction = isStatic 
                ? `window.open('${doc.fileKey}')` 
                : `initYjs(${doc.id})`
            
            const badge = isStatic 
                ? `<span style="background:#eee;padding:2px 6px;border-radius:4px;font-size:0.8em;margin-right:5px">静态</span>`
                : `<span style="background:#e3f2fd;color:#1976d2;padding:2px 6px;border-radius:4px;font-size:0.8em;margin-right:5px">协同</span>`

            return `
            <div class="file-item">
                <div style="display:flex; align-items:center; flex:1; overflow:hidden;">
                    ${badge}
                    <span style="font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${doc.title}">${doc.title}</span>
                    <span style="color:#999;font-size:0.8em;margin-left:8px;flex-shrink:0;">#${doc.id}</span>
                </div>
                <div style="display:flex; gap:5px; margin-left:10px;">
                    <button onclick="${clickAction}" style="padding:4px 10px;font-size:0.8em;cursor:pointer;background:#2196F3;color:white;border:none;border-radius:4px;">
                        ${isStatic ? '查看' : '进入'}
                    </button>
                    <button onclick="deleteDoc(${doc.id})" style="padding:4px 10px;font-size:0.8em;cursor:pointer;background:#ff5252;color:white;border:none;border-radius:4px;">
                        删除
                    </button>
                </div>
            </div>
            `
        }).join('')
    } catch (e) {
        log(`❌ 获取列表失败`)
    }
}

// 创建文档
window.createAndEnterDoc = async () => {
    const title = document.getElementById('docTitle').value || "未命名"
    try {
        const res = await fetch(`${JAVA_API}/doc/create`, {
            method: 'POST',
            headers: { 
                'Authorization': currentUser.token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ title: title, docType: 1 })
        })
        const result = await res.json()
        if (result.code === 200) {
            const docId = result.data.docId
            log(`✅ 创建成功 #${docId}`)
            window.loadDocList()
            initYjs(docId)
        }
    } catch (e) {
        log(`❌ 创建失败: ${e.message}`)
    }
}

window.enterRoom = () => {
    const id = document.getElementById('manualDocId').value
    if (id) initYjs(id)
}

// 初始化 Yjs (核心)
window.initYjs = (docId) => {
    currentDocId = docId
    document.getElementById('currentRoomId').innerText = docId
    
    // 清理旧连接
    if (provider) provider.destroy()
    if (ydoc) ydoc.destroy()
    // 【修复】清理旧的 binding，否则会报错
    if (binding) binding.destroy() 
    
    if (!quill) {
        quill = new Quill('#editor', {
            theme: 'snow',
            modules: { toolbar: [['bold', 'italic'], ['code-block']] }
        })
    }
    
    log(`>>> 连接房间: ${docId}`)
    ydoc = new Y.Doc()
    provider = new WebsocketProvider(WS_URL, docId.toString(), ydoc, {
        params: { token: currentUser.token }
    })
    
    const type = ydoc.getText('quill')
    // 【修复】binding 已经定义在全局了
    binding = new QuillBinding(type, quill)

    provider.on('status', event => {
        const statusSpan = document.getElementById('status')
        if (event.status === 'connected') {
            statusSpan.innerText = `🟢 已连接`
            statusSpan.style.color = 'green'
        } else {
            statusSpan.innerText = `🔴 断开`
            statusSpan.style.color = 'red'
        }
    })
}

// 保存版本
window.manualSaveVersion = async () => {
    if (!currentDocId) return alert("请先进入房间")
    try {
        const res = await fetch(`${GO_API}/api/version/save`, {
            method: 'POST',
            body: JSON.stringify({
                docId: currentDocId.toString(),
                userId: currentUser.id,
                versionNum: Math.floor(Date.now()/1000)
            })
        })
        const data = await res.json()
        log(`✅ ${data.msg || '版本保存成功'}`)
    } catch (e) {
        log(`❌ 保存失败`)
    }
}