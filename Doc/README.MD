只是一个平平无奇的文件协同微服务系统
java部分
会用到springboot zk kafka mysql和redis组合等技术
mapper是DAO接口,entity是数据库表实体类

* common通用模块
* config配置类
* controller是接口层
* service和impl才是业务实现逻辑
* utils是工具类

带token的登录业务流程：
1. 角色介绍 (结合你的代码)
   UserController (售票处)：只负责收钱（账号密码），给票（Token）。

JwtUtils (印钞机/制票机)：负责生成防伪的门票（Token），和验证门票真假。

WebConfig (安保主管)：负责制定规则，比如“大门谁都能进，但是过山车项目必须有票”。

LoginInterceptor (检票员)：守在每一个接口门口，负责拦人、查票。

UserContext (游客胸牌)：一旦检票通过，检票员会把你的 ID 写在一个胸牌上挂你脖子上，这样里面的工作人员（Controller）一眼就知道你是谁，不用再查票了。

2. 全流程演示
   阶段一：办卡 (登录)

用户：拿着账号密码访问 /user/login。

WebConfig：看了一眼规则 excludePathPatterns("/user/login")，说：“这个是售票处，不用查票，放行！”

UserController：收到账号密码，去数据库查对不对。

如果对了，调用 JwtUtils.generateToken()。

JwtUtils 制作一张加密的字符串（Token），里面藏了你的 userId: 1。

返回：系统把这个 Token 给用户，用户把它揣在兜里（前端存起来）。

阶段二：游玩 (访问受保护接口)

用户：想去玩“创建文档”项目 (/doc/create)，请求头里带着 Token。

WebConfig：看了一眼规则，发现 /doc/create 不在白名单里，于是大喊：“拦截器 (Interceptor)，上！”

LoginInterceptor (preHandle 方法)：

拦住请求：request.getHeader("Authorization")，伸手要票。

验票：jwtUtils.getClaimsByToken(token)，看票是不是伪造的，有没有过期。

挂胸牌：票是真的！从票里读出 userId，调用 UserContext.setUserId(userId)。把 ID 存进当前线程。

放行：return true。

DocumentController：

请求终于到了这里。

它不需要再问用户是谁，直接调用 UserContext.getUserId() 就能拿到 1。

它用这个 ID 去存数据库：“这是 1号用户 创建的文件”。

结束：

请求处理完，Interceptor 的 afterCompletion 触发，把 UserContext 清空（摘掉胸牌），防止下一个人复用。

token有个坑，java的jjwt 0.9x库会先解码Base64的字符串