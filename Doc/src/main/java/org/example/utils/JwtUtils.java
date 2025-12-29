package org.example.utils;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import java.nio.charset.StandardCharsets;

import java.util.Date;
// 这里是对token进行操作的工厂
@Component //注入
public class JwtUtils {

    @Value("${lark.jwt.secret}")
    private String secretKey;


    @Value("${lark.jwt.expiration}")
    private long expireTime;


     // 生成 Token
    public String generateToken(String username, Long userId, String role) {
        return Jwts.builder()
                .setHeaderParam("typ", "JWT")
                .setSubject(username)
                .claim("uid", userId)
                .claim("role", role)
                .setIssuedAt(new Date())
                .setExpiration(new Date(System.currentTimeMillis() + expireTime))
                .signWith(SignatureAlgorithm.HS256, secretKey.getBytes(StandardCharsets.UTF_8))
                .compact();
    }


     //  解析 Token
    public Claims getClaimsByToken(String token) {
        try {
            return Jwts.parser()
                    .setSigningKey(secretKey.getBytes(StandardCharsets.UTF_8))
                    .parseClaimsJws(token)
                    .getBody();
        } catch (Exception e) {
            // Token 过期或非法
            return null;
        }
    }

    // 验证token日期
    public boolean isTokenExpired(Date expiration) {
        return expiration.before(new Date());
    }
}
