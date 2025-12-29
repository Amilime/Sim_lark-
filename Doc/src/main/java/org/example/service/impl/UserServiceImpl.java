package org.example.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import org.example.common.Result;
import org.example.entity.User;
import org.example.mapper.UserMapper;
import org.example.service.UserService;
import org.example.utils.JwtUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.HashMap;
import java.util.Map;
// 这里是对登录业务的实现具体流程

@Service
public class UserServiceImpl extends ServiceImpl<UserMapper, User> implements UserService {


    @Autowired
    private JwtUtils jwtUtils;

    @Override
    public Result<Map<String, Object>> login(String username, String password) {
        if (username == null || password == null) {
            return Result.error("用户密码不能空");
        }

        QueryWrapper<User> query = new QueryWrapper<>();
        query.eq("username", username);
        query.eq("password", password);
        User user = this.getOne(query);

        if (user == null) {
            return Result.error("未找到该角色");
        }

        String token = jwtUtils.generateToken(user.getUsername(), user.getId(), user.getRole());


        Map<String, Object> data = new HashMap<>();
        data.put("token", token);
        data.put("userId", user.getId());
        data.put("nickname", user.getNickname());

        return Result.success(data);
    }
    @Override
    public Result<User> register(User user) {
        // 1. 检查账号是否已存在
        QueryWrapper<User> query = new QueryWrapper<>();
        query.eq("username", user.getUsername());
        if (baseMapper.selectCount(query) > 0) {
            return Result.error("注册失败：账号 " + user.getUsername() + " 已存在");
        }

        // 2. 补全默认信息
        if (user.getNickname() == null || user.getNickname().isEmpty()) {
            user.setNickname("新用户" + System.currentTimeMillis() % 1000);
        }
        user.setRole("USER"); // 默认都是普通用户
        user.setCreateTime(java.time.LocalDateTime.now());


        baseMapper.insert(user);

        return Result.success(user);
    }

}