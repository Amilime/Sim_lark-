package ws

import (
	"fmt"
)

// 广播消息的结构体：不仅包含内容，还包含“送到哪去”
// 这里的逻辑实现是并发yjs精华，也是逻辑最难受的地方，对于redis要怎么存怎么取（光标和握手不能存储）
// 实现了增量持久化
type BroadcastMsg struct {
	RoomID string // 也就是 DocID
	Data   []byte
	Sender *HubClient // 发送者
}

type Hub struct {
	Rooms map[string]map[*HubClient]bool

	Register   chan *HubClient
	Unregister chan *HubClient

	Broadcast chan *BroadcastMsg
	quit      chan bool // 关闭信号
}

func NewHub() *Hub {
	return &Hub{
		Rooms:      make(map[string]map[*HubClient]bool),
		Register:   make(chan *HubClient),
		Unregister: make(chan *HubClient),
		Broadcast:  make(chan *BroadcastMsg),
		quit:       make(chan bool),
	}
}

// 替换 hub.go 中的 Run 方法
// 替换 hub.go 中的 Run 方法
func (h *Hub) Run() {
	for {
		select {
		// ===========================
		// 1. 有人进房
		// ===========================
		case client := <-h.Register:
			if _, ok := h.Rooms[client.DocID]; !ok {
				h.Rooms[client.DocID] = make(map[*HubClient]bool)
			}
			h.Rooms[client.DocID][client] = true
			fmt.Printf("用户进入房间 [%s]，当前人数: %d\n", client.DocID, len(h.Rooms[client.DocID]))

			// ----------------------------------------------------
			// 重点修改区域：加载历史
			// ----------------------------------------------------

			// 1. 先看 Redis 有没有
			history := GetYjsHistory(client.DocID) // 返回 [][]byte

			// 2. 如果 Redis 没数据（说明冷启动），去 MySQL 捞
			if len(history) == 0 {
				fmt.Printf("Redis为空，尝试加载 MySQL...\n")
				// 这里的 LoadDocFromMySQL 是上面修改过、返回 [][]byte 的版本
				mysqlUpdates := LoadDocFromMySQL(client.DocID)

				if len(mysqlUpdates) > 0 {
					history = mysqlUpdates
					// 可选：顺便把 MySQL 数据回写到 Redis 预热，方便下一个人进房
					// RestoreToRedis(client.DocID, mysqlUpdates)
				}
			}

			// 3. 挨个发送 (现在 history 是完美的 [][]byte 数组，每一条都是独立的)
			// 前端收到每一条都会触发一次 applyUpdate，完美解决合并问题
			for _, update := range history {
				client.Send <- update
			}
			// ----------------------------------------------------

		// 2. 有人退房 (保持不变)
		case client := <-h.Unregister:
			if room, ok := h.Rooms[client.DocID]; ok {
				if _, ok := room[client]; ok {
					delete(room, client)
					close(client.Send)
					if len(room) == 0 {
						delete(h.Rooms, client.DocID)
						// 触发上面的 JSON 归档逻辑
						go AutoSaveToDocument(client.DocID)
					}
				}
			}

		// 3. 广播消息
		case msg := <-h.Broadcast:
			// ----------------------------------------------------------------
			// 1. 转发消息 (这一步必须无条件做，否则别人看不到你的字和光标)
			// ----------------------------------------------------------------
			if room, ok := h.Rooms[msg.RoomID]; ok {
				for client := range room {
					if client == msg.Sender {
						continue
					}
					select {
					case client.Send <- msg.Data:
					default:
						close(client.Send)
						delete(room, client)
					}
				}
			}

			// ----------------------------------------------------------------
			// 2. 存储消息 (🔥核心修复：严格过滤，只存文档更新！)
			// ----------------------------------------------------------------
			if len(msg.Data) >= 3 { // 有效的 Update 至少要有 3 个字节

				// Yjs 协议头解析：
				// Byte 0: 消息类型 (0 = Sync, 1 = Awareness)
				// Byte 1: Sync 步骤 (0 = Step1, 1 = Step2, 2 = Update)

				msgType := msg.Data[0]

				// 只有当消息是 Sync (0) 且 步骤是 Update (2) 时，才是真正的文字输入！
				if msgType == 0 {
					msgStep := msg.Data[1]

					if msgStep == 2 {
						// 🔍 调试日志：确认我们只存了真正的 Update
						fmt.Printf(">>> [Hub存储] 捕获文档更新: Room=%s, Len=%d (Type=%d, Step=%d)\n",
							msg.RoomID, len(msg.Data), msgType, msgStep)

						// 执行存储
						SaveYjsUpdate(msg.RoomID, msg.Data)

					} else {
						// 这是一个握手包 (Step 1 或 Step 2)，不要存！存了会死循环或损坏数据。
						// fmt.Printf("忽略握手包: Step=%d\n", msgStep)
					}
				} else if msgType == 1 {
					// 这是一个 Awareness 包 (光标移动)，千万不要存！
					// 你的 "长度21" 的包全都是这个，它们污染了你的数据库。
					// fmt.Println("忽略光标包")
				}
			}
		}
	}
}
