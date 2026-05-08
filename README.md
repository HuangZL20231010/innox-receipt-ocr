# Innox 发票整理小助手

一个纯前端网页工具，帮深圳科创学院的团队把"翻发票 → 抄表 → 填验收单"的流程压缩成两次上传 + 一次点击。

- 上传 **发票 PDF** → AI 自动识别项目名 / 型号 / 数量 / 单价 / 小计
- 上传 **购买截图** → 自动作为验收照片附在 Word 末尾
- 表格在线校对 → 一键导出《深圳科创学院采购验收单（团队自采）》Word 文件

技术栈：React 18 + Vite 5 + Tailwind CSS。所有处理都在浏览器本地完成，API Key 仅存于 localStorage，不会上传到任何服务器。

---

## 快速开始（本地运行）

### 前置要求

- Node.js ≥ 18
- npm（或 pnpm / yarn）
- 一个 DeepSeek API Key（[在这里申请](https://platform.deepseek.com/api_keys)，新用户有免费额度）

### 三步启动

```bash
# 1. 安装依赖
npm install

# 2. 启动开发服务器（默认会自动打开浏览器）
npm run dev

# 3. 浏览器访问 http://localhost:5173
```

第一次打开时，点击页面顶部的"⚙️ 设置"，把 DeepSeek API Key 填进去（会自动保存在你浏览器的 localStorage，下次打开无需再填）。

---

## 使用流程

1. **设置面板**：填写 DeepSeek API Key、团队经办人姓名、验收日期（默认今天，可改）
2. **上传发票 PDF**：拖拽或点击上传，可一次性多张；自动调用 DeepSeek 识别项目和金额
3. **上传购买截图**：拖拽或点击上传图片（jpg/png/webp），自动压缩；这些图会作为验收照片放进最终的 Word 中
4. **校对采购明细**：识别出的每一行都可以编辑，能新增空行、删除错误行；当 `单价 × 数量 ≠ 小计` 时该行会黄色高亮提醒
5. **生成 Word**：点击底部按钮，文件会自动下载到浏览器默认下载目录，文件名为 `深圳科创学院采购验收单_YYYYMMDD.docx`

---

## 打包部署

```bash
npm run build      # 产物在 dist/
npm run preview    # 本地预览生产构建
```

`dist/` 是纯静态文件，可上传到任何静态托管平台：

- **Nginx**：把 `dist/` 内容拷到 web 根目录
- **Vercel / Netlify**：连接仓库直接部署，无需配置
- **GitHub Pages**：把 `dist/` 内容推到 `gh-pages` 分支
- **对象存储**：阿里云 OSS / 腾讯云 COS 静态网站功能均可

---

## 项目结构

```
receiptOCR/
├── index.html                  Vite 入口
├── package.json
├── vite.config.js
├── tailwind.config.js
├── 采购验收单模版.docx          原始 Word 模板（参考用）
└── src/
    ├── main.jsx                React 挂载
    ├── App.jsx                 主页面 + 状态管理
    ├── index.css               Tailwind + 全局样式
    ├── hooks/
    │   └── useLocalStorage.js  设置项持久化
    ├── components/
    │   ├── SettingsPanel.jsx   API Key、姓名、日期
    │   ├── PdfUploader.jsx     PDF 上传 + 识别状态
    │   ├── ImageUploader.jsx   截图上传 + 缩略图
    │   ├── ItemsTable.jsx      可编辑明细表格
    │   └── GenerateButton.jsx  生成 Word 按钮
    ├── lib/
    │   ├── pdf.js              pdfjs-dist 封装
    │   ├── deepseek.js         DeepSeek API 调用
    │   ├── compress.js         图片压缩
    │   └── docx-builder.js     Word 文档生成
    └── prompts/
        └── extract.js          DeepSeek 提示词
```

---

## 常见问题

**Q：API Key 在哪里申请？**
A：[https://platform.deepseek.com/api_keys](https://platform.deepseek.com/api_keys)。注册账号后免费创建即可，新用户通常有免费额度。

**Q：PDF 上传后提示"未提取到任何文字"怎么办？**
A：说明你的 PDF 是扫描件（图像 PDF），没有文字层。请用电子发票（开票系统下载的那种）。

**Q：识别的项目名 / 金额错了？**
A：直接在采购明细表格里手动改即可，所有字段都可编辑。

**Q：API Key 安全吗？会不会被发到你的服务器？**
A：本工具是**纯前端**应用，没有任何后端服务器。API Key 只保存在你浏览器的 localStorage，只在调 DeepSeek 时直接发到 `api.deepseek.com`。代码完全开源，你可以随时检查 `src/lib/deepseek.js`。

**Q：生成的 Word 字体不对？**
A：Word 模板用的是苹方字体（PingFang SC），如果你的 Windows 没有该字体，会自动回退到微软雅黑或宋体。视觉上略有差异，但表格结构完全一致。

---

## 隐私说明

- 你的 DeepSeek API Key 仅保存在浏览器 localStorage，不会发到本应用的任何后端
- PDF 中提取的文字只发给 DeepSeek 做结构化抽取
- 上传的截图**不会**发到任何外部服务（包括 DeepSeek），全程仅在浏览器本地处理后嵌入 Word
- 所有产物（识别结果、Word 文件）都只存在于你的浏览器和下载目录中

---

## 技术栈

| 用途 | 库 |
|---|---|
| 框架 | React 18 + Vite 5 |
| 样式 | Tailwind CSS 3 |
| PDF 文字提取 | pdfjs-dist 4 |
| AI 抽取 | DeepSeek API（deepseek-chat，JSON mode） |
| 图片压缩 | browser-image-compression 2 |
| Word 生成 | docx 8 |
| 文件下载 | file-saver 2 |
