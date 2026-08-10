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

## 🔐 Website accounts

Trading Plan Pro uses its own Better Auth account system. Email/password works with a D1 database; Google, Facebook, Apple, password-reset email, and Cloudflare Turnstile are enabled only when their environment variables are configured.

1. Copy `.env.example` to an ignored local environment file.
2. Generate a long random `BETTER_AUTH_SECRET` and set the public `BETTER_AUTH_URL`.
3. Add OAuth, Resend, and Turnstile credentials in the deployment environment when those providers are needed.
4. Apply the checked-in Drizzle migrations before serving the new version.

Never commit real provider credentials or reuse the authentication secret between unrelated applications.

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
