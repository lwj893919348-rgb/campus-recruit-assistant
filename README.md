# 职航 · 大学生校招助手

针对大学生校招痛点打造的一体化求职工作台（React + Vite + Tailwind CSS + Express + Node.js 原生 SQLite，**同时支持 GitHub Pages 免服务器免费在线部署**）。

## 核心功能

1. **真实官网校招信息检索与地区筛选（75 家名企 / 151+ 校招岗）**
   - 覆盖互联网大厂/AI、独角兽/名企、硬科技、半导体芯片、新能源车企、先进制造、国央企、金融机构、外企名企 **9 大行业**、全国 **25 个城市及海外节点**。
   - 支持 **城市群快捷切换 + 多城市多选**、招聘季、届别、企业性质、岗位方向多维过滤。
   - **「官方名企入口墙」**支持行业检索与填入目标关键词生成 **「带参搜官网」** 直达链接，拒绝二手中介与培训引流。
2. **招聘信息更新中心 & 批量导入**
   - 内置网申截止时间自动巡检（过期自动下线 `closed`、10 天内临近截止预警 `closing_soon`）。
   - 支持一键全量同步、配置合规公开 RSS/Atom / JSON Feed / JSON-LD 订阅源（本地后端或 Actions 运行），以及通过文本/CSV/JSON **批量去重导入**学校就业群或内推清单。
3. **校招简历工坊与 A4 PDF 导出**
   - 内置 **4 套校招专属模板**（极简技术单栏 ATS 友好风、现代双栏紧凑风、国央企/金融稳重风、产品运营亮色风）。
   - 支持多版本简历管理、派生副本、模块显隐排序、STAR 句式快捷提示、A4 单页实时填充度监测，以及高精度矢量 PDF 打印导出。
4. **投递信息管理看板**
   - 支持 **6 阶段看板视图 (Kanban) + 列表视图 (Table)** 流转，关联投递简历版本、内推码、笔面试倒计时、面经复盘，以及一键导出 UTF-8 `.csv` 表格备份。

---

## 零成本上传 GitHub 并免费公开给别人用（无需买服务器）

本仓库已内置 **`.github/workflows/deploy-pages.yml`** 与 **浏览器 `localStorage` 本地运行内核**：
- 部署到 **GitHub Pages** 后，**完全不用买服务器、不用配数据库**：所有同学打开你的链接即可搜索 75 家官网岗位、写简历导出 PDF、管理个人投递看板（各自数据隐私存储在自己的浏览器里，支持顶部一键导出/恢复 `.json` 备份）；
- GitHub Actions 每天北京时间 10:00 会自动巡检截止日期并重新构建发布最新版本，实现**免服务器持续更新**。

### 上传与发布四步操作

1. **在 GitHub 新建空仓库**
   - 登录 GitHub，点击右上角 **`+` → `New repository`**；
   - 填写仓库名（例如 `campus-recruit-assistant`），可见性选 **`Public`**（公开仓库免费不限额度使用 Pages 与 Actions），不要勾选 Initialize README，点击 Create。

2. **将本项目文件夹推送到 GitHub**
   - 在本目录（`招聘助手`）打开 PowerShell，依次执行（把下面 `<你的用户名>` 和 `<仓库名>` 换成你自己的）：

   ```powershell
   # 如果还没有 git 初始化，先执行初始化和提交
   git init -b main
   git config user.name "你的名字"
   git config user.email "你的邮箱@example.com"
   git add .
   git commit -m "feat: 初始化职航大学生校招助手（支持 GitHub Pages 免服务器部署）"

   # 关联你刚建的远程仓库并推送
   git remote add origin https://github.com/<你的用户名>/<仓库名>.git
   git push -u origin main
   ```

   > 如尚未生成或想先查看待上传文件，可运行 `git status`，`.gitignore` 已自动排除 `node_modules/`、`dist/` 和本地 `.db` 数据库文件。

3. **开启 GitHub Pages（关键一步）**
   - 进入你的 GitHub 仓库页面 → 点击顶部 **Settings** → 左侧栏点 **Pages**；
   - 在 **Build and deployment → Source** 下拉框选择 **`GitHub Actions`**。

4. **等待约 1 分钟获取分享网址**
   - 点击仓库顶部的 **Actions** 选项卡，等待 **Deploy Campus Recruit Assistant to GitHub Pages** 变为绿色对勾；
   - 回到 **Settings → Pages** 即可看到公开访问地址：`https://<你的用户名>.github.io/<仓库名>/`，直接把链接发给同学即可在线使用！

---

## 本地开发 / 完整后端模式运行（Node.js 24+）

如果你或开发者希望在本地电脑启动包含 SQLite 持久化、服务端 HTTP 官网连通性探测与跨站 RSS 同步的完整全栈服务：

```powershell
npm install
npm test         # 运行 8 项后端数据库迁移、同步引擎与 API 集成测试
npm run dev      # 同时启动 Express API (3001) 与 Vite 前端 (5173)
npm run build    # 构建后端托管模式前端产物至 dist/
npm run start    # 启动生产模式（单端口 http://localhost:3001）
```

如需本地预览与 GitHub Pages 完全一致的免后端静态版本：

```powershell
npm run build:pages
npx vite preview --mode pages --port 4173
```
