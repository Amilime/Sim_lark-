package org.example.utils;

public class UserContext {
    private static final ThreadLocal<Long> userHolder = new ThreadLocal<>();

    public static void setUserId(Long userId){
        userHolder.set(userId);
    }

    public static Long getUserId() {
        return userHolder.get();
    }

    // 记得清理，防止内存泄漏.虽然 Spring Boot 线程池会复用，但不清理会导致数据串台
    public static void remove() {
        userHolder.remove();
    }
}
