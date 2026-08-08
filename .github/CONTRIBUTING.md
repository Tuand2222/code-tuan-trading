# 🤖 Contributing Guidelines for AI Assistants

## Workflow cho AI (GitHub Apps/Copilot)

### 📋 Quy trình chuẩn:

1. **Tạo nhánh riêng từ `main`**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Thực hiện thay đổi code**
   - Commit messages phải rõ ràng và mô tả chi tiết
   - Format: `[TYPE]: Description`
   - Ví dụ: `[feat]: Add trading calculation module`

3. **Mở Pull Request**
   - Tiêu đề PR phải mô tả rõ ràng
   - Mô tả chi tiết những gì thay đổi
   - Reference issue nếu có (Fixes #123)

4. **Đợi review & merge**
   - Cần tối thiểu 1 approval
   - Không được force push lên `main`

---

## ✅ Repository Rules

- ❌ **KHÔNG** commit trực tiếp vào `main`
- ✅ **PHẢI** tạo Pull Request từ feature branch
- ✅ **PHẢI** đợi approval trước khi merge
- ❌ **KHÔNG** được force push
- ✅ Commit messages phải chi tiết

---

## 🎯 Best Practices

### Commit Message Format:
```
[TYPE]: Brief description

More detailed explanation if needed
```

**Types:**
- `[feat]`: New feature
- `[fix]`: Bug fix
- `[docs]`: Documentation
- `[refactor]`: Code refactoring
- `[test]`: Tests
- `[chore]`: Maintenance

### PR Description Template:
```markdown
## 📝 Description
Mô tả những gì PR này làm

## 🎯 Related Issue
Fixes #(issue number)

## 🔍 Changes
- Change 1
- Change 2
- Change 3

## ✅ Checklist
- [ ] Code được review
- [ ] Tests passed
- [ ] Documentation updated
```

---

## 🔑 Permissions Required

AI assistants có quyền:
- ✅ Read & Write Contents
- ✅ Read & Write Pull Requests
- ✅ Read Metadata
- ✅ Read & Write Issues

---

## 📞 Support

Nếu gặp vấn đề, vui lòng mở issue hoặc discussion.
