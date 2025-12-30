# 仿lark协同系统后端

是高性能的在线实时协同办公系统后端。本项目采用 **Java + Go 双后端架构**，充分利用 Java 生态在业务逻辑处理上的优势，以及 Go 语言在 WebSocket 高并发、实时 IO 处理上的性能优势，实现了类似 Google Docs / 腾讯文档的实时协同编辑功能。

##  目录

- [系统架构](https://www.google.com/search?q=%23-系统架构)
- [技术栈](https://www.google.com/search?q=%23-技术栈)
- [核心功能](https://www.google.com/search?q=%23-核心功能)
- [项目结构](https://www.google.com/search?q=%23-项目结构)
- [快速开始](https://www.google.com/search?q=%23-快速开始)
- [注意事项](https://www.google.com/search?q=%23-注意事项)

------

## 系统架构

系统被拆分为两个独立的服务，共享同一个 MySQL 数据库：

1. **业务服务 (Java / Port: 8080)**
   - 负责处理传统的 HTTP 业务请求。
   - 管理用户系统（注册、登录、鉴权）。
   - 管理文档元数据（创建、列表查询、删除）。
   - 生成 JWT Token 供前端和 Go 端校验。
2. **实时服务 (Go / Port: 8081)**
   - 负责处理 WebSocket 长连接。
   - 处理 **Yjs (CRDT)** 协同协议，解决多用户并发冲突。
   - **热数据层**：使用 Redis 存储实时的文档编辑流。
   - **持久化层**：负责静态文件上传/存储，并定时将协同数据异步清洗入 MySQL。

------

##  技术栈

###  Java 后端 (Business Service)

- **Framework**: Spring Boot 3.x
- **ORM**: MyBatis-Plus
- **Auth**: JWT (JSON Web Token)
- **Tool**: Lombok, Maven

###  Go 后端 (Real-time Service)

- **Framework**: Gin (Web 框架)
- **WebSocket**: Gorilla WebSocket
- **ORM**: GORM (MySQL 操作)
- **Cache/PubSub**: Go-Redis (Redis 客户端)
- **Middleware**: CORS (跨域处理)

###  基础设施

- **Database**: MySQL 8.0 (数据持久化)
- **Cache**: Redis (实时协同状态暂存 & 消息分发)
- **Protocol**: Yjs (CRDT 算法，前端协议对接)

------

## 核心功能

### 1. 用户认证系统

- **JWT 鉴权**：实现了基于 JWT 的无状态认证。
- **统一密钥**：Java 负责签发 Token，Go 负责解析校验 Token（共享 Secret）。
- **拦截器**：Java 端实现了 `LoginInterceptor`，基于 ThreadLocal 管理用户上下文。

### 2. 双模式文档管理

系统支持两种类型的文档，逻辑完全分离：

- **Type 0 (静态资源)**：
  - 支持图片、PDF 等文件上传。
  - Go 负责接收文件并存储到本地磁盘 (`/uploads`)。
  - Java 负责管理文件记录，并支持**物理删除**（同时删除数据库记录和磁盘文件）。
- **Type 1 (协同文档)**：
  - 纯文本/富文本协同编辑。
  - 支持**手动版本快照**，将当前状态归档。

### 3. 实时协同编辑 (核心亮点)

- **WebSocket 通信**：基于 Room（文档ID）的房间机制。
- **CRDT 算法支持**：后端无缝转发 Yjs 二进制更新数据，支持多人在弱网、高并发下数据最终一致性。
- **增量更新**：只传输变化的数据（Update），而非全量覆盖。

### 4. 多级持久化策略

为了兼顾性能与数据安全，实现了三级存储架构：

1. **内存/Redis**：实时编辑时，数据在 Redis 中以 List 形式高速读写。
2. **自动兜底 (Auto-Save)**：Go 服务内置定时器（Ticker），每 30 秒自动将活跃文档的 Redis 数据合并，更新至 MySQL `document` 表。
3. **版本控制 (Snapshot)**：用户手动触发保存时，生成独立的版本记录存入 `doc_version` 表，用于未来回滚。

------

## 项目结构

Plaintext

```
DOC (Root)
├── Doc (Java Project)
│   ├── src/main/java/org/example
│   │   ├── controller   # API 接口层 (User, Document)
│   │   ├── service      # 业务逻辑层
│   │   ├── entity       # 数据库实体 (MyBatis-Plus)
│   │   ├── mapper       # DAO 层
│   │   ├── config       # WebConfig (拦截器配置)
│   │   └── utils        # JWT 工具类
│   └── ...
│
├── lark (Go Project)
│   ├── main.go          # Go 入口 (Gin 路由, CORS 配置)
│   ├── uploads/         # [自动生成] 静态文件存储目录
│   ├── ws/
│   │   ├── client.go    # WebSocket 连接处理
│   │   ├── hub.go       # 核心广播逻辑 & 定时任务
│   │   ├── redis.go     # Redis 操作封装
│   │   ├── mysql.go     # GORM 操作封装 (CheckDB 安全机制)
│   │   └── jwt.go       # Token 解析
│   └── ...
```

------

## 快速开始

### 1. 环境准备

本地安装了 Docker，并启动 MySQL 和 Redis：

Bash

```
# 示例：启动容器 (请确保密码与代码中一致)
docker run -d --name mysql_lark -p 3306:3306 -e MYSQL_ROOT_PASSWORD=root mysql:8
docker run -d --name lark_redis -p 6379:6379 redis
```

### 2. 数据库初始化

在 MySQL 中执行 `init.sql` (创建 `sys_user`, `document`, `doc_version` 表)。

### 3. 启动 Java 后端

Bash

```
cd Doc
mvn spring-boot:run
# 服务启动在 :8080
```

### 4. 启动 Go 后端

Bash

```
cd lark
go mod tidy
go run .
# 服务启动在 :8081
```

------

## 开发注意事项

1. **密钥一致性**：
   - Java 的 `JwtUtils.java` 和 Go 的 `ws/jwt.go` 中的 **SECRET** 必须完全一致，否则 Go 无法解析 Java 签发的 Token，会导致 WebSocket 连接失败 (401)。
2. **数据库密码**：
   - 请确保 Go 代码 (`ws/mysql.go`) 中的 DSN 连接字符串密码与 Docker 容器密码匹配（当前配置为 `root:root`）。
3. **跨域 (CORS)**：
   - Go (`main.go`) 和 Java (`WebConfig.java`) 均已配置允许跨域，支持前端 `localhost:5173` 访问。
4. **文件删除路径**：
   - Java 执行物理删除时，使用相对路径寻找兄弟目录 `../lark/uploads`。请保持项目目录结构 `Doc` 和 `lark` 并列，否则会导致删除失败。

![Language Count](https://img.shields.io/github/languages/count/Amilime/Sim_lark-)
![Top Language](https://img.shields.io/github/languages/top/Amilime/Sim_lark-)
![Repo Size](https://img.shields.io/github/repo-size/Amilime/Sim_lark-)