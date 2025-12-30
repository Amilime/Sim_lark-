@echo off
:: 1. 切换编码为 UTF-8
chcp 65001 >nul

echo ==========================================
echo       🚀 Lark 协同系统 - 一键启动脚本
echo ==========================================
echo.

:: 2. 启动 Docker 容器 (修复了 & 符号问题，用 ^ 转义)
echo [1/3] 正在唤醒数据库 (MySQL ^& Redis)...
docker start mysql_lark lark_redis >nul 2>&1
if %errorlevel% neq 0 (
    echo    ⚠️ 启动容器可能失败，请检查 Docker Desktop 是否打开。
) else (
    echo    ✅ 数据库已就绪。
)

echo.

:: 3. 启动 Java 后端
echo [2/3] 正在启动 Java 后端 (Port: 8080)...
if exist "Doc\mvnw.cmd" (
    :: 方案A: 使用项目自带的 Maven Wrapper (推荐)
    echo    🔍 发现 mvnw 包装器，正在使用它启动...
    start "Lark Java Backend" cmd /k "cd Doc && mvnw spring-boot:run"
) else (
    :: 方案B: 尝试使用全局 Maven
    echo    🔍 未找到 mvnw，尝试使用系统 Maven...
    start "Lark Java Backend" cmd /k "cd Doc && mvn spring-boot:run"
)

:: 4. 启动 Go 后端
echo [3/3] 正在启动 Go 后端 (Port: 8081)...
start "Lark Go Backend" cmd /k "cd lark && go run ."

echo.
echo ==========================================
echo ✅ 服务启动命令已发送！
echo.
echo 📢 Java 特别注意：
echo    如果 "Lark Java Backend" 窗口报错 "'mvn' 不是内部或外部命令"：
echo    1. 请直接在 IntelliJ IDEA 里运行 DocApplication.java。
echo    2. 或者去下载安装 Maven 并配置环境变量。
echo.
echo 现在你可以去写前端了！
pause