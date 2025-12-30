package ws

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"time"
)

var DB *gorm.DB

// 1. 文档表
type Document struct {
	Id         int64     `gorm:"primaryKey;autoIncrement"`
	Title      string    `gorm:"type:varchar(255)"`
	DocType    int       `gorm:"column:doc_type"`
	FileKey    string    `gorm:"column:file_key;type:varchar(255)"`
	Content    []byte    `gorm:"column:content;type:longblob"`
	OwnerId    int64     `gorm:"column:owner_id"`
	Version    int       `gorm:"column:version;default:1"`
	UpdateTime time.Time `gorm:"column:update_time;autoUpdateTime"`
	CreateTime time.Time `gorm:"column:create_time;autoCreateTime"`
}

func (Document) TableName() string { return "document" }

// 2. 版本表
type DocVersion struct {
	Id              int64     `gorm:"primaryKey"`
	DocId           int64     `gorm:"column:doc_id"`
	VersionNum      int       `gorm:"column:version_num"`
	ContentSnapshot []byte    `gorm:"column:content_snapshow;type:longblob"`
	EditorId        int64     `gorm:"column:editor_id"`
	CreateTime      time.Time `gorm:"column:create_time;autoCreateTime"`
}

func (DocVersion) TableName() string { return "doc_version" }

// 初始化
func InitMySQL() {
	dsn := "root:root@tcp(localhost:3306)/lark_db?charset=utf8mb4&parseTime=True&loc=Local"

	var err error
	DB, err = gorm.Open(mysql.Open(dsn), &gorm.Config{})
	if err != nil {
		// 打印大写加粗的错误，方便你在控制台一眼看到
		fmt.Println("=========================================")
		fmt.Printf("MySQL 连接失败 错误: %v\n", err)
		fmt.Println("=========================================")
		DB = nil // 明确置空
	} else {
		fmt.Println("MySQL 连接成功")
	}
}

// 安全检查函数
func checkDB() error {
	if DB == nil {
		return fmt.Errorf("数据库未连接，无法存储数据")
	}
	return nil
}

// ---------------------------------------------------------
// 业务方法 (增加了 checkDB 防崩溃)
// ---------------------------------------------------------

func CreateStaticDocument(title string, fileUrl string, ownerId int64) (int64, error) {
	if err := checkDB(); err != nil {
		return 0, err
	} // 安全检查

	doc := Document{
		Title:   title,
		DocType: 0,
		FileKey: fileUrl,
		OwnerId: ownerId,
		Version: 1,
	}
	result := DB.Create(&doc)
	return doc.Id, result.Error
}

func AutoSaveToDocument(docId string) {
	// 1. 从 Redis 取出该文档所有的 Update 历史
	// 假设 GetAllUpdatesFromRedis 返回 [][]byte
	updates := GetYjsHistory(docId)

	if len(updates) == 0 {
		return
	}

	// 2. 将二进制 update 转为 Base64 字符串数组
	// 这样存 JSON 才是安全的，直接存二进制到 JSON 会乱码
	var base64List []string
	for _, u := range updates {
		// 这里的 u 应该是包含 [0, 2, ...] 完整信封的数据，直接转存即可
		encoded := base64.StdEncoding.EncodeToString(u)
		base64List = append(base64List, encoded)
	}

	// 3. 序列化为 JSON 字符串
	jsonBytes, err := json.Marshal(base64List)
	if err != nil {
		fmt.Println("序列化失败:", err)
		return
	}
	jsonString := string(jsonBytes)

	// 4. 存入 MySQL (假设你的表字段是 content LONGTEXT)
	// SQL: UPDATE documents SET content = ? WHERE id = ?
	// db.Exec("UPDATE documents SET content = ? WHERE id = ?", jsonString, docId)
	SaveToMySQL(docId, jsonString)

	fmt.Printf("文档 [%s] 已归档到 MySQL，共 %d 条记录\n", docId, len(base64List))
}

func CreateVersionSnapshot(docIdStr string, userId int64, versionNum int) error {
	if err := checkDB(); err != nil {
		return err
	} // 安全检查

	data := mergeYjsHistory(docIdStr)
	if len(data) == 0 {
		return fmt.Errorf("文档内容为空，无法保存版本")
	}

	version := DocVersion{
		DocId:           stringToInt64(docIdStr),
		VersionNum:      versionNum,
		ContentSnapshot: data,
		EditorId:        userId,
	}

	return DB.Create(&version).Error
}

// 辅助函数
func mergeYjsHistory(docIdStr string) []byte {
	fragments := GetYjsHistory(docIdStr)
	if len(fragments) == 0 {
		return nil
	}
	var merged []byte
	for _, frag := range fragments {
		merged = append(merged, frag...)
	}
	return merged
}

func stringToInt64(s string) int64 {
	var id int64
	fmt.Sscanf(s, "%d", &id)
	return id
}

// ... AutoSaveToDocument ...

// 👇👇👇 新增这个函数 👇👇👇
// 从 MySQL 加载文档内容 (用于初始化 Redis)
func LoadDocFromMySQL(docId string) [][]byte {
	// 1. 从数据库 select content from documents where id = ?
	jsonString := GetContentFromDB(docId)
	if jsonString == "" {
		return nil
	}

	// 2. 解析 JSON
	var base64List []string
	err := json.Unmarshal([]byte(jsonString), &base64List)
	if err != nil {
		// 容错：有可能老数据不是 JSON，而是以前的乱码 blob
		fmt.Println("解析历史数据 JSON 失败，可能是旧格式:", err)
		return nil
	}

	// 3. 将 Base64 还原回二进制
	var updates [][]byte
	for _, b64 := range base64List {
		data, err := base64.StdEncoding.DecodeString(b64)
		if err == nil {
			updates = append(updates, data)
		}
	}

	return updates
}

func GetContentFromDB(docIdStr string) string {
	if checkDB() != nil {
		return ""
	}

	var doc Document
	// 将 string ID 转为 int64
	id := stringToInt64(docIdStr)

	// 查询 content 字段
	result := DB.Model(&Document{}).Select("content").Where("id = ?", id).First(&doc)

	if result.Error != nil {
		// 如果没找到或报错，返回空
		return ""
	}

	// 数据库存的是 blob ([]byte)，转成 string 返回
	return string(doc.Content)
}

// SaveToMySQL: 简单的 UPDATE 操作
func SaveToMySQL(docIdStr string, contentJson string) {
	if checkDB() != nil {
		return
	}

	id := stringToInt64(docIdStr)

	// 更新 content 字段
	// 注意：需要把 string 转回 []byte 因为 Struct 定义是 []byte
	err := DB.Model(&Document{}).Where("id = ?", id).Update("content", []byte(contentJson)).Error

	if err != nil {
		fmt.Println("MySQL 保存失败:", err)
	}
}
