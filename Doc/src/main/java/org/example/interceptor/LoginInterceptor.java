package org.example.interceptor;

import io.jsonwebtoken.Claims;
import org.example.utils.JwtUtils;
import org.example.utils.UserContext;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Component
public class LoginInterceptor implements HandlerInterceptor {

    @Autowired
    private JwtUtils jwtUtils;

    // 在请求到达 Controller 之前执行
    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {

        // 1. 处理 OPTIONS 预检请求 (前端跨域时会自动发，直接放行)
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }

        // 2. 从 Header 获取 Token
        // 前端通常约定 Header 格式为: Authorization: <token>
        String token = request.getHeader("Authorization");

        if (token == null || token.isEmpty()) {
            response.setStatus(401); // 401 未授权
            return false;
        }

        // 3. 校验 Token
        Claims claims = jwtUtils.getClaimsByToken(token);
        if (claims == null || jwtUtils.isTokenExpired(claims.getExpiration())) {
            response.setStatus(401);
            return false;
        }

        // 4. Token 有效，把 UserId 存入 ThreadLocal
        // claims.get("uid") 拿出来的是 Integer，转成 Long
        Long userId = Long.valueOf(claims.get("uid").toString());
        UserContext.setUserId(userId);

        // 5. 放行
        return true;
    }

    // 请求结束（无论成功失败）后执行
    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler, Exception ex) {
        // 请求结束必须清理 ThreadLocal，否则会有内存泄漏风险
        UserContext.remove();
    }
}