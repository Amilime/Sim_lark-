package org.example.controller;

import org.example.common.Result;
import org.example.entity.User;
import org.example.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import java.util.Map;
import java.util.List;
import org.example.utils.UserContext;
@RestController
@RequestMapping("/user")  // 类级别的路径，下面是犯法级别路径
@CrossOrigin(originPatterns = "*") // 允许任何网页跨域访问这个接口
public class UserController {

    @Autowired
    private UserService userService;

    @PostMapping("/login")
    public Result<Map<String, Object>> login(@RequestBody User loginReq) {
        return userService.login(loginReq.getUsername(), loginReq.getPassword());
    }
    @PostMapping("/register")
    public Result<User> register(@RequestBody User user) {
        return userService.register(user);
    }

    @GetMapping("/info")
    public Result<User> getUserInfo() {
        Long userId = UserContext.getUserId();
        if (userId == null) {
            return Result.error("获取用户信息失败");
        }
        User user = userService.getById(userId);
        user.setPassword(null); // 安全起见，抹除密码
        return Result.success(user);
    }

    /**
     * 【新增】获取所有用户列表 (简单的用户黄页)
     */
    @GetMapping("/list")
    public Result<List<User>> listUsers() {
        // 简单查询所有，实际项目中通常需要分页
        List<User> list = userService.list();
        // 抹除密码
        list.forEach(u -> u.setPassword(null));
        return Result.success(list);
    }

}

