package org.example.common;

import lombok.Data;

/***
 * 成功或失败时候的响应
 * @param <T>
 */
@Data
public class Result<T> {
    private Integer code;  // 状态码
    private String msg;
    private T data;

    public static <T> Result<T> success(T data) {
        Result<T> r = new Result<>();
        r.code = 200;
        r.msg = "OK!";
        r.data = data;
        return r;
    }

    public static <T> Result<T> error(String msg) {
        Result<T> r = new Result<>();
        r.code = 500; // 反正错了（
        r.msg = msg;
        return r;
    }
}
