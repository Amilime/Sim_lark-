package org.example.controller;

import org.example.common.Result;
import org.example.entity.Document;
import org.example.mapper.DocumentMapper;
import org.example.utils.UserContext;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.io.File;
import java.nio.file.Paths;
@RestController
@RequestMapping("/doc")
@CrossOrigin(originPatterns = "*")
public class DocumentController {

    @Autowired
    private DocumentMapper documentMapper;

    // 这是一个【受保护】的接口，必须带 Token 才能访问
    @PostMapping("/create")
    public Result<Map<String, Object>> createDoc(@RequestBody Document doc) {

        // 这里直接从 UserContext 拿 ID
        // 如果拦截器工作正常，这里一定能拿到值。
        // 如果拦截器没工作，或者 Token 没传，这里会报错或者拿到 null。
        Long currentUserId = UserContext.getUserId();

        // 自动填入 ownerId，不再需要前端传了
        doc.setOwnerId(currentUserId);

        // 补全其他信息
        doc.setVersion(1);
        doc.setCreateTime(LocalDateTime.now());
        doc.setUpdateTime(LocalDateTime.now());

        documentMapper.insert(doc);

        Map<String, Object> map = new HashMap<>();
        map.put("docId", doc.getId());
        return Result.success(map);
    }

    // 获取列表接口
    @GetMapping("/list")
    public Result<List<Document>> listDocs() {
        return Result.success(documentMapper.selectList(null));
    }

    private String getUploadPath() {
        try {
            // 1. 获取 Java 项目的当前工作目录 (例如 F:\...\DOC\Doc)
            String javaProjectDir = System.getProperty("user.dir");

            // 2. 获取父目录 (例如 F:\...\DOC)
            // 使用 Paths 工具类处理路径分隔符，兼容 Windows(\) 和 Linux(/)
            File parentDir = Paths.get(javaProjectDir).getParent().toFile();

            // 3. 拼接到 Go 项目的 uploads 目录
            File uploadDir = new File(parentDir, "lark/uploads");

            // 打印一下路径，方便你调试时确认对不对
            System.out.println(">>> [删除操作] 定位上传目录: " + uploadDir.getAbsolutePath());

            return uploadDir.getAbsolutePath();
        } catch (Exception e) {
            e.printStackTrace();
            return null;
        }
    }

    @DeleteMapping("/delete/{id}")
    public Result<String> deleteDoc(@PathVariable Long id) {
        // 1. 查询文档信息
        Document doc = documentMapper.selectById(id);
        if (doc == null) {
            return Result.error("文件不存在");
        }

        // 2. 如果是静态文件(Type=0)，执行物理删除
        if (doc.getDocType() == 0 && doc.getFileKey() != null) {
            try {
                String uploadRootPath = getUploadPath();
                if (uploadRootPath != null) {
                    // 解析文件名：从 URL (http://.../abc.png) 提取 abc.png
                    String fileUrl = doc.getFileKey();
                    String filename = fileUrl.substring(fileUrl.lastIndexOf("/") + 1);

                    // 组合完整路径
                    File file = new File(uploadRootPath, filename);

                    if (file.exists()) {
                        if (file.delete()) {
                            System.out.println(">>>  物理文件删除成功: " + filename);
                        } else {
                            System.err.println(">>>  物理文件删除失败 (可能被占用): " + filename);
                            // 注意：即使物理删除失败，通常也建议继续删除数据库记录，
                            // 否则用户永远删不掉这个“僵尸”条目。
                        }
                    } else {
                        System.out.println(">>> ⚠ 物理文件未找到 (可能已被删): " + file.getAbsolutePath());
                    }
                }
            } catch (Exception e) {
                System.err.println(">>> 删除逻辑异常: " + e.getMessage());
            }
        }

        // 3. 删除数据库记录 (这一步最重要，保证前端列表更新)
        documentMapper.deleteById(id);

        return Result.success("删除成功");
    }
    @GetMapping("/detail/{id}")
    public Result<Document> getDocDetail(@PathVariable Long id) {
        Document doc = documentMapper.selectById(id);
        if (doc == null) {
            return Result.error("文档不存在");
        }
        // 这里返回 content 也没关系，因为 Type 1 文档 MySQL 里的 content 是最新的备份
        return Result.success(doc);
    }
}

