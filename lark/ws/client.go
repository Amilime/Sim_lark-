package ws

import (
	"fmt"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"net/http"
	"strings"
)

// 升级器配置
var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

// Client 代表一个单独的用户连接
type HubClient struct {
	Hub    *Hub            // 归哪个大管家管
	Conn   *websocket.Conn // 真正的 WebSocket 连接
	Send   chan []byte     // 自己的发信箱（Hub 会往这里塞数据）
	UserId int64           // 用于验证身份的用户ID
	DocID  string          //用户编辑文档
}

// 1. 读泵 (从浏览器读 -> 发给 Hub)
func (c *HubClient) ReadPump() {
	defer func() {
		c.Hub.Unregister <- c // 断开时通知 Hub 注销
		c.Conn.Close()
	}()

	for {
		_, message, err := c.Conn.ReadMessage()
		if err != nil {
			break
		}
		// 把消息包装成 BroadcastMsg
		// 这样 Hub 就知道要把这条消息发给哪个房间了
		msg := &BroadcastMsg{
			RoomID: c.DocID,
			Data:   message, // 是Yjs二进制数据
			Sender: c,
		}
		c.Hub.Broadcast <- msg
	}
}

// 2. 写泵 (从 Send 通道读 -> 发给浏览器)
func (c *HubClient) WritePump() {
	defer func() {
		c.Conn.Close()
	}()

	for {
		// 等待 Hub 给自己发邮件
		message, ok := <-c.Send
		if !ok {
			// 通道被关闭了
			c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
			return
		}

		// 🟢 修正后：每次只发一条，绝对不拼接！
		w, err := c.Conn.NextWriter(websocket.BinaryMessage)
		if err != nil {
			return
		}

		w.Write(message)

		//  删掉下面这段代码
		// n := len(c.Send)
		// for i := 0; i < n; i++ {
		//    w.Write(<-c.Send)
		// }
		// 删掉上面这段代码

		if err := w.Close(); err != nil {
			return
		}
	}
}

// ServeWs 处理 WebSocket 请求
func ServeWs(hub *Hub, c *gin.Context) {

	token := c.Query("token")
	docId := c.Param("room")
	fmt.Println("------------------------------------------------")
	fmt.Printf(">>> [Go调试] 收到连接请求: Room=%s\n", docId)
	fmt.Printf(">>> [Go调试] 原始 Token: %s\n", token)
	if docId == "" {
		c.JSON(400, gin.H{"error": "房间号为空"})
		return
	}

	if token == "" {
		fmt.Println(">>> 失败: Token 为空")
		c.JSON(401, gin.H{"error": "未提供 Token"})
		return
	}
	if strings.HasPrefix(token, "Bearer ") {
		token = strings.TrimPrefix(token, "Bearer ")
		fmt.Println(">>> 自动去除 Bearer 前缀")
	}

	claims, err := ParseToken(token)
	if err != nil {

		fmt.Println(" Token 验证失败，原因:", err)
		c.JSON(401, gin.H{"error": "无效的 Token: " + err.Error()})
		return
	}

	// 1. 从 URL 参数获取 Token
	// 格式: ws://localhost:8081/ws?token=xxxxx

	// 3. 升级 HTTP 为 WebSocket
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}

	// 4. 创建客户端 (带上 UserId)
	client := &HubClient{
		Hub:    hub,
		Conn:   conn,
		Send:   make(chan []byte, 256),
		UserId: claims.Uid, // 记录下这个人是谁
		DocID:  docId,
	}

	// 注册到 Hub
	client.Hub.Register <- client

	// 启动协程
	go client.WritePump()
	go client.ReadPump()
}
