package org.example.controller;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import org.example.common.Result;
import org.example.entity.DocVersion;
import org.example.mapper.DocVersionMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/version") // 基础路径
@CrossOrigin(originPatterns = "*")
public class DocVersionController {

    @Autowired
    private DocVersionMapper docVersionMapper;


    @GetMapping("/list/{docId}")
    public Result<List<DocVersion>> listVersions(@PathVariable Long docId) {
        QueryWrapper<DocVersion> query = new QueryWrapper<>();
        query.eq("doc_id", docId);
        query.orderByDesc("create_time"); // 按时间倒序，最新的在上面


        List<DocVersion> list = docVersionMapper.selectList(query);
        return Result.success(list);
    }
}