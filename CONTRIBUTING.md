# 🤝 Contributing Guide

Cảm ơn bạn quan tâm đến dự án này! Hướng dẫn này sẽ giúp bạn hiểu quy trình contribute.

---

## 📋 Quy trình Contribute

### 1️⃣ **Fork & Clone Repository**
```bash
git clone https://github.com/Tuand2222/code-tuan-trading.git
cd code-tuan-trading
```

### 2️⃣ **Tạo Feature Branch**
```bash
git checkout -b feature/your-feature-name
```

**Naming Convention:**
- Features: `feature/description`
- Bugs: `fix/bug-description`
- Docs: `docs/description`
- Tests: `test/description`

### 3️⃣ **Commit Code**

**Format Commit Message:**
```
[TYPE]: Brief description

Optional detailed explanation
```

**Types:**
- `[feat]` - New feature
- `[fix]` - Bug fix
- `[docs]` - Documentation
- `[refactor]` - Code refactoring
- `[test]` - Tests
- `[chore]` - Maintenance
- `[perf]` - Performance improvement

**Ví dụ:**
```
[feat]: Add trading calculation module

- Implement price calculation
- Add unit tests
- Update documentation
```

### 4️⃣ **Push & Create Pull Request**
```bash
git push origin feature/your-feature-name
```

Vào GitHub tạo PR với template:
- Mô tả chi tiết thay đổi
- Reference issue (Fixes #123)
- Checklist hoàn thành

### 5️⃣ **Code Review & Merge**
- Đợi ít nhất 1 approval
- Resolve conflicts nếu có
- Merge vào `main`

---

## 🎯 Best Practices

### Code Quality
- ✅ Follow project coding style
- ✅ Add unit tests cho features mới
- ✅ Update documentation
- ✅ No console errors/warnings

### Git Workflow
- ❌ **KHÔNG** commit trực tiếp vào `main`
- ✅ **PHẢI** tạo feature branch
- ✅ **PHẢI** mở Pull Request
- ✅ **PHẢI** đợi approval

### Commit Best Practices
- ✅ Atomic commits (1 change = 1 commit)
- ✅ Descriptive messages
- ✅ Regular commits (không 1 commit cho cả PR)

---

## 🚀 Development Setup

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Run tests
npm run test

# Build for production
npm run build
```

---

## 📝 Pull Request Checklist

Trước khi submit PR:
- [ ] Branch tạo từ `main` mới nhất
- [ ] Code theo chuẩn project
- [ ] Tests pass locally
- [ ] No breaking changes
- [ ] Documentation updated
- [ ] Commit messages descriptive
- [ ] No merge conflicts

---

## 🐛 Báo cáo Bug

Vui lòng dùng **Bug Report** template:
1. Vào **Issues** → **New issue**
2. Chọn **Bug Report** template
3. Điền chi tiết bug
4. Submit

---

## 💡 Đề xuất Feature

Vui lòng dùng **Feature Request** template:
1. Vào **Issues** → **New issue**
2. Chọn **Feature Request** template
3. Mô tả tính năng
4. Submit

---

## 🤖 AI/Bot Workflow

Nếu bạn là AI assistant:

```
1. Tạo branch: feature/ai-task-{number}
2. Implement changes
3. Mở PR từ feature branch
4. Đợi human review
5. Merge khi approved
```

**Quyền truy cập:**
- ✅ Read & Write Contents
- ✅ Read & Write Pull Requests
- ✅ Read Metadata
- ✅ Read & Write Issues

---

## 📞 Support

Có câu hỏi? Tạo issue hoặc discussion!

---

**Happy Contributing! 🎉**
