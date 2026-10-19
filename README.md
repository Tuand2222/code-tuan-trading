# Code Tuan Trading 📈

> AI-enabled trading application with GitHub workflow integration

## 🚀 Quick Start

```bash
# Clone repository
git clone https://github.com/Tuand2222/code-tuan-trading.git
cd code-tuan-trading

# Install dependencies
npm install

# Run development server
npm run dev

# Run tests
npm run test

# Build for production
npm run build
```

## 🗂️ Journal data

The journal opens without a sign-in form. In device mode, trades and notes are saved in the current browser profile; use **Settings → Data & Backup** to export a copy before changing browsers or devices. PDF import supports Binance Futures position history, while Excel and CSV import files with date, symbol, side, and P&L columns.

The Better Auth backend remains in the repository for existing private-cloud deployments, but the public sign-in and password-reset pages now return to the journal. Automatic broker sync and private cloud image storage require a configured cloud session.

## 📋 Repository Rules

✅ **Workflow:**
- Create feature branch
- Make changes
- Submit Pull Request
- Wait for approval
- Merge to main

❌ **Prohibited:**
- Direct commits to `main`
- Force pushes
- Merging without review

## 🤖 For AI Assistants

**Permissions:**
- ✅ Read & Write Contents
- ✅ Read & Write Pull Requests
- ✅ Read Metadata
- ✅ Read & Write Issues

**Workflow:**
1. Create branch: `feature/description`
2. Make changes and commits
3. Push to remote
4. Create Pull Request
5. Wait for approval & merge

## 📖 Documentation

- [Contributing Guide](./CONTRIBUTING.md)
- [Issue Templates](./.github/ISSUE_TEMPLATE)
- [PR Template](./.github/pull_request_template.md)
- [Security Policy](./SECURITY.md)

## 🔒 Branch Protection

**Main branch rules:**
- ✅ Require pull request before merging
- ✅ Block force pushes
- ✅ Dismiss stale reviews

## 📞 Support

Create an issue or discussion for questions!

---

**Language:** TypeScript  
**License:** MIT  
**Status:** Active Development

## Bản v6 đang dựng song song

Nền v6 theo Master Spec nằm tại [v6/README.md](v6/README.md), tách riêng dependencies/build với website v3. Sprint S0 chưa có UI sản phẩm và không thay production. Xem checkpoint, fixture gốc và quy trình trong `v6/docs/`.
